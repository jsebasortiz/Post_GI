using BlogApp.Data;
using BlogApp.DTOs;
using BlogApp.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace BlogApp.Services;

public interface IModuloService
{
    Task<List<Modulo>> GetModulosAsync();
    Task<Modulo?> GetModuloByIdAsync(ushort id);
    Task<Modulo> CreateModuloAsync(CreateModuloDto dto);
    Task<List<PostTipo>> GetPostTiposAsync();
    Task<PostTipo> CreatePostTipoAsync(CreatePostTipoDto dto);
}

public class ModuloService : IModuloService
{
    private readonly BlogDbContext _context;

    public ModuloService(BlogDbContext context)
    {
        _context = context;
    }

    public async Task<List<Modulo>> GetModulosAsync()
    {
        return await _context.Modulos.OrderBy(m => m.Nombre).ToListAsync();
    }

    public async Task<Modulo?> GetModuloByIdAsync(ushort id)
    {
        return await _context.Modulos.FindAsync(id);
    }

    public async Task<Modulo> CreateModuloAsync(CreateModuloDto dto)
    {
        string slug = Slugify(dto.Nombre);
        var modulo = new Modulo
        {
            Nombre = dto.Nombre,
            Slug = slug,
            Descripcion = dto.Descripcion,
            Estado = true,
            CreadoEn = DateTime.UtcNow
        };

        _context.Modulos.Add(modulo);
        await _context.SaveChangesAsync();
        return modulo;
    }

    public async Task<List<PostTipo>> GetPostTiposAsync()
    {
        return await _context.PostTipos.OrderBy(pt => pt.Nombre).ToListAsync();
    }

    public async Task<PostTipo> CreatePostTipoAsync(CreatePostTipoDto dto)
    {
        var tipo = new PostTipo
        {
            Nombre = dto.Nombre,
            Descripcion = dto.Descripcion,
            CreadoEn = DateTime.UtcNow
        };

        _context.PostTipos.Add(tipo);
        await _context.SaveChangesAsync();
        return tipo;
    }

    private static string Slugify(string phrase)
    {
        string str = phrase.ToLowerInvariant();
        str = Regex.Replace(str, @"[áàäâ]", "a");
        str = Regex.Replace(str, @"[éèëê]", "e");
        str = Regex.Replace(str, @"[íìïî]", "i");
        str = Regex.Replace(str, @"[óòöô]", "o");
        str = Regex.Replace(str, @"[úùüû]", "u");
        str = Regex.Replace(str, @"[ñ]", "n");
        str = Regex.Replace(str, @"[^a-z0-9\s-]", "");
        str = Regex.Replace(str, @"\s+", "-").Trim('-');
        return string.IsNullOrEmpty(str) ? "modulo" : str;
    }
}
