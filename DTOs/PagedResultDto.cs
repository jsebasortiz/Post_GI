using System;
using System.Collections.Generic;

namespace BlogApp.DTOs
{
    public class PagedResultDto<T>
    {
        public List<T> Items { get; set; } = new List<T>();
        
        public int TotalItems { get; set; }
        public int TotalCount 
        { 
            get => TotalItems; 
            set => TotalItems = value; 
        }

        public int Page { get; set; } = 1;
        public int PageNumber 
        { 
            get => Page; 
            set => Page = value; 
        }

        public int PageSize { get; set; } = 10;

        public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)TotalItems / PageSize) : 0;
        public bool HasPreviousPage => Page > 1;
        public bool HasNextPage => Page < TotalPages;
    }
}
