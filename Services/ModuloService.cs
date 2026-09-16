using BlogApp.Data;
using BlogApp.DTOs;
using BlogApp.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace BlogApp.Services;

public interface IModuloService
{
    Task<List<Modulo>> GetModulosAsync(string? categoriaPadre = null, bool soloActivos = true);
    Task<Modulo?> GetModuloByIdAsync(ushort id);
    Task<Modulo> CreateModuloAsync(CreateModuloDto dto);
    Task<Modulo> UpdateModuloAsync(ushort id, UpdateModuloDto dto);
    Task<bool> InactivarModuloAsync(ushort id);
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

    public async Task<List<Modulo>> GetModulosAsync(string? categoriaPadre = null, bool soloActivos = true)
    {
        var query = _context.Modulos.Include(m => m.Area).AsQueryable();

        if (soloActivos)
        {
            query = query.Where(m => m.EstadoId == 1);
        }

        if (!string.IsNullOrWhiteSpace(categoriaPadre))
        {
            query = query.Where(m => m.Area != null && m.Area.Codigo.ToLower() == categoriaPadre.Trim().ToLower());
        }

        return await query.OrderBy(m => m.Nombre).ToListAsync();
    }

    public async Task<Modulo?> GetModuloByIdAsync(ushort id)
    {
        return await _context.Modulos.Include(m => m.Area).FirstOrDefaultAsync(m => m.Id == id);
    }

    public async Task<Modulo> CreateModuloAsync(CreateModuloDto dto)
    {
        string slug = Slugify(dto.Nombre);
        string cat = string.IsNullOrWhiteSpace(dto.CategoriaPadre) ? "apps" : dto.CategoriaPadre.Trim().ToLower();

        var areaObj = await _context.Areas.FirstOrDefaultAsync(a => a.Codigo.ToLower() == cat);
        ushort areaId = areaObj?.Id ?? 1;

        var modulo = new Modulo
        {
            Nombre = dto.Nombre,
            Slug = slug,
            AreaId = areaId,
            Descripcion = dto.Descripcion,
            EstadoId = 1,
            CreadoEn = DateTime.UtcNow
        };

        _context.Modulos.Add(modulo);
        await _context.SaveChangesAsync();
        modulo.Area = areaObj;
        return modulo;
    }

    public async Task<Modulo> UpdateModuloAsync(ushort id, UpdateModuloDto dto)
    {
        var modulo = await _context.Modulos.Include(m => m.Area).FirstOrDefaultAsync(m => m.Id == id);
        if (modulo == null)
            throw new KeyNotFoundException("El módulo especificado no existe.");

        if (string.IsNullOrWhiteSpace(dto.Nombre))
            throw new ArgumentException("El nombre del módulo es requerido.");

        string cat = string.IsNullOrWhiteSpace(dto.CategoriaPadre) ? "apps" : dto.CategoriaPadre.Trim().ToLower();
        var areaObj = await _context.Areas.FirstOrDefaultAsync(a => a.Codigo.ToLower() == cat);
        ushort areaId = areaObj?.Id ?? 1;

        modulo.Nombre = dto.Nombre.Trim();
        modulo.Slug = Slugify(dto.Nombre);
        modulo.AreaId = areaId;
        modulo.Area = areaObj;
        modulo.Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim();

        await _context.SaveChangesAsync();
        return modulo;
    }

    public async Task<bool> InactivarModuloAsync(ushort id)
    {
        var modulo = await _context.Modulos.FirstOrDefaultAsync(m => m.Id == id);
        if (modulo == null) return false;

        modulo.EstadoId = 2;
        await _context.SaveChangesAsync();
        return true;
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
