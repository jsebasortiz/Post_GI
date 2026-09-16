using BlogApp.Data;
using BlogApp.DTOs;
using BlogApp.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace BlogApp.Services;

public class AreaService : IAreaService
{
    private readonly BlogDbContext _context;

    public AreaService(BlogDbContext context)
    {
        _context = context;
    }

    public async Task<List<AreaResponseDto>> GetAreasAsync(bool soloActivas = true)
    {
        var query = _context.Areas.AsQueryable();
        if (soloActivas)
        {
            query = query.Where(a => a.EstadoId == 1);
        }

        return await query
            .OrderBy(a => a.Nombre)
            .Select(a => new AreaResponseDto
            {
                Id = a.Id,
                Codigo = a.Codigo,
                Nombre = a.Nombre,
                Descripcion = a.Descripcion,
                EstadoId = a.EstadoId,
                EstadoNombre = a.EstadoId == 1 ? "Activo" : "Inactivo",
                CreadoEn = a.CreadoEn
            })
            .ToListAsync();
    }

    public async Task<AreaResponseDto?> GetAreaByIdAsync(ushort id)
    {
        var area = await _context.Areas.FirstOrDefaultAsync(a => a.Id == id);
        if (area == null) return null;

        return new AreaResponseDto
        {
            Id = area.Id,
            Codigo = area.Codigo,
            Nombre = area.Nombre,
            Descripcion = area.Descripcion,
            EstadoId = area.EstadoId,
            EstadoNombre = area.EstadoId == 1 ? "Activo" : "Inactivo",
            CreadoEn = area.CreadoEn
        };
    }

    public async Task<AreaResponseDto> CreateAreaAsync(CreateAreaDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nombre))
            throw new ArgumentException("El nombre del área es requerido.");

        string nombreClean = dto.Nombre.Trim();
        string codigo = GenerateSlug(nombreClean);

        var existing = await _context.Areas.FirstOrDefaultAsync(a => a.Codigo == codigo);
        if (existing != null)
        {
            if (existing.EstadoId == 2)
            {
                // Re-activar área inactiva previa
                existing.EstadoId = 1;
                existing.Nombre = nombreClean;
                existing.Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim();
                await _context.SaveChangesAsync();
                return new AreaResponseDto
                {
                    Id = existing.Id,
                    Codigo = existing.Codigo,
                    Nombre = existing.Nombre,
                    Descripcion = existing.Descripcion,
                    EstadoId = existing.EstadoId,
                    EstadoNombre = "Activo",
                    CreadoEn = existing.CreadoEn
                };
            }
            throw new InvalidOperationException($"Ya existe un área activa registrada con el código/nombre '{nombreClean}'.");
        }

        var area = new Area
        {
            Codigo = codigo,
            Nombre = nombreClean,
            Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim(),
            EstadoId = 1,
            CreadoEn = DateTime.UtcNow
        };

        _context.Areas.Add(area);
        await _context.SaveChangesAsync();

        return new AreaResponseDto
        {
            Id = area.Id,
            Codigo = area.Codigo,
            Nombre = area.Nombre,
            Descripcion = area.Descripcion,
            EstadoId = area.EstadoId,
            EstadoNombre = "Activo",
            CreadoEn = area.CreadoEn
        };
    }

    public async Task<AreaResponseDto> UpdateAreaAsync(ushort id, UpdateAreaDto dto)
    {
        var area = await _context.Areas.FirstOrDefaultAsync(a => a.Id == id);
        if (area == null)
            throw new KeyNotFoundException("El área especificada no existe.");

        if (string.IsNullOrWhiteSpace(dto.Nombre))
            throw new ArgumentException("El nombre del área es requerido.");

        area.Nombre = dto.Nombre.Trim();
        area.Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim();

        await _context.SaveChangesAsync();

        return new AreaResponseDto
        {
            Id = area.Id,
            Codigo = area.Codigo,
            Nombre = area.Nombre,
            Descripcion = area.Descripcion,
            EstadoId = area.EstadoId,
            EstadoNombre = area.EstadoId == 1 ? "Activo" : "Inactivo",
            CreadoEn = area.CreadoEn
        };
    }

    public async Task<bool> InactivarAreaAsync(ushort id)
    {
        var area = await _context.Areas.FirstOrDefaultAsync(a => a.Id == id);
        if (area == null) return false;

        area.EstadoId = 2; // Borrado lógico (Inactivo)
        await _context.SaveChangesAsync();
        return true;
    }

    private static string GenerateSlug(string text)
    {
        string str = text.ToLowerInvariant().Trim();
        str = Regex.Replace(str, @"[áàäâ]", "a");
        str = Regex.Replace(str, @"[éèëê]", "e");
        str = Regex.Replace(str, @"[íìïî]", "i");
        str = Regex.Replace(str, @"[óòöô]", "o");
        str = Regex.Replace(str, @"[úùüû]", "u");
        str = Regex.Replace(str, @"[ñ]", "n");
        str = Regex.Replace(str, @"[^a-z0-9\s-]", "");
        str = Regex.Replace(str, @"\s+", " ").Trim();
        str = Regex.Replace(str, @"\s", "-");
        return str;
    }
}
