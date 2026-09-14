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

    public UsuarioService(BlogDbContext context)
    {
        _context = context;
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
            throw new InvalidOperationException("El correo electrónico ya está registrado.");
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
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Correo.ToLower() == dto.Correo.ToLower());
        if (usuario == null) return null;

        if (!VerifyPassword(dto.Password, usuario.Password))
        {
            return null;
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

    private static bool VerifyPassword(string password, string storedHash)
    {
        var hash = HashPassword(password);
        return hash == storedHash;
    }
}
