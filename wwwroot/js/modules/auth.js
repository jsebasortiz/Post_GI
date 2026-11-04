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
  const adminDropdown = document.getElementById('navAdminDropdownContainer');

  const canCreatePost = hasPermission('posts.create');
  const canManageModules = hasPermission('modulos.create');
  const canManageTipos = hasPermission('tipos.manage') || hasPermission('tipos_conocimiento.manage') || hasPermission('modulos.create');
  const canManageRoles = hasPermission('roles.manage');

  if (btnPost) btnPost.style.display = canCreatePost ? 'inline-flex' : 'none';
  if (btnModule) btnModule.style.display = canManageModules ? 'flex' : 'none';
  if (btnArea) btnArea.style.display = canManageModules ? 'flex' : 'none';
  if (btnTipo) btnTipo.style.display = canManageTipos ? 'flex' : 'none';
  if (btnRbac) btnRbac.style.display = canManageRoles ? 'flex' : 'none';

  if (adminDropdown) {
    const hasAnyAdminPerm = canManageModules || canManageTipos || canManageRoles;
    adminDropdown.style.display = hasAnyAdminPerm ? 'block' : 'none';
  }
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

// Cache de instancia MSAL y configuración de Microsoft 365
let msalInstance = null;
let cachedAuthConfig = null;

export async function getAuthConfig() {
  if (cachedAuthConfig) return cachedAuthConfig;
  try {
    const res = await apiFetch('/api/usuarios/auth-config');
    if (res.ok) {
      cachedAuthConfig = await res.json();
      return cachedAuthConfig;
    }
  } catch (err) {
    console.warn("No fue posible cargar la configuración de Microsoft 365:", err);
  }
  return { clientId: '', tenantId: 'common', allowedDomain: 'centroaguas.com', isConfigured: false };
}

export async function processMicrosoftToken(loginResult) {
  if (!loginResult || (!loginResult.idToken && !loginResult.accessToken)) {
    throw new Error("No se recibió credencial válida desde Microsoft 365.");
  }

  setMicrosoftLoginLoadingState(true);
  try {
    const res = await apiFetch('/api/usuarios/microsoft-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: loginResult.idToken || '',
        accessToken: loginResult.accessToken || ''
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || "Error al autenticar en el servidor con Microsoft 365.");
    }

    const data = await res.json();
    const token = data.token || data.Token;
    const user = data.usuario || data.Usuario || data;

    state.saveSession(user, token);

    if (window.navigateTo) {
      window.navigateTo('/dashboard');
    }
  } finally {
    setMicrosoftLoginLoadingState(false);
  }
}

export async function initMsal() {
  if (msalInstance) return msalInstance;

  const config = await getAuthConfig();
  if (!config || !config.isConfigured) {
    return null;
  }

  if (!window.msal) {
    console.error("La librería @azure/msal-browser no está disponible en window.msal.");
    return null;
  }

  // Determinar la URL base limpia para el redirectUri de MSAL
  const basePath = window.location.pathname.toLowerCase().startsWith('/prixma') ? '/prixma' : '';
  const appRedirectUri = window.location.origin + basePath;

  const msalConfig = {
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId || 'common'}`,
      redirectUri: appRedirectUri
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false
    }
  };

  try {
    msalInstance = new window.msal.PublicClientApplication(msalConfig);
    // Procesar redirect callback (tanto para redirect flow como para popup response)
    const redirectResponse = await msalInstance.handleRedirectPromise().catch(err => {
      console.warn("Aviso procesando handleRedirectPromise:", err);
      return null;
    });

    // Si venimos de un redirect exitoso con token en la ventana principal
    if (redirectResponse && (redirectResponse.idToken || redirectResponse.accessToken)) {
      await processMicrosoftToken(redirectResponse).catch(err => {
        console.error("Error al procesar token tras redirect:", err);
        showLoginError(err.message || "Error al completar inicio de sesión con Microsoft 365.");
      });
    }

    return msalInstance;
  } catch (err) {
    console.error("Error al inicializar PublicClientApplication de MSAL:", err);
    return null;
  }
}

export async function handleMicrosoftLogin() {
  // Si esta función se invoca por error dentro de un popup de MSAL, cancelarla inmediatamente
  if (window.opener && window.name && window.name.indexOf('msal.') === 0) {
    console.warn("handleMicrosoftLogin cancelado: ejecutándose dentro de una ventana emergente.");
    return;
  }

  clearLoginErrors();

  const config = await getAuthConfig();
  if (!config || !config.isConfigured) {
    const notice = document.getElementById('azureConfigNotice');
    if (notice) notice.style.display = 'flex';
    showLoginError("Microsoft 365 no ha sido configurado en el servidor. Configura el ClientId y TenantId en appsettings.json.");
    return;
  }

  if (!window.msal) {
    showLoginError("La librería de autenticación de Microsoft no cargó correctamente. Revisa tu conexión a internet.");
    return;
  }

  setMicrosoftLoginLoadingState(true);

  try {
    const msalApp = await initMsal();
    if (!msalApp) {
      throw new Error("No se pudo inicializar el servicio de autenticación de Microsoft.");
    }

    const loginRequest = {
      scopes: ["openid", "profile", "email"],
      prompt: "select_account"
    };

    let loginResult = null;
    try {
      loginResult = await msalApp.loginPopup(loginRequest);
    } catch (popupErr) {
      console.warn("Popup bloqueado o con error, intentando flujo redirect:", popupErr);
      if (popupErr.name === 'BrowserAuthError' && (popupErr.errorCode === 'popup_window_error' || popupErr.errorCode === 'empty_window_error')) {
        await msalApp.loginRedirect(loginRequest);
        return;
      }
      throw popupErr;
    }

    await processMicrosoftToken(loginResult);
  } catch (err) {
    console.error("Fallo durante el inicio de sesión con Microsoft 365:", err);
    if (err.errorCode === 'user_cancelled') {
      showLoginError("El inicio de sesión con Microsoft fue cancelado por el usuario.");
    } else {
      showLoginError(err.message || "No fue posible iniciar sesión con Microsoft 365.");
    }
  } finally {
    setMicrosoftLoginLoadingState(false);
  }
}

export function setMicrosoftLoginLoadingState(isLoading) {
  const btn = document.getElementById('btnMicrosoftLogin');
  const btnText = document.getElementById('btnMicrosoftText');

  if (isLoading) {
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.75';
      btn.style.cursor = 'wait';
    }
    if (btnText) {
      btnText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Conectando con Microsoft 365...';
    }
  } else {
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    }
    if (btnText) {
      btnText.textContent = 'Iniciar Sesión con Microsoft 365';
    }
  }
}

export function toggleLocalLoginForm() {
  const container = document.getElementById('localLoginFormContainer');
  const icon = document.getElementById('toggleLocalFormIcon');
  if (!container) return;

  const isHidden = container.style.display === 'none' || !container.style.display;
  container.style.display = isHidden ? 'block' : 'none';
  if (icon) {
    icon.className = isHidden ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
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
    const res = await apiFetch('/api/usuarios/login', {
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

  // Verificar configuración de Azure en segundo plano y precargar MSAL
  getAuthConfig().then(config => {
    const notice = document.getElementById('azureConfigNotice');
    if (notice) {
      notice.style.display = (config && config.isConfigured) ? 'none' : 'flex';
    }
    if (config && config.isConfigured) {
      initMsal().catch(e => console.warn("Precarga de MSAL:", e));
    }
  }).catch(() => {});
}

