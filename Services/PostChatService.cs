using System.Text;
using System.Text.Json;
using BlogApp.Data;
using Microsoft.EntityFrameworkCore;

namespace BlogApp.Services;

public interface IPostChatService
{
    Task<string> ResponderPreguntaAsync(string pregunta);
}

public class PostChatService : IPostChatService
{
    private readonly BlogDbContext _context;
    private readonly IConfiguration _config;
    private readonly HttpClient _httpClient;

    public PostChatService(
        BlogDbContext context,
        IConfiguration config,
        IHttpClientFactory httpClientFactory
    )
    {
        _context = context;
        _config = config;
        _httpClient = httpClientFactory.CreateClient();
    }

    public async Task<string> ResponderPreguntaAsync(string pregunta)
    {
        var apiKey = _config["Gemini:ApiKey"];
        var model = _config["Gemini:Model"] ?? "gemini-flash-latest";

        if (string.IsNullOrWhiteSpace(apiKey) || apiKey == "TU_API_KEY_AQUI")
        {
            return "Error: Debes configurar tu 'ApiKey' de Gemini en el archivo appsettings.json. Puedes obtenerla gratis en https://aistudio.google.com/";
        }

        // 1. Obtenemos los posts disponibles de la BD
        var posts = await _context
            .Posts.Include(p => p.Modulo)
            .Include(p => p.Tipo)
            .Include(p => p.Usuario)
            .Where(p => p.Estado == "publicado")
            .Select(p => new
            {
                Id = p.Id,
                Titulo = p.Titulo,
                Resumen = p.Resumen,
                Contenido = p.Contenido,
                Modulo = p.Modulo != null ? p.Modulo.Nombre : "Sin módulo",
                Tipo = p.Tipo != null ? p.Tipo.Nombre : "General",
                Autor = p.Usuario != null ? p.Usuario.Nombre : "Desconocido",
                FechaCreacion = p.CreadoEn.ToString("yyyy-MM-dd"),
            })
            .ToListAsync();

        if (!posts.Any())
        {
            return "No hay publicaciones disponibles en la base de datos para responder a tu consulta.";
        }

        // 2. Serializamos los posts como catálogo de información
        var postsCatalogoJson = JsonSerializer.Serialize(posts);

        // 3. Instrucción del sistema
        var systemInstruction =
            $@"
Eres el asistente de Inteligencia Artificial para la plataforma de publicaciones 'BlogApp'.
Tu tarea principal es responder a las dudas y solicitudes del usuario ÚNICAMENTE con base en las publicaciones que existen en la base de datos de la empresa.

REGLAS ESTRICTAS:
1. SOLO puedes utilizar la información provista en los post.
2. Si la consulta del usuario no tiene relación con ninguno de los posts o la respuesta no se encuentra en el catálogo, indica educadamente que en el sistema no existe información al respecto. NO inventes hechos, procedimientos ni datos externos.
3. Si el usuario te pide relaciones o análisis (o si la pregunta se beneficia de ello), relaciona los posts identificando temáticas en común, módulos, áreas de impacto o clasificaciones según tu criterio y comprensión del contenido.
4. Cita siempre el título del post y su ID correspondiente al referirte a la información.
5. Responde con un tono formal, claro y en español.

CATÁLOGO DE PUBLICACIONES DISPONIBLES:
{postsCatalogoJson}
";

        // 4. Invocación a la API gratuita de Gemini
        var url =
            $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    role = "user",
                    parts = new[]
                    {
                        new
                        {
                            text = $"{systemInstruction}\n\nPREGUNTA O PETICIÓN DEL USUARIO:\n{pregunta}",
                        },
                    },
                },
            },
        };

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        };
        var jsonContent = new StringContent(
            JsonSerializer.Serialize(requestBody, jsonOptions),
            Encoding.UTF8,
            "application/json"
        );

        try
        {
            var response = await _httpClient.PostAsync(url, jsonContent);

            if (!response.IsSuccessStatusCode)
            {
                var errorMsg = await response.Content.ReadAsStringAsync();
                return $"Error en la API de Gemini ({response.StatusCode}): {errorMsg}";
            }

            var responseJson = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseJson);

            if (
                doc.RootElement.TryGetProperty("candidates", out var candidates)
                && candidates.GetArrayLength() > 0
            )
            {
                var firstCandidate = candidates[0];
                if (
                    firstCandidate.TryGetProperty("content", out var contentElem)
                    && contentElem.TryGetProperty("parts", out var parts)
                    && parts.GetArrayLength() > 0
                )
                {
                    var text = parts[0].GetProperty("text").GetString();
                    return text ?? "No se recibió texto de respuesta.";
                }
            }

            return "No se pudo interpretar la respuesta generada por la IA.";
        }
        catch (Exception ex)
        {
            return $"Error de conexión con la IA: {ex.Message}";
        }
    }
}
