namespace BlogApp.DTOs;

public class ChatPromptRequest
{
    public string Pregunta { get; set; } = string.Empty;
}

public class ChatResponse
{
    public string Resumen { get; set; } = string.Empty;
    public List<PostItemAiDto> Publicaciones { get; set; } = new();
    public List<string> Relaciones { get; set; } = new();
    public string RespuestaRaw { get; set; } = string.Empty;
}

public class PostItemAiDto
{
    public ulong Id { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string Modulo { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public string Autor { get; set; } = string.Empty;
    public string Fecha { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
}
