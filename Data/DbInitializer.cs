using BlogApp.Models;
using Microsoft.EntityFrameworkCore;

namespace BlogApp.Data;

public static class DbInitializer
{
    public static async Task SeedAsync(BlogDbContext context)
    {
        try
        {
            await context.Database.EnsureCreatedAsync();

            // Seed PostTipo con IDs explícitos (byte)
            if (!await context.PostTipos.AnyAsync())
            {
                context.PostTipos.Add(new PostTipo { Id = 1, Nombre = "Noticia", Descripcion = "Artículos de novedades y noticias de actualidad" });
                context.PostTipos.Add(new PostTipo { Id = 2, Nombre = "Tutorial", Descripcion = "Guías paso a paso y tutoriales prácticos" });
                context.PostTipos.Add(new PostTipo { Id = 3, Nombre = "Opinión", Descripcion = "Artículos de opinión y análisis personal" });
                context.PostTipos.Add(new PostTipo { Id = 4, Nombre = "Guía", Descripcion = "Documentación técnica y guías detalladas" });
                await context.SaveChangesAsync();
            }

            // Seed Modulo con IDs explícitos (ushort)
            if (!await context.Modulos.AnyAsync())
            {
                context.Modulos.Add(new Modulo { Id = 1, Nombre = "Tecnología", Slug = "tecnologia", Descripcion = "Módulo de desarrollo, innovación y gadgets", Estado = true });
                context.Modulos.Add(new Modulo { Id = 2, Nombre = "Programación", Slug = "programacion", Descripcion = "Módulo enfocado en C#, .NET, Python y arquitecturas", Estado = true });
                context.Modulos.Add(new Modulo { Id = 3, Nombre = "Estilo de Vida", Slug = "estilo-de-vida", Descripcion = "Módulo de desarrollo personal y cultura digital", Estado = true });
                context.Modulos.Add(new Modulo { Id = 4, Nombre = "General", Slug = "general", Descripcion = "Categoría general para publicaciones variadas", Estado = true });
                await context.SaveChangesAsync();
            }

            // Seed Usuario demo
            if (!await context.Usuarios.AnyAsync())
            {
                var adminUser = new Usuario
                {
                    Id = 1,
                    Nombre = "Administrador",
                    Correo = "admin@blogapp.com",
                    Password = Convert.ToBase64String(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes("Admin123!BlogAppSaltKey"))),
                    Estado = "activo",
                    CreadoEn = DateTime.UtcNow,
                    ActualizadoEn = DateTime.UtcNow
                };
                context.Usuarios.Add(adminUser);
                await context.SaveChangesAsync();

                var tecModulo = await context.Modulos.FirstOrDefaultAsync(m => m.Slug == "tecnologia");
                var tutTipo = await context.PostTipos.FirstOrDefaultAsync(t => t.Nombre == "Tutorial");

                if (tecModulo != null && tutTipo != null)
                {
                    var postDemo = new Post
                    {
                        Id = 1,
                        UsuarioId = adminUser.Id,
                        ModuloId = tecModulo.Id,
                        TipoId = tutTipo.Id,
                        Titulo = "Bienvenidos al Sistema de Blogs en .NET 10",
                        Slug = "bienvenidos-al-sistema-de-blogs-en-net-10",
                        Resumen = "Primer artículo demostrativo creado automáticamente con soporte para archivos adjuntos e imágenes de portada.",
                        Contenido = "Este es un blog completo desarrollado con ASP.NET Core en .NET 10. Permite crear publicaciones por módulo, categorizarlas por tipo de post, subir múltiples fotos o adjuntos y gestionar imágenes de portada.",
                        Estado = "publicado",
                        Visitas = 12,
                        CreadoEn = DateTime.UtcNow,
                        ActualizadoEn = DateTime.UtcNow
                    };
                    context.Posts.Add(postDemo);
                    await context.SaveChangesAsync();
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DbInitializer] Error al sembrar datos: {ex.Message}");
        }
    }
}
