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

    [HttpPost("ask")]
    public async Task<IActionResult> Ask([FromBody] ChatPromptRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Pregunta))
        {
            return BadRequest(new { mensaje = "La pregunta no puede estar vacía." });
        }

        var response = await _chatService.ResponderPreguntaAsync(request.Pregunta);
        return Ok(response);
    }
}
