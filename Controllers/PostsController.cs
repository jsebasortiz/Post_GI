using BlogApp.DTOs;
using BlogApp.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace BlogApp.Controllers;

[Authorize]
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
        [FromQuery] byte? tipoConocimientoId,
        [FromQuery] string? search,
        [FromQuery] string? estado = "publicado",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var result = await _postService.GetPostsAsync(moduloId, moduloSlug, categoriaPadre, tipoId, tipoConocimientoId, search, estado, page, pageSize);
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
    [Authorize(Roles = "Administrador,Editor")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> CreatePost([FromForm] CreatePostDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        // Validación de seguridad de identidad: Obtener UsuarioId directamente desde el token JWT
        var claimId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (ulong.TryParse(claimId, out ulong authenticatedUserId) && authenticatedUserId > 0)
        {
            dto.UsuarioId = authenticatedUserId;
        }

        try
        {
            var createdPost = await _postService.CreatePostAsync(dto);
            return CreatedAtAction(nameof(GetPostById), new { id = createdPost.Id }, createdPost);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error interno al registrar la publicación.", detail = ex.Message });
        }
    }

    [HttpPut("{id:long}")]
    [Authorize(Roles = "Administrador,Editor")]
    public async Task<IActionResult> UpdatePost(ulong id, [FromBody] UpdatePostDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        try
        {
            var updatedPost = await _postService.UpdatePostAsync(id, dto);
            if (updatedPost == null) return NotFound(new { message = "Publicación no encontrada" });
            return Ok(updatedPost);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error interno al actualizar la publicación.", detail = ex.Message });
        }
    }

    [HttpDelete("{id:long}")]
    [Authorize(Roles = "Administrador,Editor")]
    public async Task<IActionResult> DeletePost(ulong id)
    {
        var result = await _postService.DeletePostAsync(id);
        if (!result) return NotFound(new { message = "Publicación no encontrada" });
        return Ok(new { message = "Publicación eliminada correctamente" });
    }

    [HttpPost("{id:long}/adjuntos")]
    [Authorize(Roles = "Administrador,Editor")]
    public async Task<IActionResult> AddAdjunto(ulong id, IFormFile file, [FromQuery] bool esPortada = false)
    {
        try
        {
            FileValidationHelper.ValidateFile(file);

            var adjunto = await _postService.AddAdjuntoToPostAsync(id, file, esPortada);
            if (adjunto == null) return NotFound(new { message = "Publicación no encontrada" });

            return Ok(adjunto);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error al subir el archivo adjunto.", detail = ex.Message });
        }
    }

    [HttpDelete("adjuntos/{adjuntoId:long}")]
    [Authorize(Roles = "Administrador,Editor")]
    public async Task<IActionResult> DeleteAdjunto(ulong adjuntoId)
    {
        var result = await _postService.DeleteAdjuntoAsync(adjuntoId);
        if (!result) return NotFound(new { message = "Archivo adjunto no encontrado" });
        return Ok(new { message = "Adjunto eliminado correctamente" });
    }

    [HttpPut("adjuntos/{adjuntoId:long}/portada")]
    [Authorize(Roles = "Administrador,Editor")]
    public async Task<IActionResult> SetPortada(ulong adjuntoId)
    {
        var result = await _postService.SetPortadaAsync(adjuntoId);
        if (!result) return BadRequest(new { message = "No se pudo cambiar la portada. El archivo debe ser una imagen válida." });
        return Ok(new { message = "Portada actualizada correctamente" });
    }
}
