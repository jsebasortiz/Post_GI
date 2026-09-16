using BlogApp.DTOs;

namespace BlogApp.Services;

public interface IAreaService
{
    Task<List<AreaResponseDto>> GetAreasAsync(bool soloActivas = true);
    Task<AreaResponseDto?> GetAreaByIdAsync(ushort id);
    Task<AreaResponseDto> CreateAreaAsync(CreateAreaDto dto);
    Task<AreaResponseDto> UpdateAreaAsync(ushort id, UpdateAreaDto dto);
    Task<bool> InactivarAreaAsync(ushort id);
}
