using BlogApp.DTOs;
using BlogApp.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlogApp.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly IPostChatService _chatService;

    public ChatController(IPostChatService chatService)
    {
        _chatService = chatService;
    }

    /// <summary>
    /// Consulta al asistente virtual sobre la información y relaciones de los posts en la base de datos.
    /// </summary>
    /// <param name="request">Pregunta enviada por el usuario.</param>
    /// <returns>Respuesta generada por la IA basada estrictamente en los posts.</returns>
    [HttpPost("ask")]
    public async Task<IActionResult> Ask([FromBody] ChatPromptRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Pregunta))
        {
            return BadRequest(new { mensaje = "La pregunta no puede estar vacía." });
        }

        var respuesta = await _chatService.ResponderPreguntaAsync(request.Pregunta);
        return Ok(new ChatResponse { Respuesta = respuesta });
    }
}

