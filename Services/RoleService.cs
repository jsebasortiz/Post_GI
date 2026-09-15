using BlogApp.Data;
using BlogApp.DTOs;
using BlogApp.Models;
using Microsoft.EntityFrameworkCore;

namespace BlogApp.Services;

public interface IRoleService
{
    Task<List<RolResponseDto>> GetRolesAsync();
    Task<List<PermisoDto>> GetPermisosAsync();
    Task<RolResponseDto> CreateRolAsync(CreateRolDto dto);
    Task<RolResponseDto?> UpdateRolPermisosAsync(byte rolId, List<ushort> permisosIds);
    Task<bool> AssignRolToUsuarioAsync(ulong usuarioId, byte rolId);
    Task<List<UsuarioResponseDto>> GetUsuariosConRolesAsync();
}

public class RoleService : IRoleService
{
    private readonly BlogDbContext _context;

    public RoleService(BlogDbContext context)
    {
        _context = context;
    }

    public async Task<List<RolResponseDto>> GetRolesAsync()
    {
        var roles = await _context.Roles
            .Include(r => r.RolPermisos)
            .ThenInclude(rp => rp.Permiso)
            .OrderBy(r => r.Id)
            .ToListAsync();

        return roles.Select(MapToRolResponseDto).ToList();
    }

    public async Task<List<PermisoDto>> GetPermisosAsync()
    {
        var permisos = await _context.Permisos
            .OrderBy(p => p.Id)
            .ToListAsync();

        return permisos.Select(p => new PermisoDto
        {
            Id = p.Id,
            Codigo = p.Codigo,
            Nombre = p.Nombre,
            Descripcion = p.Descripcion
        }).ToList();
    }

    public async Task<RolResponseDto> CreateRolAsync(CreateRolDto dto)
    {
        var rol = new Rol
        {
            Nombre = dto.Nombre,
            Descripcion = dto.Descripcion,
            CreadoEn = DateTime.UtcNow
        };

        _context.Roles.Add(rol);
        await _context.SaveChangesAsync();

        if (dto.PermisosIds != null && dto.PermisosIds.Count > 0)
        {
            foreach (var permisoId in dto.PermisosIds)
            {
                _context.RolPermisos.Add(new RolPermiso
                {
                    RolId = rol.Id,
                    PermisoId = permisoId
                });
            }
            await _context.SaveChangesAsync();
        }

        return (await GetRolByIdAsync(rol.Id))!;
    }

    public async Task<RolResponseDto?> UpdateRolPermisosAsync(byte rolId, List<ushort> permisosIds)
    {
        var rol = await _context.Roles.Include(r => r.RolPermisos).FirstOrDefaultAsync(r => r.Id == rolId);
        if (rol == null) return null;

        // Limpiar permisos actuales
        _context.RolPermisos.RemoveRange(rol.RolPermisos);

        // Agregar nuevos permisos
        if (permisosIds != null)
        {
            foreach (var pid in permisosIds)
            {
                _context.RolPermisos.Add(new RolPermiso
                {
                    RolId = rolId,
                    PermisoId = pid
                });
            }
        }

        await _context.SaveChangesAsync();
        return await GetRolByIdAsync(rolId);
    }

    public async Task<bool> AssignRolToUsuarioAsync(ulong usuarioId, byte rolId)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
        var rolExists = await _context.Roles.AnyAsync(r => r.Id == rolId);

        if (usuario == null || !rolExists) return false;

        usuario.RolId = rolId;
        usuario.ActualizadoEn = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<UsuarioResponseDto>> GetUsuariosConRolesAsync()
    {
        var usuarios = await _context.Usuarios
            .Include(u => u.Rol)
            .ThenInclude(r => r!.RolPermisos)
            .ThenInclude(rp => rp.Permiso)
            .OrderBy(u => u.Nombre)
            .ToListAsync();

        return usuarios.Select(u => new UsuarioResponseDto
        {
            Id = u.Id,
            Nombre = u.Nombre,
            Correo = u.Correo,
            Estado = u.Estado,
            RolId = u.RolId,
            RolNombre = u.Rol?.Nombre ?? "Sin Rol",
            Permisos = u.Rol?.RolPermisos?.Select(rp => rp.Permiso.Codigo).ToList() ?? new List<string>(),
            CreadoEn = u.CreadoEn
        }).ToList();
    }

    private async Task<RolResponseDto?> GetRolByIdAsync(byte id)
    {
        var rol = await _context.Roles
            .Include(r => r.RolPermisos)
            .ThenInclude(rp => rp.Permiso)
            .FirstOrDefaultAsync(r => r.Id == id);

        return rol == null ? null : MapToRolResponseDto(rol);
    }

    private static RolResponseDto MapToRolResponseDto(Rol r)
    {
        return new RolResponseDto
        {
            Id = r.Id,
            Nombre = r.Nombre,
            Descripcion = r.Descripcion,
            Permisos = r.RolPermisos.Select(rp => new PermisoDto
            {
                Id = rp.Permiso.Id,
                Codigo = rp.Permiso.Codigo,
                Nombre = rp.Permiso.Nombre,
                Descripcion = rp.Permiso.Descripcion
            }).ToList()
        };
    }
}
