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
    public async Task<IActionResult> CreateModulo([FromBody] CreateModuloDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nombre)) return BadRequest(new { message = "El nombre del módulo es requerido." });
        var modulo = await _moduloService.CreateModuloAsync(dto);
        return Ok(modulo);
    }

    [HttpPut("{id}")]
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

    [HttpPost("tipos")]
    public async Task<IActionResult> CreatePostTipo([FromBody] CreatePostTipoDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nombre)) return BadRequest(new { message = "El nombre del tipo es requerido." });
        var tipo = await _moduloService.CreatePostTipoAsync(dto);
        return Ok(tipo);
    }
}
