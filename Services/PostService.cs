using BlogApp.Data;
using BlogApp.DTOs;
using BlogApp.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace BlogApp.Services;

public interface IPostService
{
    Task<PagedResultDto<PostResponseDto>> GetPostsAsync(ushort? moduloId = null, string? moduloSlug = null, string? categoriaPadre = null, byte? tipoId = null, byte? tipoConocimientoId = null, string? search = null, string? estado = "publicado", int page = 1, int pageSize = 10);
    Task<PostResponseDto?> GetPostBySlugAsync(string slug);
    Task<PostResponseDto?> GetPostByIdAsync(ulong id);
    Task<PostResponseDto> CreatePostAsync(CreatePostDto dto);
    Task<PostResponseDto?> UpdatePostAsync(ulong id, UpdatePostDto dto);
    Task<bool> DeletePostAsync(ulong id);
    Task<AdjuntoResponseDto?> AddAdjuntoToPostAsync(ulong postId, IFormFile file, bool esPortada = false);
    Task<bool> DeleteAdjuntoAsync(ulong adjuntoId);
    Task<bool> SetPortadaAsync(ulong adjuntoId);
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

    public async Task<PagedResultDto<PostResponseDto>> GetPostsAsync(ushort? moduloId = null, string? moduloSlug = null, string? categoriaPadre = null, byte? tipoId = null, byte? tipoConocimientoId = null, string? search = null, string? estado = "publicado", int page = 1, int pageSize = 10)
    {
        // Solo obtener publicaciones activas (estado_id = 1)
        var query = _context.Posts
            .Include(p => p.Usuario)
            .Include(p => p.Modulo).ThenInclude(m => m!.Area)
            .Include(p => p.Tipo)
            .Include(p => p.TipoConocimiento)
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

        if (tipoConocimientoId.HasValue)
        {
            query = query.Where(p => p.TipoConocimientoId == tipoConocimientoId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(p => p.Titulo.ToLower().Contains(term) || (p.Resumen != null && p.Resumen.ToLower().Contains(term)) || p.Contenido.ToLower().Contains(term) || (p.PalabrasClave != null && p.PalabrasClave.ToLower().Contains(term)));
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
            .Include(p => p.TipoConocimiento)
            .Include(p => p.Adjuntos)
            .FirstOrDefaultAsync(p => p.Slug == slug && p.EstadoId == 1);

        if (post == null) return null;

        return MapToResponseDto(post);
    }

    public async Task<PostResponseDto?> GetPostByIdAsync(ulong id)
    {
        var post = await _context.Posts
            .Include(p => p.Usuario)
            .Include(p => p.Modulo).ThenInclude(m => m!.Area)
            .Include(p => p.Tipo)
            .Include(p => p.TipoConocimiento)
            .Include(p => p.Adjuntos)
            .FirstOrDefaultAsync(p => p.Id == id && p.EstadoId == 1);

        if (post == null) return null;

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
            TipoConocimientoId = dto.TipoConocimientoId,
            PalabrasClave = dto.PalabrasClave,
            EstadoId = 1, // 1 = Activo
            Titulo = dto.Titulo,
            Slug = slug,
            Resumen = dto.Resumen,
            Contenido = dto.Contenido,
            Estado = "publicado",
            CreadoEn = DateTime.UtcNow,
            ActualizadoEn = DateTime.UtcNow
        };

        _context.Posts.Add(post);
        await _context.SaveChangesAsync();

        // Procesar archivos adjuntos si los hay
        if (dto.Archivos != null && dto.Archivos.Count > 0)
        {
            int? targetPortadaIdx = dto.PortadaIndex;
            if (targetPortadaIdx.HasValue && (targetPortadaIdx.Value < 0 || targetPortadaIdx.Value >= dto.Archivos.Count || !IsImageFile(dto.Archivos[targetPortadaIdx.Value].ContentType, dto.Archivos[targetPortadaIdx.Value].FileName)))
            {
                targetPortadaIdx = null;
            }

            if (!targetPortadaIdx.HasValue)
            {
                for (int i = 0; i < dto.Archivos.Count; i++)
                {
                    if (IsImageFile(dto.Archivos[i].ContentType, dto.Archivos[i].FileName))
                    {
                        targetPortadaIdx = i;
                        break;
                    }
                }
            }

            for (int i = 0; i < dto.Archivos.Count; i++)
            {
                var file = dto.Archivos[i];
                if (file.Length == 0) continue;

                var savedFile = await _fileStorage.SaveFileAsync(file, "posts");
                bool isImg = IsImageFile(savedFile.MimeType, savedFile.ArchivoNombreOriginal);
                bool esPortada = isImg && targetPortadaIdx.HasValue && (i == targetPortadaIdx.Value);

                var adjunto = new AdjuntoPost
                {
                    PostId = post.Id,
                    ArchivoUrl = savedFile.ArchivoUrl,
                    ArchivoNombreOriginal = savedFile.ArchivoNombreOriginal,
                    MimeType = savedFile.MimeType,
                    TamanioBytes = savedFile.TamanioBytes,
                    EsPortada = esPortada,
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
        post.TipoConocimientoId = dto.TipoConocimientoId;
        post.PalabrasClave = dto.PalabrasClave;
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
        bool isImg = IsImageFile(savedFile.MimeType, savedFile.ArchivoNombreOriginal);

        if (esPortada && isImg)
        {
            // Desmarcar portadas anteriores si esta nueva es una imagen
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
            EsPortada = esPortada && isImg,
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

    public async Task<bool> SetPortadaAsync(ulong adjuntoId)
    {
        var targetAdjunto = await _context.AdjuntosPost.FirstOrDefaultAsync(a => a.Id == adjuntoId && a.EstadoId == 1);
        if (targetAdjunto == null) return false;

        if (!IsImageFile(targetAdjunto.MimeType, targetAdjunto.ArchivoNombreOriginal))
            return false;

        var allPostAdjuntos = await _context.AdjuntosPost
            .Where(a => a.PostId == targetAdjunto.PostId && a.EstadoId == 1)
            .ToListAsync();

        foreach (var a in allPostAdjuntos)
        {
            a.EsPortada = (a.Id == targetAdjunto.Id);
        }

        await _context.SaveChangesAsync();
        return true;
    }


    private static bool IsImageFile(string? mimeType, string? fileName)
    {
        if (!string.IsNullOrEmpty(mimeType) && mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return true;

        if (!string.IsNullOrEmpty(fileName))
        {
            var ext = Path.GetExtension(fileName).ToLowerInvariant();
            return ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".webp" || ext == ".gif" || ext == ".svg";
        }
        return false;
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
        var portada = activeAdjuntos.FirstOrDefault(a => a.EsPortada && IsImageFile(a.MimeType, a.ArchivoNombreOriginal)) 
                      ?? activeAdjuntos.FirstOrDefault(a => IsImageFile(a.MimeType, a.ArchivoNombreOriginal));

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
            TipoConocimientoId = post.TipoConocimientoId,
            TipoConocimientoNombre = post.TipoConocimiento?.Nombre,
            PalabrasClave = post.PalabrasClave,
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
                EsPortada = a.EsPortada && IsImageFile(a.MimeType, a.ArchivoNombreOriginal),
                EstadoId = a.EstadoId,
                CreadoEn = a.CreadoEn
            }).ToList()
        };
    }
}

