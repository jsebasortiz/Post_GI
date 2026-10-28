namespace BlogApp.DTOs;

public class ChatPromptRequest
{
    public string Pregunta { get; set; } = string.Empty;
}

public class ChatResponse
{
    public string Respuesta { get; set; } = string.Empty;
}

