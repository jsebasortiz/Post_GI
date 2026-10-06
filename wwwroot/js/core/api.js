// Centralized REST API Transport Client

import { state } from './state.js';

export async function apiFetch(url, options = {}) {
  options.headers = options.headers || {};

  const token = state.jwtToken || localStorage.getItem('jwtToken');
  if (token) {
    if (options.headers instanceof Headers) {
      options.headers.set('Authorization', `Bearer ${token}`);
    } else {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, options);

  if ((response.status === 401 || response.status === 403) && !url.includes('/api/usuarios/login')) {
    console.warn('Sesión no autorizada o token expirado. Redirigiendo a Login.');
    state.clearSession();
    if (typeof window.navigateTo === 'function') {
      window.navigateTo('/login');
    }
  }

  return response;
}
