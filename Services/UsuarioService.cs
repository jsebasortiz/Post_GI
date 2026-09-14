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
    Task<UsuarioResponseDto?> LoginAsync(LoginDto dto);
    Task<Usuario?> GetUsuarioByIdAsync(ulong id);
}

public class UsuarioService : IUsuarioService
{
    private readonly BlogDbContext _context;
    private readonly IActiveDirectoryService _adService;
    private readonly ILogger<UsuarioService> _logger;

    public UsuarioService(BlogDbContext context, IActiveDirectoryService adService, ILogger<UsuarioService> logger)
    {
        _context = context;
        _adService = adService;
        _logger = logger;
    }

    public async Task<List<UsuarioResponseDto>> GetUsuariosAsync()
    {
        return await _context.Usuarios
            .Select(u => new UsuarioResponseDto
            {
                Id = u.Id,
                Nombre = u.Nombre,
                Correo = u.Correo,
                Estado = u.Estado,
                CreadoEn = u.CreadoEn
            }).ToListAsync();
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
            CreadoEn = DateTime.UtcNow,
            ActualizadoEn = DateTime.UtcNow
        };

        _context.Usuarios.Add(usuario);
        await _context.SaveChangesAsync();

        return new UsuarioResponseDto
        {
            Id = usuario.Id,
            Nombre = usuario.Nombre,
            Correo = usuario.Correo,
            Estado = usuario.Estado,
            CreadoEn = usuario.CreadoEn
        };
    }

    public async Task<UsuarioResponseDto?> LoginAsync(LoginDto dto)
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
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Correo.ToLower() == searchEmail || u.Nombre.ToLower() == adUser.Username.ToLower());

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
                CreadoEn = DateTime.UtcNow,
                ActualizadoEn = DateTime.UtcNow
            };

            _context.Usuarios.Add(usuario);
            await _context.SaveChangesAsync();
        }
        else
        {
            // Actualizar nombre/fechas si es necesario
            usuario.ActualizadoEn = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        return new UsuarioResponseDto
        {
            Id = usuario.Id,
            Nombre = usuario.Nombre,
            Correo = usuario.Correo,
            Estado = usuario.Estado,
            CreadoEn = usuario.CreadoEn
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
