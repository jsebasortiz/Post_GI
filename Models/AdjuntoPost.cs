using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace BlogApp.Models;

[Table("adjunto_post")]
public class AdjuntoPost
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public ulong Id { get; set; }

    [Column("post_id")]
    public ulong PostId { get; set; }

    [Required]
    [MaxLength(500)]
    [Column("archivo_url")]
    public string ArchivoUrl { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    [Column("archivo_nombre_original")]
    public string ArchivoNombreOriginal { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    [Column("mime_type")]
    public string MimeType { get; set; } = string.Empty;

    [Column("tamanio_bytes")]
    public ulong TamanioBytes { get; set; }

    [Column("es_portada")]
    public bool EsPortada { get; set; } = false;

    [Column("creado_en")]
    public DateTime CreadoEn { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(PostId))]
    [JsonIgnore]
    public Post? Post { get; set; }
}
