using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using BlogApp.Data;
using BlogApp.DTOs;
using Microsoft.EntityFrameworkCore;

namespace BlogApp.Services;

public interface IPostChatService
{
    Task<ChatResponse> ResponderPreguntaAsync(string pregunta);
}

public class PostChatService : IPostChatService
{
    private readonly BlogDbContext _context;
    private readonly IConfiguration _config;
    private readonly HttpClient _httpClient;

    // Modelos del tier gratuito de Google Gemini API
    private static readonly string[] ModelosGratuitos = new[]
    {
        "gemini-flash-latest",
        "gemini-flash-lite-latest",
        "gemma-4-26b-a4b-it"
    };

    public PostChatService(BlogDbContext context, IConfiguration config, IHttpClientFactory httpClientFactory)
    {
        _context = context;
        _config = config;
        _httpClient = httpClientFactory.CreateClient();
        _httpClient.Timeout = TimeSpan.FromSeconds(60);
    }

    public async Task<ChatResponse> ResponderPreguntaAsync(string pregunta)
    {
        var responseObj = new ChatResponse();
        var apiKey = _config["Gemini:ApiKey"];

        if (string.IsNullOrWhiteSpace(apiKey) || apiKey == "TU_API_KEY_AQUI")
        {
            responseObj.Resumen = "Error: Debes configurar tu 'ApiKey' de Gemini en el archivo appsettings.json.";
            return responseObj;
        }

        var posts = await _context
            .Posts.Include(p => p.Modulo)
                .ThenInclude(m => m!.Area)
            .Include(p => p.Tipo)
            .Include(p => p.TipoConocimiento)
            .Include(p => p.Usuario)
            .Where(p => p.Estado == "publicado" || p.EstadoId == 1)
            .Select(p => new
            {
                Id = p.Id,
                Titulo = p.Titulo,
                Resumen = p.Resumen,
                Contenido = p.Contenido,
                PalabrasClave = p.PalabrasClave,
                TipoConocimiento = p.TipoConocimiento != null ? p.TipoConocimiento.Nombre : "Técnico",
                Area = p.Modulo != null && p.Modulo.Area != null ? p.Modulo.Area.Nombre : "Apps (Aplicaciones)",
                CodigoArea = p.Modulo != null && p.Modulo.Area != null ? p.Modulo.Area.Codigo : "apps",
                Modulo = p.Modulo != null ? p.Modulo.Nombre : "Sin módulo",
                Tipo = p.Tipo != null ? p.Tipo.Nombre : "General",
                Autor = p.Usuario != null ? p.Usuario.Nombre : "Desconocido",
                FechaCreacion = p.CreadoEn.ToString("yyyy-MM-dd")
            })
            .ToListAsync();

        if (!posts.Any())
        {
            responseObj.Resumen = "No hay publicaciones disponibles en la base de datos de Prixma.";
            return responseObj;
        }

        var postsCatalogoJson = JsonSerializer.Serialize(posts);

        var systemInstruction = $@"
Eres el motor de análisis y búsqueda inteligente de 'Prixma' (CentroAguas SA ESP).
Analiza las publicaciones del catálogo y responde OBLIGATORIAMENTE con un JSON estructurado de la siguiente forma:

{{
  ""resumen"": ""Párrafo ejecutivo conciso de 2 o 3 líneas respondiendo directamente a la consulta del usuario."",
  ""publicaciones"": [
    {{
      ""id"": 30,
      ""titulo"": ""Nombre exacto del artículo"",
      ""area"": ""Nombre del área"",
      ""modulo"": ""Nombre del módulo"",
      ""tipo"": ""Tipo de publicación"",
      ""autor"": ""Nombre del autor"",
      ""fecha"": ""YYYY-MM-DD"",
      ""descripcion"": ""Breve explicación de qué resuelve o contiene este post.""
    }}
  ],
  ""relaciones"": [
    ""📌 Flujo Operativo: Explicación paso a paso conectando el artículo [Título Exacto] con [Título Exacto]."",
    ""💡 Impacto Técnico: Cómo interactúan las tecnologías o módulos entre sí."",
    ""⚠️ Recomendación o Alerta: Buenas prácticas, riesgos a evitar o requisitos normativos.""
  ]
}}

REGLAS CRÍTICAS PARA 'relaciones':
1. NUNCA escribas texto genérico como 'ID 37' o 'ID 30' de forma cruda. En su lugar menciona el NOMBRE del artículo entre corchetes o comillas, por ejemplo: 'el post [Control de Cambios y Versionamiento] debe aplicarse antes de [Guía para editar un registro]'.
2. Cada elemento del array 'relaciones' debe ser enriquecido con un prefijo temático relevante (ej: '📌 Flujo:', '🔗 Conexión:', '⚠️ Alerta:', '💡 Recomendación:').
3. Explica claramente la SINERGIA: ¿por qué un artículo complementa al otro?, ¿cuál es el orden lógico de ejecución? y ¿qué impacto tiene en la seguridad, rendimiento o continuidad operativa?
4. Si la consulta no encuentra coincidencias, devuelve ""publicaciones"": [], explica la situación en ""resumen"" y en ""relaciones"" sugiere qué temas sí existen.
5. Responde ÚNICAMENTE con el objeto JSON válido.

CATÁLOGO COMPLETO DE PUBLICACIONES:
{postsCatalogoJson}
";

        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    role = "user",
                    parts = new[]
                    {
                        new { text = $"{systemInstruction}\n\nPREGUNTA O TEMA A BUSCAR:\n{pregunta}" }
                    }
                }
            },
            generationConfig = new
            {
                responseMimeType = "application/json"
            }
        };

        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody, jsonOptions), Encoding.UTF8, "application/json");

        var modeloConfigurado = _config["Gemini:Model"];
        var listaModelos = new List<string>();
        if (!string.IsNullOrWhiteSpace(modeloConfigurado)) listaModelos.Add(modeloConfigurado);
        foreach (var m in ModelosGratuitos)
        {
            if (!listaModelos.Contains(m)) listaModelos.Add(m);
        }

        foreach (var modelo in listaModelos)
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key={apiKey}";
            try
            {
                var response = await _httpClient.PostAsync(url, jsonContent);
                var responseString = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"[PostChatService] Modelo {modelo} falló con status {response.StatusCode}: {responseString}");
                    continue;
                }

                using var doc = JsonDocument.Parse(responseString);
                var root = doc.RootElement;

                if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
                {
                    continue;
                }

                var candidate = candidates[0];
                if (!candidate.TryGetProperty("content", out var contentElem) ||
                    !contentElem.TryGetProperty("parts", out var parts) ||
                    parts.GetArrayLength() == 0)
                {
                    continue;
                }

                var part = parts[0];
                if (part.TryGetProperty("text", out var textElem))
                {
                    var rawJson = textElem.GetString() ?? "";

                    // Limpiar posibles delimitadores markdown ```json ... ```
                    rawJson = Regex.Replace(rawJson, @"^```json\s*", "", RegexOptions.IgnoreCase).Trim();
                    rawJson = Regex.Replace(rawJson, @"^```\s*", "", RegexOptions.IgnoreCase).Trim();
                    rawJson = Regex.Replace(rawJson, @"\s*```$", "", RegexOptions.IgnoreCase).Trim();

                    // Intentar deserializar a ChatResponse estructurado
                    var jsonDeserialized = TryParseChatResponse(rawJson);
                    if (jsonDeserialized != null && (!string.IsNullOrWhiteSpace(jsonDeserialized.Resumen) || jsonDeserialized.Publicaciones.Any()))
                    {
                        return jsonDeserialized;
                    }

                    // Fallback
                    responseObj.Resumen = rawJson;
                    responseObj.RespuestaRaw = rawJson;
                    return responseObj;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PostChatService] Excepción intentando con modelo {modelo}: {ex.Message}");
            }
        }

        responseObj.Resumen = "El servicio de Inteligencia Artificial se encuentra temporalmente ocupado. Por favor, intenta de nuevo en unos segundos.";
        return responseObj;
    }

    private static ChatResponse? TryParseChatResponse(string jsonText)
    {
        try
        {
            var startIndex = jsonText.IndexOf('{');
            var lastIndex = jsonText.LastIndexOf('}');

            if (startIndex >= 0 && lastIndex > startIndex)
            {
                jsonText = jsonText.Substring(startIndex, lastIndex - startIndex + 1);
            }

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            return JsonSerializer.Deserialize<ChatResponse>(jsonText, options);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PostChatService] Falló deserialización de JSON: {ex.Message}");
            return null;
        }
    }
}
