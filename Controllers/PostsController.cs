using BlogApp.DTOs;
using BlogApp.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlogApp.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PostsController : ControllerBase
{
    private readonly IPostService _postService;

    public PostsController(IPostService postService)
    {
        _postService = postService;
    }

    [HttpGet]
    public async Task<IActionResult> GetPosts(
        [FromQuery] ushort? moduloId,
        [FromQuery] string? moduloSlug,
        [FromQuery] string? categoriaPadre,
        [FromQuery] byte? tipoId,
        [FromQuery] string? search,
        [FromQuery] string? estado = "publicado",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var result = await _postService.GetPostsAsync(moduloId, moduloSlug, categoriaPadre, tipoId, search, estado, page, pageSize);
        return Ok(result);
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetPostById(ulong id)
    {
        var post = await _postService.GetPostByIdAsync(id);
        if (post == null) return NotFound(new { message = "Publicación no encontrada" });
        return Ok(post);
    }

    [HttpGet("slug/{slug}")]
    public async Task<IActionResult> GetPostBySlug(string slug)
    {
        var post = await _postService.GetPostBySlugAsync(slug);
        if (post == null) return NotFound(new { message = "Publicación no encontrada" });
        return Ok(post);
    }

    [HttpPost]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> CreatePost([FromForm] CreatePostDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        try
        {
            var createdPost = await _postService.CreatePostAsync(dto);
            return CreatedAtAction(nameof(GetPostById), new { id = createdPost.Id }, createdPost);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> UpdatePost(ulong id, [FromBody] UpdatePostDto dto)
    {
        var updatedPost = await _postService.UpdatePostAsync(id, dto);
        if (updatedPost == null) return NotFound(new { message = "Publicación no encontrada" });
        return Ok(updatedPost);
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> DeletePost(ulong id)
    {
        var result = await _postService.DeletePostAsync(id);
        if (!result) return NotFound(new { message = "Publicación no encontrada" });
        return Ok(new { message = "Publicación eliminada correctamente" });
    }

    [HttpPost("{id:long}/adjuntos")]
    public async Task<IActionResult> AddAdjunto(ulong id, IFormFile file, [FromQuery] bool esPortada = false)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Por favor selecciona un archivo válido." });
        }

        var adjunto = await _postService.AddAdjuntoToPostAsync(id, file, esPortada);
        if (adjunto == null) return NotFound(new { message = "Publicación no encontrada" });

        return Ok(adjunto);
    }

    [HttpDelete("adjuntos/{adjuntoId:long}")]
    public async Task<IActionResult> DeleteAdjunto(ulong adjuntoId)
    {
        var result = await _postService.DeleteAdjuntoAsync(adjuntoId);
        if (!result) return NotFound(new { message = "Archivo adjunto no encontrado" });
        return Ok(new { message = "Adjunto eliminado correctamente" });
    }
}
