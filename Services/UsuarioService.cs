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
    Task<LoginResponseDto?> LoginWithMicrosoftAsync(MicrosoftLoginDto dto);
    Task<Usuario?> GetUsuarioByIdAsync(ulong id);
}

public class UsuarioService : IUsuarioService
{
    private readonly BlogDbContext _context;
    private readonly IMicrosoftAuthService _microsoftAuthService;
    private readonly IJwtService _jwtService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<UsuarioService> _logger;

    public UsuarioService(
        BlogDbContext context,
        IMicrosoftAuthService microsoftAuthService,
        IJwtService jwtService,
        IConfiguration configuration,
        ILogger<UsuarioService> logger)
    {
        _context = context;
        _microsoftAuthService = microsoftAuthService;
        _jwtService = jwtService;
        _configuration = configuration;
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

        string searchEmail = dto.Correo.ToLower().Trim();

        var usuario = await _context.Usuarios
            .Include(u => u.Rol)
            .ThenInclude(r => r!.RolPermisos)
            .ThenInclude(rp => rp.Permiso)
            .FirstOrDefaultAsync(u => u.Correo.ToLower() == searchEmail || u.Nombre.ToLower() == searchEmail);

        if (usuario == null)
        {
            _logger.LogWarning("Intento de inicio de sesión fallido para: {Correo} (Usuario no encontrado)", dto.Correo);
            return null;
        }

        // Si el usuario está registrado mediante Microsoft 365
        if (usuario.Password == "[M365_SSO]" || usuario.Password == "[AD_AUTHENTICATED]")
        {
            throw new InvalidOperationException("Esta cuenta institucional se autentica mediante Microsoft 365. Por favor haz clic en 'Iniciar Sesión con Microsoft 365'.");
        }

        // Validar contraseña con hash
        if (usuario.Password != HashPassword(dto.Password))
        {
            _logger.LogWarning("Contraseña incorrecta para usuario: {Correo}", dto.Correo);
            return null;
        }

        if (usuario.Estado.ToLower() != "activo")
        {
            throw new InvalidOperationException("Tu cuenta se encuentra inactiva o deshabilitada.");
        }

        usuario.ActualizadoEn = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var usuarioDto = MapToUsuarioDto(usuario);
        var token = _jwtService.GenerateToken(usuarioDto);

        return new LoginResponseDto
        {
            Token = token,
            Usuario = usuarioDto
        };
    }

    public async Task<LoginResponseDto?> LoginWithMicrosoftAsync(MicrosoftLoginDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.IdToken) && string.IsNullOrWhiteSpace(dto.AccessToken))
        {
            throw new ArgumentException("El token de Microsoft es requerido.");
        }

        var msUser = await _microsoftAuthService.AuthenticateAsync(dto.IdToken, dto.AccessToken);
        if (!msUser.IsAuthenticated)
        {
            _logger.LogWarning("Autenticación con Microsoft 365 fallida: {Error}", msUser.ErrorMessage);
            throw new InvalidOperationException(msUser.ErrorMessage ?? "Autenticación con Microsoft 365 fallida.");
        }

        // Validar restricción opcional de dominio institucional si está configurada (ej: centroaguas.com)
        var allowedDomain = _configuration["Microsoft365:AllowedDomain"];
        if (!string.IsNullOrWhiteSpace(allowedDomain))
        {
            var domainPart = msUser.Email.Contains('@') ? msUser.Email.Split('@')[1].ToLower() : "";
            if (!domainPart.Equals(allowedDomain.ToLower().Trim(), StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Acceso rechazado por dominio institucional: {Email} no coincide con @{Domain}", msUser.Email, allowedDomain);
                throw new InvalidOperationException($"Solo se permite el acceso a usuarios con correo institucional (@{allowedDomain}).");
            }
        }

        string searchEmail = msUser.Email.ToLower().Trim();

        var usuario = await _context.Usuarios
            .Include(u => u.Rol)
            .ThenInclude(r => r!.RolPermisos)
            .ThenInclude(rp => rp.Permiso)
            .FirstOrDefaultAsync(u => u.Correo.ToLower() == searchEmail);

        if (usuario == null)
        {
            _logger.LogInformation("Usuario autenticado en Microsoft 365 no existía en BD. Creando automáticamente registro para: {Email}", searchEmail);

            usuario = new Usuario
            {
                Nombre = string.IsNullOrWhiteSpace(msUser.DisplayName) ? searchEmail.Split('@')[0] : msUser.DisplayName,
                Correo = searchEmail,
                Password = "[M365_SSO]",
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
            if (usuario.Estado.ToLower() != "activo")
            {
                throw new InvalidOperationException("Tu cuenta de usuario se encuentra inactiva o deshabilitada en Prixma.");
            }

            if (!string.IsNullOrWhiteSpace(msUser.DisplayName) && usuario.Nombre != msUser.DisplayName)
            {
                usuario.Nombre = msUser.DisplayName;
            }

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
