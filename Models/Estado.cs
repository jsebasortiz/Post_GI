using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BlogApp.Models;

[Table("estado")]
public class Estado
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
}
