using BlogApp.Models;
using Microsoft.EntityFrameworkCore;

namespace BlogApp.Data;

public class BlogDbContext : DbContext
{
    public BlogDbContext(DbContextOptions<BlogDbContext> options) : base(options)
    {
    }

    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<PostTipo> PostTipos => Set<PostTipo>();
    public DbSet<PostEstado> PostEstados => Set<PostEstado>();
    public DbSet<Modulo> Modulos => Set<Modulo>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<AdjuntoPost> AdjuntosPost => Set<AdjuntoPost>();
    public DbSet<Rol> Roles => Set<Rol>();
    public DbSet<Permiso> Permisos => Set<Permiso>();
    public DbSet<RolPermiso> RolPermisos => Set<RolPermiso>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Tabla rol
        modelBuilder.Entity<Rol>(entity =>
        {
            entity.HasIndex(r => r.Nombre).IsUnique();
            entity.Property(r => r.CreadoEn).HasDefaultValueSql("CURRENT_TIMESTAMP");
        });

        // Tabla permiso
        modelBuilder.Entity<Permiso>(entity =>
        {
            entity.HasIndex(p => p.Codigo).IsUnique();
            entity.Property(p => p.CreadoEn).HasDefaultValueSql("CURRENT_TIMESTAMP");
        });

        // Tabla rol_permiso
        modelBuilder.Entity<RolPermiso>(entity =>
        {
            entity.HasKey(rp => new { rp.RolId, rp.PermisoId });

            entity.HasOne(rp => rp.Rol)
                .WithMany(r => r.RolPermisos)
                .HasForeignKey(rp => rp.RolId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(rp => rp.Permiso)
                .WithMany(p => p.RolPermisos)
                .HasForeignKey(rp => rp.PermisoId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Tabla usuarios
        modelBuilder.Entity<Usuario>(entity =>
        {
            entity.HasIndex(u => u.Correo).IsUnique();
            entity.Property(u => u.Estado).HasDefaultValue("activo");
            entity.Property(u => u.RolId).HasDefaultValue((byte)3);
            entity.Property(u => u.CreadoEn).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(u => u.ActualizadoEn).HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.HasOne(u => u.Rol)
                .WithMany(r => r.Usuarios)
                .HasForeignKey(u => u.RolId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Tabla post_tipo
        modelBuilder.Entity<PostTipo>(entity =>
        {
            entity.HasIndex(pt => pt.Nombre).IsUnique();
            entity.Property(pt => pt.CreadoEn).HasDefaultValueSql("CURRENT_TIMESTAMP");
        });

        // Tabla post_estado
        modelBuilder.Entity<PostEstado>(entity =>
        {
            entity.HasIndex(pe => pe.Nombre).IsUnique();
        });

        // Tabla modulo
        modelBuilder.Entity<Modulo>(entity =>
        {
            entity.HasIndex(m => m.Nombre).IsUnique();
            entity.HasIndex(m => m.Slug).IsUnique();
            entity.HasIndex(m => m.CategoriaPadre).HasDatabaseName("idx_modulo_categoria");
            entity.Property(m => m.CategoriaPadre).HasDefaultValue("apps").HasMaxLength(50);
            entity.Property(m => m.Estado).HasDefaultValue(true);
            entity.Property(m => m.CreadoEn).HasDefaultValueSql("CURRENT_TIMESTAMP");
        });

        // Tabla post
        modelBuilder.Entity<Post>(entity =>
        {
            entity.HasIndex(p => p.Slug).IsUnique();
            entity.HasIndex(p => p.UsuarioId).HasDatabaseName("idx_post_usuario");
            entity.HasIndex(p => p.ModuloId).HasDatabaseName("idx_post_modulo");
            entity.HasIndex(p => p.TipoId).HasDatabaseName("idx_post_tipo");
            entity.HasIndex(p => p.EstadoId).HasDatabaseName("idx_post_estado_id");
            entity.HasIndex(p => p.CreadoEn).HasDatabaseName("idx_post_creado");

            entity.Property(p => p.EstadoId).HasDefaultValue((byte)1);
            entity.Property(p => p.Estado).HasDefaultValue("publicado");
            entity.Property(p => p.Visitas).HasDefaultValue(0u);
            entity.Property(p => p.CreadoEn).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(p => p.ActualizadoEn).HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.HasOne(p => p.Usuario)
                .WithMany(u => u.Posts)
                .HasForeignKey(p => p.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(p => p.Modulo)
                .WithMany(m => m.Posts)
                .HasForeignKey(p => p.ModuloId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(p => p.Tipo)
                .WithMany(t => t.Posts)
                .HasForeignKey(p => p.TipoId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(p => p.EstadoEntidad)
                .WithMany(pe => pe.Posts)
                .HasForeignKey(p => p.EstadoId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Tabla adjunto_post
        modelBuilder.Entity<AdjuntoPost>(entity =>
        {
            entity.HasIndex(a => a.PostId).HasDatabaseName("idx_adjunto_post");
            entity.Property(a => a.EsPortada).HasDefaultValue(false);
            entity.Property(a => a.CreadoEn).HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.HasOne(a => a.Post)
                .WithMany(p => p.Adjuntos)
                .HasForeignKey(a => a.PostId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
