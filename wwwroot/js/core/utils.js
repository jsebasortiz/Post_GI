// Utility functions for string escaping, dates, and formatting

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function getAppBasePath() {
  const baseEl = document.querySelector('base');
  if (baseEl && baseEl.getAttribute('href')) {
    const href = baseEl.getAttribute('href');
    if (href.startsWith('http')) {
      return new URL(href).pathname.replace(/\/$/, '');
    }
    return href.replace(/\/$/, '');
  }
  const pathname = window.location.pathname;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0 && !segments[0].includes('.')) {
    return '/' + segments[0];
  }
  return '';
}
