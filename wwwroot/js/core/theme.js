// Theme Manager (Dark / Light Mode)

import { state } from './state.js';

export function initTheme() {
  setTheme(state.currentTheme);
}

export function toggleTheme() {
  const newTheme = state.currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

export function setTheme(theme) {
  state.currentTheme = theme;
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('prixmaTheme', theme);

  const themeIcon = document.getElementById('themeIcon');
  const themeBtn = document.getElementById('btnToggleTheme');
  const themeText = document.getElementById('themeText');
  if (themeIcon) {
    themeIcon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
  if (themeBtn) {
    themeBtn.setAttribute('title', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }
  if (themeText) {
    themeText.textContent = theme === 'dark' ? 'Claro' : 'Oscuro';
  }

  const loginThemeBtn = document.getElementById('btnLoginToggleTheme');
  if (loginThemeBtn) {
    const icon = loginThemeBtn.querySelector('i');
    if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    loginThemeBtn.setAttribute('title', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }
}
