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

            // Seed PostEstado (1 = Activo, 2 = Inactivo)
            if (!await context.PostEstados.AnyAsync())
            {
                context.PostEstados.Add(new PostEstado { Id = 1, Nombre = "Activo", Descripcion = "Publicación activa visible en el portal" });
                context.PostEstados.Add(new PostEstado { Id = 2, Nombre = "Inactivo", Descripcion = "Publicación eliminada lógicamente" });
                await context.SaveChangesAsync();
            }

            // Asegurar columna estado_id en adjunto_post para borrado lógico
            try
            {
                await context.Database.ExecuteSqlRawAsync("ALTER TABLE `adjunto_post` ADD COLUMN `estado_id` INT NOT NULL DEFAULT 1;");
            }
            catch
            {
                // Ignorar si la columna ya existe en la base de datos
            }

            // Seed PostTipo con IDs explícitos (byte)
            if (!await context.PostTipos.AnyAsync())
            {
                context.PostTipos.Add(new PostTipo { Id = 1, Nombre = "Noticia", Descripcion = "Artículos de novedades y noticias de actualidad" });
                context.PostTipos.Add(new PostTipo { Id = 2, Nombre = "Tutorial", Descripcion = "Guías paso a paso y tutoriales prácticos" });
                context.PostTipos.Add(new PostTipo { Id = 3, Nombre = "Opinión", Descripcion = "Artículos de opinión y análisis personal" });
                context.PostTipos.Add(new PostTipo { Id = 4, Nombre = "Guía", Descripcion = "Documentación técnica y guías detalladas" });
                await context.SaveChangesAsync();
            }

            // Seed Modulo con CategoriaPadre (Apps e Infraestructura)
            if (!await context.Modulos.AnyAsync())
            {
                // Submódulos de Apps
                context.Modulos.Add(new Modulo { Id = 1, Nombre = "Portales Web", Slug = "portales-web", CategoriaPadre = "apps", Descripcion = "Aplicaciones web institucionales y portales de servicios", Estado = true });
                context.Modulos.Add(new Modulo { Id = 2, Nombre = "Desarrollo & APIs", Slug = "desarrollo-apis", CategoriaPadre = "apps", Descripcion = "Desarrollo de software, C#, .NET, microservicios y APIs", Estado = true });
                context.Modulos.Add(new Modulo { Id = 3, Nombre = "ERP / CRM", Slug = "erp-crm", CategoriaPadre = "apps", Descripcion = "Sistemas corporativos de gestión empresarial y clientes", Estado = true });
                context.Modulos.Add(new Modulo { Id = 4, Nombre = "Sistemas Internos", Slug = "sistemas-internos", CategoriaPadre = "apps", Descripcion = "Herramientas de automatización y aplicaciones internas", Estado = true });

                // Submódulos de Infraestructura
                context.Modulos.Add(new Modulo { Id = 5, Nombre = "Servidores & Cloud", Slug = "servidores-cloud", CategoriaPadre = "infraestructura", Descripcion = "Servidores virtuales, Azure, Docker y cloud computing", Estado = true });
                context.Modulos.Add(new Modulo { Id = 6, Nombre = "Redes & Comunicaciones", Slug = "redes-comunicaciones", CategoriaPadre = "infraestructura", Descripcion = "Conectividad, switches, firewalls, VPN y enlaces", Estado = true });
                context.Modulos.Add(new Modulo { Id = 7, Nombre = "Seguridad AD / LDAP", Slug = "seguridad-ad-ldap", CategoriaPadre = "infraestructura", Descripcion = "Directorio Activo, políticas de grupo, accesos e identidades", Estado = true });
                context.Modulos.Add(new Modulo { Id = 8, Nombre = "Bases de Datos", Slug = "bases-de-datos", CategoriaPadre = "infraestructura", Descripcion = "Administración, respaldos y optimización de SQL Server / MySQL", Estado = true });
                await context.SaveChangesAsync();
            }

            // Seed Roles
            if (!await context.Roles.AnyAsync())
            {
                context.Roles.Add(new Rol { Id = 1, Nombre = "Administrador", Descripcion = "Acceso total al sistema, creación de contenido y administración de seguridad" });
                context.Roles.Add(new Rol { Id = 2, Nombre = "Editor", Descripcion = "Creación y edición de artículos y módulos temáticos" });
                context.Roles.Add(new Rol { Id = 3, Nombre = "Lector", Descripcion = "Acceso de solo lectura para visualizar artículos" });
                await context.SaveChangesAsync();
            }

            // Seed Permisos
            if (!await context.Permisos.AnyAsync())
            {
                context.Permisos.Add(new Permiso { Id = 1, Codigo = "posts.create", Nombre = "Crear Publicaciones", Descripcion = "Permite crear nuevos blogs y subir archivos adjuntos" });
                context.Permisos.Add(new Permiso { Id = 2, Codigo = "posts.edit", Nombre = "Editar Publicaciones", Descripcion = "Permite modificar publicaciones existentes" });
                context.Permisos.Add(new Permiso { Id = 3, Codigo = "posts.delete", Nombre = "Eliminar Publicaciones", Descripcion = "Permite eliminar publicaciones" });
                context.Permisos.Add(new Permiso { Id = 4, Codigo = "modulos.create", Nombre = "Crear Módulos", Descripcion = "Permite registrar nuevos módulos temáticos" });
                context.Permisos.Add(new Permiso { Id = 5, Codigo = "roles.manage", Nombre = "Gestionar Roles & Permisos", Descripcion = "Acceso al panel de administración de roles y permisos" });
                await context.SaveChangesAsync();
            }

            // Seed RolPermisos
            if (!await context.RolPermisos.AnyAsync())
            {
                // Administrador (Rol 1) tiene todos los permisos
                context.RolPermisos.Add(new RolPermiso { RolId = 1, PermisoId = 1 });
                context.RolPermisos.Add(new RolPermiso { RolId = 1, PermisoId = 2 });
                context.RolPermisos.Add(new RolPermiso { RolId = 1, PermisoId = 3 });
                context.RolPermisos.Add(new RolPermiso { RolId = 1, PermisoId = 4 });
                context.RolPermisos.Add(new RolPermiso { RolId = 1, PermisoId = 5 });

                // Editor (Rol 2) puede crear/editar posts y módulos
                context.RolPermisos.Add(new RolPermiso { RolId = 2, PermisoId = 1 });
                context.RolPermisos.Add(new RolPermiso { RolId = 2, PermisoId = 2 });
                context.RolPermisos.Add(new RolPermiso { RolId = 2, PermisoId = 4 });

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
                    RolId = 1,
                    CreadoEn = DateTime.UtcNow,
                    ActualizadoEn = DateTime.UtcNow
                };
                context.Usuarios.Add(adminUser);
                await context.SaveChangesAsync();

                var tecModulo = await context.Modulos.FirstOrDefaultAsync(m => m.Slug == "desarrollo-apis") ?? await context.Modulos.FirstOrDefaultAsync();
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
