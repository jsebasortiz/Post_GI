using BlogApp.DTOs;
using BlogApp.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlogApp.Controllers;

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
    public async Task<IActionResult> GetModulos([FromQuery] string? categoriaPadre)
    {
        var modulos = await _moduloService.GetModulosAsync(categoriaPadre);
        return Ok(modulos);
    }

    [HttpPost]
    public async Task<IActionResult> CreateModulo([FromBody] CreateModuloDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nombre)) return BadRequest(new { message = "El nombre del módulo es requerido." });
        var modulo = await _moduloService.CreateModuloAsync(dto);
        return Ok(modulo);
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
