using BlogApp.DTOs;
using BlogApp.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogApp.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ModulosController : ControllerBase
{
    private readonly IModuloService _moduloService;

    public ModulosController(IModuloService moduloService)
    {
        _moduloService = moduloService;
    }

    [HttpGet]
    public async Task<IActionResult> GetModulos([FromQuery] string? categoriaPadre, [FromQuery] bool soloActivos = true)
    {
        var modulos = await _moduloService.GetModulosAsync(categoriaPadre, soloActivos);
        return Ok(modulos);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetModuloById(ushort id)
    {
        var modulo = await _moduloService.GetModuloByIdAsync(id);
        if (modulo == null) return NotFound(new { message = "Módulo no encontrado." });
        return Ok(modulo);
    }

    [HttpPost]
    [Authorize(Roles = "Administrador,Editor")]
    public async Task<IActionResult> CreateModulo([FromBody] CreateModuloDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nombre)) return BadRequest(new { message = "El nombre del módulo es requerido." });
        var modulo = await _moduloService.CreateModuloAsync(dto);
        return Ok(modulo);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Administrador,Editor")]
    public async Task<IActionResult> UpdateModulo(ushort id, [FromBody] UpdateModuloDto dto)
    {
        try
        {
            var modulo = await _moduloService.UpdateModuloAsync(id, dto);
            return Ok(modulo);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error interno al actualizar el módulo.", detail = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Administrador,Editor")]
    public async Task<IActionResult> InactivarModulo(ushort id)
    {
        var success = await _moduloService.InactivarModuloAsync(id);
        if (!success) return NotFound(new { message = "Módulo no encontrado." });

        return Ok(new { message = "El módulo fue cambiado a estado inactivo (borrado lógico)." });
    }

    [HttpGet("tipos")]
    public async Task<IActionResult> GetPostTipos()
    {
        var tipos = await _moduloService.GetPostTiposAsync();
        return Ok(tipos);
    }

    [HttpGet("tipos/{id:int}")]
    public async Task<IActionResult> GetPostTipo(byte id)
    {
        var tipo = await _moduloService.GetPostTipoByIdAsync(id);
        if (tipo == null) return NotFound(new { message = "Tipo de publicación no encontrado." });
        return Ok(tipo);
    }

    [HttpPost("tipos")]
    [Authorize(Roles = "Administrador,Editor")]
    public async Task<IActionResult> CreatePostTipo([FromBody] CreatePostTipoDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nombre)) return BadRequest(new { message = "El nombre del tipo es requerido." });
        var tipo = await _moduloService.CreatePostTipoAsync(dto);
        return Ok(tipo);
    }

    [HttpPut("tipos/{id:int}")]
    [Authorize(Roles = "Administrador,Editor")]
    public async Task<IActionResult> UpdatePostTipo(byte id, [FromBody] CreatePostTipoDto dto)
    {
        try
        {
            var tipo = await _moduloService.UpdatePostTipoAsync(id, dto);
            return Ok(tipo);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("tipos/{id:int}")]
    [Authorize(Roles = "Administrador,Editor")]
    public async Task<IActionResult> InactivarPostTipo(byte id)
    {
        var success = await _moduloService.InactivarPostTipoAsync(id);
        if (!success) return NotFound(new { message = "Tipo de publicación no encontrado." });
        return Ok(new { message = "El tipo de publicación fue inactivado (borrado lógico)." });
    }

    [HttpGet("tipos-conocimiento")]
    public async Task<IActionResult> GetTiposConocimiento()
    {
        var tipos = await _moduloService.GetTiposConocimientoAsync();
        return Ok(tipos);
    }

    [HttpGet("tipos-conocimiento/{id:int}")]
    public async Task<IActionResult> GetTipoConocimiento(byte id)
    {
        var tc = await _moduloService.GetTipoConocimientoByIdAsync(id);
        if (tc == null) return NotFound(new { message = "Tipo de conocimiento no encontrado." });
        return Ok(tc);
    }

    [HttpPost("tipos-conocimiento")]
    [Authorize(Roles = "Administrador,Editor")]
    public async Task<IActionResult> CreateTipoConocimiento([FromBody] CreateTipoConocimientoDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nombre)) return BadRequest(new { message = "El nombre del tipo de conocimiento es requerido." });
        var tc = await _moduloService.CreateTipoConocimientoAsync(dto);
        return Ok(tc);
    }

    [HttpPut("tipos-conocimiento/{id:int}")]
    [Authorize(Roles = "Administrador,Editor")]
    public async Task<IActionResult> UpdateTipoConocimiento(byte id, [FromBody] CreateTipoConocimientoDto dto)
    {
        try
        {
            var tc = await _moduloService.UpdateTipoConocimientoAsync(id, dto);
            return Ok(tc);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("tipos-conocimiento/{id:int}")]
    [Authorize(Roles = "Administrador,Editor")]
    public async Task<IActionResult> InactivarTipoConocimiento(byte id)
    {
        var success = await _moduloService.InactivarTipoConocimientoAsync(id);
        if (!success) return NotFound(new { message = "Tipo de conocimiento no encontrado." });
        return Ok(new { message = "El tipo de conocimiento fue inactivado (borrado lógico)." });
    }
}
