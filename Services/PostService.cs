using BlogApp.Data;
using BlogApp.DTOs;
using BlogApp.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace BlogApp.Services;

public interface IPostService
{
    Task<PagedResultDto<PostResponseDto>> GetPostsAsync(ushort? moduloId = null, string? moduloSlug = null, string? categoriaPadre = null, byte? tipoId = null, string? search = null, string? estado = "publicado", int page = 1, int pageSize = 10);
    Task<PostResponseDto?> GetPostBySlugAsync(string slug);
    Task<PostResponseDto?> GetPostByIdAsync(ulong id);
    Task<PostResponseDto> CreatePostAsync(CreatePostDto dto);
    Task<PostResponseDto?> UpdatePostAsync(ulong id, UpdatePostDto dto);
    Task<bool> DeletePostAsync(ulong id);
    Task<AdjuntoResponseDto?> AddAdjuntoToPostAsync(ulong postId, IFormFile file, bool esPortada = false);
    Task<bool> DeleteAdjuntoAsync(ulong adjuntoId);
}

public class PostService : IPostService
{
    private readonly BlogDbContext _context;
    private readonly IFileStorageService _fileStorage;

    public PostService(BlogDbContext context, IFileStorageService fileStorage)
    {
        _context = context;
        _fileStorage = fileStorage;
    }

