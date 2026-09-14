using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace BlogApp.Models;

[Table("post_tipo")]
public class PostTipo
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public byte Id { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("nombre")]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(255)]
    [Column("descripcion")]
    public string? Descripcion { get; set; }

    [Column("creado_en")]
    public DateTime CreadoEn { get; set; } = DateTime.UtcNow;

    // Relaciones
    [JsonIgnore]
    public ICollection<Post> Posts { get; set; } = new List<Post>();
}
