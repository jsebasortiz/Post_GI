using BlogApp.DTOs;
using BlogApp.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogApp.Controllers;

[Authorize(Roles = "Administrador")]
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

    [HttpPut("{rolId:int}")]
    public async Task<IActionResult> UpdateRol(byte rolId, [FromBody] UpdateRolDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nombre)) return BadRequest(new { message = "El nombre del rol es requerido." });
        var updated = await _roleService.UpdateRolAsync(rolId, dto);
        if (updated == null) return NotFound(new { message = "Rol no encontrado." });
        return Ok(updated);
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

    [HttpDelete("{rolId:int}")]
    public async Task<IActionResult> DeleteRol(byte rolId)
    {
        try
        {
            var success = await _roleService.DeleteRolAsync(rolId);
            if (!success) return NotFound(new { message = "Rol no encontrado." });
            return Ok(new { message = "Rol eliminado correctamente." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error al eliminar el rol.", detail = ex.Message });
        }
    }
}
