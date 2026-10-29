using System.Text;
using System.Text.Json;
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
            .Include(p => p.Usuario)
            .Where(p => p.Estado == "publicado" || p.EstadoId == 1)
            .Select(p => new
            {
                Id = p.Id,
                Titulo = p.Titulo,
                Resumen = p.Resumen,
                Contenido = p.Contenido,
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
Eres el motor de búsqueda y análisis inteligente de 'Prixma' (CentroAguas SA ESP).
Analiza las publicaciones disponibles y responde con un JSON válido estructurado con esta forma exacta:
{{
  ""resumen"": ""Párrafo ejecutivo conciso y claro de 2 o 3 líneas respondiendo al tema consultado."",
  ""publicaciones"": [
    {{
      ""id"": 30,
      ""titulo"": ""Nombre exacto del post"",
      ""area"": ""Nombre del área"",
      ""modulo"": ""Nombre del módulo"",
      ""tipo"": ""Tipo de post (ej: Soporte, Tutorial)"",
      ""autor"": ""Nombre del autor"",
      ""fecha"": ""YYYY-MM-DD"",
      ""descripcion"": ""Breve síntesis de qué resuelve o qué contiene este post.""
    }}
  ],
  ""relaciones"": [
    ""Punto clave 1 explicando la conexión o proceso entre las publicaciones encontradas."",
    ""Punto clave 2 sobre el impacto operativo o recomendaciones técnicas.""
  ]
}}

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE con el objeto JSON.
2. Si la consulta no coincide con ningún post, devuelve ""publicaciones"": [], explica la situación en ""resumen"" y en ""relaciones"" sugiere qué módulos/áreas sí están documentados.
3. Basa todo ÚNICAMENTE en el catálogo adjunto.

CATÁLOGO DE PUBLICACIONES:
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
                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(responseJson);

                    if (doc.RootElement.TryGetProperty("candidates", out var candidates) && candidates.GetArrayLength() > 0)
                    {
                        var firstCandidate = candidates[0];
                        if (firstCandidate.TryGetProperty("content", out var contentElem) &&
                            contentElem.TryGetProperty("parts", out var parts))
                        {
                            var sb = new StringBuilder();
                            foreach (var part in parts.EnumerateArray())
                            {
                                if (part.TryGetProperty("text", out var t))
                                {
                                    sb.Append(t.GetString());
                                }
                            }

                            var rawOutput = sb.ToString().Trim();
                            responseObj.RespuestaRaw = rawOutput;

                            // Extractor infalible: Tomar desde la primera llave '{' hasta la última '}'
                            var primerLlave = rawOutput.IndexOf('{');
                            var ultimaLlave = rawOutput.LastIndexOf('}');

                            if (primerLlave >= 0 && ultimaLlave > primerLlave)
                            {
                                var jsonCandidato = rawOutput.Substring(primerLlave, (ultimaLlave - primerLlave) + 1);

                                // Si el modelo imprimió borradores con múltiples JSONs, buscar el último JSON completo válido
                                while (ultimaLlave > primerLlave)
                                {
                                    try
                                    {
                                        var jsonSegmento = rawOutput.Substring(primerLlave, (ultimaLlave - primerLlave) + 1);
                                        var parsed = JsonSerializer.Deserialize<ChatResponse>(jsonSegmento, new JsonSerializerOptions
                                        {
                                            PropertyNameCaseInsensitive = true
                                        });

                                        if (parsed != null && (!string.IsNullOrEmpty(parsed.Resumen) || parsed.Publicaciones.Count > 0))
                                        {
                                            parsed.RespuestaRaw = rawOutput;
                                            return parsed;
                                        }
                                    }
                                    catch
                                    {
                                        // Intentar con el siguiente bloque si hubiera texto previo
                                        var siguienteLlave = rawOutput.IndexOf('{', primerLlave + 1);
                                        if (siguienteLlave > primerLlave && siguienteLlave < ultimaLlave)
                                        {
                                            primerLlave = siguienteLlave;
                                            continue;
                                        }
                                    }
                                    break;
                                }
                            }

                            // Fallback si no fue JSON
                            responseObj.Resumen = rawOutput;
                            return responseObj;
                        }
                    }
                }
                else
                {
                    var errCode = (int)response.StatusCode;
                    if (errCode == 503 || errCode == 429) continue;
                    break;
                }
            }
            catch
            {
                continue;
            }
        }

        if (string.IsNullOrEmpty(responseObj.Resumen))
        {
            responseObj.Resumen = "No se pudo obtener respuesta del motor de análisis en este momento.";
        }
        return responseObj;
    }
}
