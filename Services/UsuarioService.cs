using BlogApp.Data;
using BlogApp.DTOs;
using BlogApp.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace BlogApp.Services;

public interface IUsuarioService
{
    Task<List<UsuarioResponseDto>> GetUsuariosAsync();
    Task<UsuarioResponseDto?> RegisterAsync(CreateUsuarioDto dto);
    Task<LoginResponseDto?> LoginAsync(LoginDto dto);
    Task<Usuario?> GetUsuarioByIdAsync(ulong id);
}

public class UsuarioService : IUsuarioService
{
    private readonly BlogDbContext _context;
    private readonly IActiveDirectoryService _adService;
    private readonly IJwtService _jwtService;
    private readonly ILogger<UsuarioService> _logger;

    public UsuarioService(BlogDbContext context, IActiveDirectoryService adService, IJwtService jwtService, ILogger<UsuarioService> logger)
    {
        _context = context;
        _adService = adService;
        _jwtService = jwtService;
        _logger = logger;
    }

    public async Task<List<UsuarioResponseDto>> GetUsuariosAsync()
    {
        var usuarios = await _context.Usuarios
            .Include(u => u.Rol)
            .ThenInclude(r => r!.RolPermisos)
            .ThenInclude(rp => rp.Permiso)
            .ToListAsync();

        return usuarios.Select(MapToUsuarioDto).ToList();
    }

    public async Task<UsuarioResponseDto?> RegisterAsync(CreateUsuarioDto dto)
    {
        if (await _context.Usuarios.AnyAsync(u => u.Correo.ToLower() == dto.Correo.ToLower()))
        {
            throw new InvalidOperationException("El correo electrónico ya está registrado en la base de datos.");
        }

        var usuario = new Usuario
        {
            Nombre = dto.Nombre,
            Correo = dto.Correo.ToLower(),
            Password = HashPassword(dto.Password),
            Estado = "activo",
            RolId = 3, // Rol Lector por defecto
            CreadoEn = DateTime.UtcNow,
            ActualizadoEn = DateTime.UtcNow
        };

        _context.Usuarios.Add(usuario);
        await _context.SaveChangesAsync();

        var loaded = await _context.Usuarios
            .Include(u => u.Rol)
            .ThenInclude(r => r!.RolPermisos)
            .ThenInclude(rp => rp.Permiso)
            .FirstOrDefaultAsync(u => u.Id == usuario.Id);

        return loaded == null ? null : MapToUsuarioDto(loaded);
    }

    public async Task<LoginResponseDto?> LoginAsync(LoginDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Correo) || string.IsNullOrWhiteSpace(dto.Password))
        {
            return null;
        }

        // 1. Validar existencia y credenciales en el Directorio Activo (LDAP)
        var adUser = await _adService.AuthenticateAsync(dto.Correo, dto.Password);
        if (!adUser.IsAuthenticated)
        {
            _logger.LogWarning("Intento de inicio de sesión fallido en Directorio Activo para: {Correo}", dto.Correo);
            return null;
        }

        // 2. Si existe en el Directorio Activo, verificar existencia en la BD MySQL local
        string searchEmail = string.IsNullOrWhiteSpace(adUser.Email) ? dto.Correo.ToLower() : adUser.Email.ToLower();
        var usuario = await _context.Usuarios
            .Include(u => u.Rol)
            .ThenInclude(r => r!.RolPermisos)
            .ThenInclude(rp => rp.Permiso)
            .FirstOrDefaultAsync(u => u.Correo.ToLower() == searchEmail || u.Nombre.ToLower() == adUser.Username.ToLower());

        if (usuario == null)
        {
            // 3. Si no existe en la base de datos, crearlo automáticamente
            _logger.LogInformation("Usuario autenticado en AD no existía en BD. Creando automáticamente registro para: {Email}", searchEmail);

            usuario = new Usuario
            {
                Nombre = string.IsNullOrWhiteSpace(adUser.DisplayName) ? adUser.Username : adUser.DisplayName,
                Correo = searchEmail,
                Password = "[AD_AUTHENTICATED]",
                Estado = "activo",
                RolId = 3, // Rol Lector por defecto
                CreadoEn = DateTime.UtcNow,
                ActualizadoEn = DateTime.UtcNow
            };

            _context.Usuarios.Add(usuario);
            await _context.SaveChangesAsync();

            usuario = await _context.Usuarios
                .Include(u => u.Rol)
                .ThenInclude(r => r!.RolPermisos)
                .ThenInclude(rp => rp.Permiso)
                .FirstOrDefaultAsync(u => u.Id == usuario.Id);
        }
        else
        {
            usuario.ActualizadoEn = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        var usuarioDto = MapToUsuarioDto(usuario!);
        var token = _jwtService.GenerateToken(usuarioDto);

        return new LoginResponseDto
        {
            Token = token,
            Usuario = usuarioDto
        };
    }

    private static UsuarioResponseDto MapToUsuarioDto(Usuario u)
    {
        return new UsuarioResponseDto
        {
            Id = u.Id,
            Nombre = u.Nombre,
            Correo = u.Correo,
            Estado = u.Estado,
            RolId = u.RolId,
            RolNombre = u.Rol?.Nombre ?? "Sin Rol",
            Permisos = u.Rol?.RolPermisos?.Select(rp => rp.Permiso.Codigo).ToList() ?? new List<string>(),
            CreadoEn = u.CreadoEn
        };
    }

    public async Task<Usuario?> GetUsuarioByIdAsync(ulong id)
    {
        return await _context.Usuarios.FindAsync(id);
    }

    private static string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password + "BlogAppSaltKey"));
        return Convert.ToBase64String(bytes);
    }
}
