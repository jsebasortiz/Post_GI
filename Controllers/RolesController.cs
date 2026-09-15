using BlogApp.DTOs;
using BlogApp.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlogApp.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RolesController : ControllerBase
{
    private readonly IRoleService _roleService;

    public RolesController(IRoleService roleService)
    {
        _roleService = roleService;
    }

    [HttpGet]
    public async Task<IActionResult> GetRoles()
    {
        var roles = await _roleService.GetRolesAsync();
        return Ok(roles);
    }

    [HttpGet("permisos")]
    public async Task<IActionResult> GetPermisos()
    {
        var permisos = await _roleService.GetPermisosAsync();
        return Ok(permisos);
    }

    [HttpGet("usuarios")]
    public async Task<IActionResult> GetUsuariosConRoles()
    {
        var usuarios = await _roleService.GetUsuariosConRolesAsync();
        return Ok(usuarios);
    }

    [HttpPost]
    public async Task<IActionResult> CreateRol([FromBody] CreateRolDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nombre)) return BadRequest(new { message = "El nombre del rol es requerido." });
        var rol = await _roleService.CreateRolAsync(dto);
        return Ok(rol);
    }

    [HttpPut("{rolId:int}/permisos")]
    public async Task<IActionResult> UpdateRolPermisos(byte rolId, [FromBody] UpdateRolPermisosDto dto)
    {
        var updated = await _roleService.UpdateRolPermisosAsync(rolId, dto.PermisosIds);
        if (updated == null) return NotFound(new { message = "Rol no encontrado." });
        return Ok(updated);
    }

    [HttpPost("asignar-usuario")]
    public async Task<IActionResult> AssignRolToUsuario([FromBody] AssignUsuarioRolDto dto)
    {
        var success = await _roleService.AssignRolToUsuarioAsync(dto.UsuarioId, dto.RolId);
        if (!success) return BadRequest(new { message = "No se pudo asignar el rol al usuario." });
        return Ok(new { message = "Rol asignado correctamente al usuario." });
    }
}
