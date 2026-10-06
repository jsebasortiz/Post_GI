import { state } from '../core/state.js';
import { apiFetch } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { getPrixmaSwal } from '../core/ui-helpers.js';

export function hasPermission(codigo) {
  return state.hasPermission(codigo);
}

export function updateNavButtonsPermissions() {
  const btnPost = document.getElementById('btnOpenCreatePost');
  const btnModule = document.getElementById('btnOpenCreateModule');
  const btnArea = document.getElementById('btnOpenCreateArea');
  const btnTipo = document.getElementById('btnOpenPostTiposModal');
  const btnRbac = document.getElementById('btnOpenRbacModal');

  if (btnPost) btnPost.style.display = hasPermission('posts.create') ? 'inline-flex' : 'none';
  if (btnModule) btnModule.style.display = hasPermission('modulos.create') ? 'inline-flex' : 'none';
  if (btnArea) btnArea.style.display = hasPermission('modulos.create') ? 'inline-flex' : 'none';
  if (btnTipo) btnTipo.style.display = (hasPermission('tipos.manage') || hasPermission('tipos_conocimiento.manage') || hasPermission('modulos.create')) ? 'inline-flex' : 'none';
  if (btnRbac) btnRbac.style.display = hasPermission('roles.manage') ? 'inline-flex' : 'none';
}

export function renderUserNavArea() {
  const container = document.getElementById('userNavArea');
  if (!container) return;

  if (state.currentUser) {
    const rolBadge = state.currentUser.rolNombre || 'Lector';
    container.innerHTML = `
      <div class="user-nav-profile">
        <div class="avatar-sm" style="width:36px; height:36px; font-size:0.95rem; flex-shrink:0;">${escapeHtml(state.currentUser.nombre.charAt(0).toUpperCase())}</div>
        <div class="user-info-details">
          <strong class="user-display-name" title="${escapeHtml(state.currentUser.nombre)}">${escapeHtml(state.currentUser.nombre)}</strong>
          <span class="user-role-badge"><i class="fa-solid fa-shield-halved"></i> ${escapeHtml(rolBadge)}</span>
        </div>
        <button class="btn btn-logout-btn" onclick="handleLogout()" title="Cerrar Sesión">
          <i class="fa-solid fa-right-from-bracket"></i> <span class="btn-text">Salir</span>
        </button>
      </div>
    `;
    updateNavButtonsPermissions();
  } else {
    container.innerHTML = '';
    updateNavButtonsPermissions();
  }
}

export async function handleLogin(event) {
  if (event) event.preventDefault();

  const userInput = document.getElementById('loginUser');
  const passInput = document.getElementById('loginPass');

  clearLoginErrors();

  const correo = userInput ? userInput.value.trim() : '';
  const password = passInput ? passInput.value : '';

  let isValid = true;
  if (!correo) {
    markInputInvalid(userInput);
    isValid = false;
  }
  if (!password) {
    markInputInvalid(passInput);
    isValid = false;
  }

  if (!isValid) {
    showLoginError("Por favor completa todos los campos requeridos.");
    if (!correo && userInput) userInput.focus();
    else if (!password && passInput) passInput.focus();
    return;
  }

  setLoginLoadingState(true);

  try {
    const res = await fetch('/api/usuarios/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, password })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));

      if (res.status === 423 || (errData.message && errData.message.toLowerCase().includes('bloquead'))) {
        markInputInvalid(userInput);
        markInputInvalid(passInput);
        throw new Error("Cuenta bloqueada temporalmente por intentos fallidos. Contacta al área de TI.");
      } else if (res.status >= 500) {
        throw new Error("No fue posible conectar con el servidor corporativo. Intenta de nuevo más tarde.");
      } else {
        markInputInvalid(userInput);
        markInputInvalid(passInput);
        throw new Error("El usuario o la contraseña no coinciden.");
      }
    }

    const loginData = await res.json();
    const token = loginData.token || loginData.Token;
    const user = loginData.usuario || loginData.Usuario || loginData;

    state.saveSession(user, token);

    const form = document.getElementById('gateLoginForm');
    if (form) form.reset();

    if (window.navigateTo) {
      window.navigateTo('/dashboard');
    }
  } catch (err) {
    if (err.name === 'TypeError') {
      showLoginError("No fue posible conectar con el servidor corporativo. Intenta de nuevo más tarde.");
    } else {
      showLoginError(err.message || "El usuario o la contraseña no coinciden.");
    }
  } finally {
    setLoginLoadingState(false);
  }
}

