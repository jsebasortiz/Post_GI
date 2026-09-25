using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BlogApp.Models;

[Table("post")]
public class Post
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public ulong Id { get; set; }

    [Column("usuario_id")]
    public ulong UsuarioId { get; set; }

    [Column("modulo_id")]
    public ushort ModuloId { get; set; }

    [Column("tipo_id")]
    public byte TipoId { get; set; }

    [Required]
    [MaxLength(255)]
    [Column("titulo")]
    public string Titulo { get; set; } = string.Empty;

    [Required]
    [MaxLength(280)]
    [Column("slug")]
    public string Slug { get; set; } = string.Empty;

    [Column("resumen")]
    public string? Resumen { get; set; }

    [Required]
    [Column("contenido")]
    public string Contenido { get; set; } = string.Empty;

    [Column("estado_id")]
    public byte EstadoId { get; set; } = 1;

    [Column("estado")]
    public string Estado { get; set; } = "publicado";

    [Column("creado_en")]
    public DateTime CreadoEn { get; set; } = DateTime.UtcNow;

    [Column("actualizado_en")]
    public DateTime ActualizadoEn { get; set; } = DateTime.UtcNow;

    [Column("tipo_conocimiento_id")]
    public byte? TipoConocimientoId { get; set; }

    [MaxLength(500)]
    [Column("palabras_clave")]
    public string? PalabrasClave { get; set; }

    [ForeignKey(nameof(UsuarioId))]
    public Usuario? Usuario { get; set; }

    [ForeignKey(nameof(ModuloId))]
    public Modulo? Modulo { get; set; }

    [ForeignKey(nameof(TipoId))]
    public PostTipo? Tipo { get; set; }

    [ForeignKey(nameof(TipoConocimientoId))]
    public TipoConocimiento? TipoConocimiento { get; set; }

    [ForeignKey(nameof(EstadoId))]
    public PostEstado? EstadoEntidad { get; set; }

    public ICollection<AdjuntoPost> Adjuntos { get; set; } = new List<AdjuntoPost>();
}