    public async Task<PagedResultDto<PostResponseDto>> GetPostsAsync(ushort? moduloId = null, string? moduloSlug = null, string? categoriaPadre = null, byte? tipoId = null, string? search = null, string? estado = "publicado", int page = 1, int pageSize = 10)
    {
        // Solo obtener publicaciones activas (estado_id = 1)
        var query = _context.Posts
            .Include(p => p.Usuario)
            .Include(p => p.Modulo).ThenInclude(m => m!.Area)
            .Include(p => p.Tipo)
            .Include(p => p.Adjuntos)
            .AsNoTracking()
            .Where(p => p.EstadoId == 1);

        if (moduloId.HasValue)
        {
            query = query.Where(p => p.ModuloId == moduloId.Value);
        }

        if (!string.IsNullOrWhiteSpace(moduloSlug))
        {
            query = query.Where(p => p.Modulo != null && p.Modulo.Slug == moduloSlug);
        }

        if (!string.IsNullOrWhiteSpace(categoriaPadre))
        {
            query = query.Where(p => p.Modulo != null && p.Modulo.Area != null && p.Modulo.Area.Codigo.ToLower() == categoriaPadre.Trim().ToLower());
        }

        if (tipoId.HasValue)
        {
            query = query.Where(p => p.TipoId == tipoId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(p => p.Titulo.ToLower().Contains(term) || (p.Resumen != null && p.Resumen.ToLower().Contains(term)) || p.Contenido.ToLower().Contains(term));
        }

        int totalItems = await query.CountAsync();

        var posts = await query
            .OrderByDescending(p => p.CreadoEn)
            .Skip((Math.Max(1, page) - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = posts.Select(MapToResponseDto).ToList();

        return new PagedResultDto<PostResponseDto>
        {
            Items = items,
            TotalItems = totalItems,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<PostResponseDto?> GetPostBySlugAsync(string slug)
    {
        var post = await _context.Posts
            .Include(p => p.Usuario)
            .Include(p => p.Modulo).ThenInclude(m => m!.Area)
            .Include(p => p.Tipo)
            .Include(p => p.Adjuntos)
            .FirstOrDefaultAsync(p => p.Slug == slug && p.EstadoId == 1);

        if (post == null) return null;

        // Incrementar visitas
        post.Visitas++;
        await _context.SaveChangesAsync();

        return MapToResponseDto(post);
    }

    public async Task<PostResponseDto?> GetPostByIdAsync(ulong id)
    {
        var post = await _context.Posts
            .Include(p => p.Usuario)
            .Include(p => p.Modulo).ThenInclude(m => m!.Area)
            .Include(p => p.Tipo)
            .Include(p => p.Adjuntos)
            .FirstOrDefaultAsync(p => p.Id == id && p.EstadoId == 1);

        if (post == null) return null;

        // Incrementar contador de visitas en BD al consultar la publicación
        post.Visitas++;
        await _context.SaveChangesAsync();

        return MapToResponseDto(post);
    }

    public async Task<PostResponseDto> CreatePostAsync(CreatePostDto dto)
    {
        var slug = await GenerateUniqueSlugAsync(dto.Titulo);

        var post = new Post
        {
            UsuarioId = dto.UsuarioId,
            ModuloId = dto.ModuloId,
            TipoId = dto.TipoId,
            EstadoId = 1, // 1 = Activo
            Titulo = dto.Titulo,
            Slug = slug,
            Resumen = dto.Resumen,
            Contenido = dto.Contenido,
            Estado = "publicado",
            Visitas = 0,
            CreadoEn = DateTime.UtcNow,
            ActualizadoEn = DateTime.UtcNow
        };

        _context.Posts.Add(post);
        await _context.SaveChangesAsync();

        // Procesar archivos adjuntos si los hay
        if (dto.Archivos != null && dto.Archivos.Count > 0)
        {
            int portadaIdx = dto.PortadaIndex ?? 0;
            for (int i = 0; i < dto.Archivos.Count; i++)
            {
                var file = dto.Archivos[i];
                if (file.Length == 0) continue;

                var savedFile = await _fileStorage.SaveFileAsync(file, "posts");
                var adjunto = new AdjuntoPost
                {
                    PostId = post.Id,
                    ArchivoUrl = savedFile.ArchivoUrl,
                    ArchivoNombreOriginal = savedFile.ArchivoNombreOriginal,
                    MimeType = savedFile.MimeType,
                    TamanioBytes = savedFile.TamanioBytes,
                    EsPortada = (i == portadaIdx),
                    CreadoEn = DateTime.UtcNow
                };
                _context.AdjuntosPost.Add(adjunto);
            }

            await _context.SaveChangesAsync();
        }

        return (await GetPostByIdAsync(post.Id))!;
    }

    public async Task<PostResponseDto?> UpdatePostAsync(ulong id, UpdatePostDto dto)
    {
        var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == id && p.EstadoId == 1);
        if (post == null) return null;

        if (post.Titulo != dto.Titulo)
        {
            post.Titulo = dto.Titulo;
            post.Slug = await GenerateUniqueSlugAsync(dto.Titulo, post.Id);
        }

        post.ModuloId = dto.ModuloId;
        post.TipoId = dto.TipoId;
        post.Resumen = dto.Resumen;
        post.Contenido = dto.Contenido;
        post.Estado = dto.Estado;
        post.ActualizadoEn = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return await GetPostByIdAsync(id);
    }

    public async Task<bool> DeletePostAsync(ulong id)
    {
        var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == id);
        if (post == null) return false;

        // Eliminación Lógica: Cambiar estado_id de 1 (Activo) a 2 (Inactivo)
        post.EstadoId = 2; // 2 = Inactivo
        post.ActualizadoEn = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<AdjuntoResponseDto?> AddAdjuntoToPostAsync(ulong postId, IFormFile file, bool esPortada = false)
    {
        var post = await _context.Posts.Include(p => p.Adjuntos).FirstOrDefaultAsync(p => p.Id == postId);
        if (post == null) return null;

        var savedFile = await _fileStorage.SaveFileAsync(file, "posts");

        if (esPortada)
        {
            // Desmarcar portadas anteriores si esta será la portada principal
            foreach (var a in post.Adjuntos)
            {
                a.EsPortada = false;
            }
        }

        var adjunto = new AdjuntoPost
        {
            PostId = postId,
            ArchivoUrl = savedFile.ArchivoUrl,
            ArchivoNombreOriginal = savedFile.ArchivoNombreOriginal,
            MimeType = savedFile.MimeType,
            TamanioBytes = savedFile.TamanioBytes,
            EsPortada = esPortada,
            CreadoEn = DateTime.UtcNow
        };

        _context.AdjuntosPost.Add(adjunto);
        await _context.SaveChangesAsync();

        return new AdjuntoResponseDto
        {
            Id = adjunto.Id,
            PostId = adjunto.PostId,
            ArchivoUrl = adjunto.ArchivoUrl,
            ArchivoNombreOriginal = adjunto.ArchivoNombreOriginal,
            MimeType = adjunto.MimeType,
            TamanioBytes = adjunto.TamanioBytes,
            EsPortada = adjunto.EsPortada,
            CreadoEn = adjunto.CreadoEn
        };
    }

    public async Task<bool> DeleteAdjuntoAsync(ulong adjuntoId)
    {
        var adjunto = await _context.AdjuntosPost.FirstOrDefaultAsync(a => a.Id == adjuntoId);
        if (adjunto == null) return false;

        // Borrado lógico del archivo adjunto (EstadoId = 2: Inactivo)
        adjunto.EstadoId = 2;
        adjunto.EsPortada = false;
        await _context.SaveChangesAsync();
        return true;
    }

    private async Task<string> GenerateUniqueSlugAsync(string title, ulong? excludeId = null)
    {
        string baseSlug = Slugify(title);
        string slug = baseSlug;
        int count = 1;

        while (await _context.Posts.AnyAsync(p => p.Slug == slug && (!excludeId.HasValue || p.Id != excludeId.Value)))
        {
            slug = $"{baseSlug}-{count}";
            count++;
        }

        return slug;
    }

    private static string Slugify(string phrase)
    {
        string str = phrase.ToLowerInvariant();
        // Quitar acentos
        str = Regex.Replace(str, @"[áàäâ]", "a");
        str = Regex.Replace(str, @"[éèëê]", "e");
        str = Regex.Replace(str, @"[íìïî]", "i");
        str = Regex.Replace(str, @"[óòöô]", "o");
        str = Regex.Replace(str, @"[úùüû]", "u");
        str = Regex.Replace(str, @"[ñ]", "n");
        // Quitar caracteres no alfanuméricos
        str = Regex.Replace(str, @"[^a-z0-9\s-]", "");
        // Convertir múltiples espacios o guiones en un solo guión
        str = Regex.Replace(str, @"\s+", "-").Trim('-');
        return string.IsNullOrEmpty(str) ? "post" : str;
    }

    private static PostResponseDto MapToResponseDto(Post post)
    {
        // Filtrar solo los adjuntos con EstadoId == 1 (Activos)
        var activeAdjuntos = post.Adjuntos.Where(a => a.EstadoId == 1).ToList();
        var portada = activeAdjuntos.FirstOrDefault(a => a.EsPortada) ?? activeAdjuntos.FirstOrDefault();

        return new PostResponseDto
        {
            Id = post.Id,
            UsuarioId = post.UsuarioId,
            UsuarioNombre = post.Usuario?.Nombre ?? "Anónimo",
            ModuloId = post.ModuloId,
            ModuloNombre = post.Modulo?.Nombre ?? "General",
            ModuloSlug = post.Modulo?.Slug ?? "general",
            ModuloCategoriaPadre = post.Modulo?.Area?.Codigo ?? "apps",
            TipoId = post.TipoId,
            TipoNombre = post.Tipo?.Nombre ?? "Noticia",
            EstadoId = post.EstadoId,
            EstadoNombre = post.EstadoId == 1 ? "Activo" : "Inactivo",
            Titulo = post.Titulo,
            Slug = post.Slug,
            Resumen = post.Resumen,
            Contenido = post.Contenido,
            Estado = post.Estado,
            Visitas = post.Visitas,
            CreadoEn = post.CreadoEn,
            ActualizadoEn = post.ActualizadoEn,
            PortadaUrl = portada?.ArchivoUrl,
            Adjuntos = activeAdjuntos.Select(a => new AdjuntoResponseDto
            {
                Id = a.Id,
                PostId = a.PostId,
                ArchivoUrl = a.ArchivoUrl,
                ArchivoNombreOriginal = a.ArchivoNombreOriginal,
                MimeType = a.MimeType,
                TamanioBytes = a.TamanioBytes,
                EsPortada = a.EsPortada,
                EstadoId = a.EstadoId,
                CreadoEn = a.CreadoEn
            }).ToList()
        };
    }
}