export function setLoginLoadingState(isLoading) {
  const userInput = document.getElementById('loginUser');
  const passInput = document.getElementById('loginPass');
  const btn = document.getElementById('btnLoginSubmit');

  if (isLoading) {
    if (btn) {
      btn.disabled = true;
      btn.classList.add('btn-loading');
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Autenticando...';
    }
    if (userInput) userInput.disabled = true;
    if (passInput) passInput.disabled = true;
  } else {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('btn-loading');
      btn.innerHTML = '<i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i> Autenticar y Entrar';
    }
    if (userInput) userInput.disabled = false;
    if (passInput) passInput.disabled = false;
  }
}

export function showLoginError(msg) {
  const errorBanner = document.getElementById('loginErrorMsg');
  const errorText = document.getElementById('loginErrorText');
  if (errorBanner && errorText) {
    errorText.textContent = msg;
    errorBanner.style.display = 'flex';
  }
}

export function clearLoginErrors() {
  const errorBanner = document.getElementById('loginErrorMsg');
  const userInput = document.getElementById('loginUser');
  const passInput = document.getElementById('loginPass');

  if (errorBanner) errorBanner.style.display = 'none';
  if (userInput) {
    userInput.classList.remove('is-invalid');
    userInput.removeAttribute('aria-invalid');
    userInput.removeAttribute('aria-describedby');
  }
  if (passInput) {
    passInput.classList.remove('is-invalid');
    passInput.removeAttribute('aria-invalid');
    passInput.removeAttribute('aria-describedby');
  }
}

export function markInputInvalid(inputEl) {
  if (!inputEl) return;
  inputEl.classList.add('is-invalid');
  inputEl.setAttribute('aria-invalid', 'true');
  inputEl.setAttribute('aria-describedby', 'loginErrorMsg');
}

export function clearInputError(inputEl) {
  if (!inputEl) return;
  inputEl.classList.remove('is-invalid');
  inputEl.removeAttribute('aria-invalid');
  inputEl.removeAttribute('aria-describedby');

  const userInput = document.getElementById('loginUser');
  const passInput = document.getElementById('loginPass');
  const errorBanner = document.getElementById('loginErrorMsg');

  if (errorBanner && (!userInput || !userInput.classList.contains('is-invalid')) && (!passInput || !passInput.classList.contains('is-invalid'))) {
    errorBanner.style.display = 'none';
  }
}

export function toggleLoginPassword() {
  const passInput = document.getElementById('loginPass');
  const eyeIcon = document.getElementById('loginPassEyeIcon');
  if (!passInput) return;
  if (passInput.type === 'password') {
    passInput.type = 'text';
    if (eyeIcon) eyeIcon.className = 'fa-regular fa-eye-slash';
  } else {
    passInput.type = 'password';
    if (eyeIcon) eyeIcon.className = 'fa-regular fa-eye';
  }
}

export async function handleLogout(force = false) {
  if (force !== true) {
    const swal = getPrixmaSwal();
    const result = await swal.fire({
      title: '¿Cerrar Sesión?',
      text: '¿Estás seguro de que deseas salir de la aplicación?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '<i class="fa-solid fa-right-from-bracket"></i> Sí, cerrar sesión',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;
  }

  state.clearSession();
  if (window.navigateTo) {
    window.navigateTo('/login');
  }
}

export function showAuthGate() {
  state.isAppInitialized = false;
  const authGate = document.getElementById('authGateScreen');
  const mainApp = document.getElementById('appMainArea');
  if (mainApp) mainApp.classList.add('view-hidden');
  if (authGate) authGate.classList.remove('view-hidden');

  renderUserNavArea();
}
