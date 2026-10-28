/**
 * Prixma App Main Entry Point (Modular ES6 Architecture)
 * Adheres to SOLID & Clean Code Principles
 */

import { state } from './core/state.js';
import { apiFetch } from './core/api.js';
import { escapeHtml, formatDate, formatBytes } from './core/utils.js';
import { initTheme, toggleTheme, setTheme } from './core/theme.js';
import {
  startTopProgressBar, finishTopProgressBar, showRouteSpinner, hideRouteSpinner,
  setButtonLoading, setFormSkeletonState, setFormReadOnlyMode, getPrixmaSwal, getTableSkeletonHtml
} from './core/ui-helpers.js';
import {
  navigateTo, switchAppView, switchMainCategory, showMainApp, handleRoute
} from './router/router.js';
import {
  hasPermission, updateNavButtonsPermissions, renderUserNavArea, handleLogin,
  setLoginLoadingState, showLoginError, clearLoginErrors, markInputInvalid,
  clearInputError, toggleLoginPassword, handleLogout, showAuthGate,
  handleMicrosoftLogin, toggleLocalLoginForm, setMicrosoftLoginLoadingState, getAuthConfig, initMsal
} from './modules/auth.js';
import {
  getFileMeta, autoSelectDefaultImageCover, renderFilePreviews, handleFileSelect,
  removeSelectedFile, handleDeleteAttachment
} from './modules/attachments.js';
import {
  loadAreas, getAllAreas, getAreaIcon, renderAreaTabs, populateAreaSelects,
  loadAreasList, changeAreasPage, handleCreateArea, handleEditAreaInline,
  openEditAreaModal, handleUpdateArea, handleInactivarArea,
  loadAreaForShow, loadAreaForEdit, hasAreaEditChanged,
  handleSaveEditArea, handleCancelEditArea, handleDeleteAreaFromForm
} from './modules/areas.js';
import {
  loadModulos, updateModulePillActiveState, filterByModule, onPostCategoriaChange,
  updatePostSubmoduloSelect, populateModuloAreaSelect, loadModulesList, changeModulesPage,
  handleCreateModule, openEditModuleModal, handleUpdateModule, handleInactivarModulo, handleEditModuloInline,
  loadModuleForShow, loadModuleForEdit, hasModuleEditChanged,
  handleSaveEditModule, handleCancelEditModule, handleDeleteModuleFromForm
} from './modules/modulos.js';
import {
  loadPostTipos, loadTiposConocimiento, loadPostTiposList, changePostTiposPage,
  handleCreatePostTipo, handleEditPostTipo, handleDeletePostTipo, switchTiposSubTab,
  changeTiposConocimientoPage, loadTiposConocimientoList, handleCreateTipoConocimientoInline,
  handleEditTipoConocimientoInline, handleDeleteTipoConocimiento, loadEditPostTipos,
  prepareCreatePostTipoForm, loadPostTipoForShow, loadPostTipoForEdit, hasPostTipoEditChanged,
  handleSaveCreatePostTipo, handleSaveEditPostTipo, handleCancelEditPostTipo, handleDeleteTipoFromForm,
  loadTipoConocimientoForShow, loadTipoConocimientoForEdit, hasTipoConocimientoEditChanged,
  handleSaveCreateTipoConocimiento, handleSaveEditTipoConocimiento, handleCancelEditTipoConocimiento,
  handleDeleteTipoConocimientoFromForm, populatePostTipoRoleSelects
} from './modules/tipos.js';
import {
  loadRbacUsers, onRbacUserSearchInput, renderRbacUsersTable, changeRbacUsersPage,
  handleAssignUserRole, loadRbacMatrix, handleSaveRolePermisos, handleCheckAllRolePermisos, handleUncheckAllRolePermisos,
  switchRbacMatrixView, renderRbacMatrix, toggleNewRoleForm,
  handleCreateRole, loadRbacRolesList, renderRbacRolesTable, changeRbacRolesPage,
  switchRbacSubTab, openRbacModal, handleDeleteRole,
  loadRoleForShow, loadRoleForEdit, hasRoleEditChanged,
  handleSaveCreateRole, handleSaveEditRole, handleCancelEditRole, handleDeleteRoleFromForm
} from './modules/rbac.js';
import {
  isImageUrl, getPostCoverUrl, renderPostCard, loadPosts, renderPaginationControls,
  goToPage, debounceSearch, handleCreatePost, openDetailView, openDetailModal,
  openEditView, openEditModal, hasPostEditChanged, handleCancelEditPost,
  handleDeletePostFromModal, handleSetPortada, onEditPostCategoriaChange,
  updateEditPostSubmoduloSelect, handleEditFileSelect, renderEditFilePreviews,
  removeEditFile, handleSaveEditPost, handleDeletePost
} from './modules/posts.js';

// Init User Session
async function initUserSession() {
  // 1. Si estamos dentro de una ventana emergente de MSAL (popup)
  const isMsalPopup = window.opener && (
    (window.name && window.name.indexOf('msal.') === 0) ||
    window.location.hash.includes('code=') ||
    window.location.search.includes('code=') ||
    window.location.hash.includes('error=') ||
    window.location.search.includes('error=')
  );

  if (isMsalPopup) {
    console.log("Ventana emergente de MSAL detectada. Procesando respuesta y cerrando popup...");
    try {
      await initMsal();
    } catch (e) {
      console.warn("Aviso en retorno de popup MSAL:", e);
    }
    // IMPORTANTE: Detener ejecución aquí dentro del popup para no alterar la URL ni ejecutar router
    return;
  }

  // 2. Si venimos de un redirect de Microsoft en la ventana principal
  if (window.location.hash.includes('code=') || window.location.search.includes('code=')) {
    try {
      await initMsal();
    } catch (e) {
      console.warn("Aviso procesando código de retorno:", e);
    }
  }

  const savedUser = localStorage.getItem('currentUser');
  const savedToken = localStorage.getItem('jwtToken');

  if (savedUser && savedToken) {
    try {
      state.currentUser = JSON.parse(savedUser);
      state.jwtToken = savedToken;
    } catch (e) {
      state.clearSession();
    }
  } else {
    state.clearSession();
  }

  handleRoute();
}

// Global Event Listeners
window.addEventListener('popstate', handleRoute);
window.addEventListener('hashchange', handleRoute);

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initUserSession();

  const loginForm = document.getElementById('gateLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleLogin(e);
    });
  }
});

// Register Global Handlers on Window for 100% Backward Compatibility with Inline HTML Event Bindings
Object.assign(window, {
  // State & API
  state,
  apiFetch,
  escapeHtml,
  formatDate,
  formatBytes,

  // Theme
  initTheme,
  toggleTheme,
  setTheme,

  // UI Helpers
  startTopProgressBar,
  finishTopProgressBar,
  showRouteSpinner,
  hideRouteSpinner,
  setButtonLoading,
  setFormSkeletonState,
  setFormReadOnlyMode,
  getPrixmaSwal,
  getTableSkeletonHtml,

  // Router
  navigateTo,
  switchAppView,
  switchMainCategory,
  showMainApp,
  handleRoute,

  // Auth
  hasPermission,
  updateNavButtonsPermissions,
  renderUserNavArea,
  handleLogin,
  handleMicrosoftLogin,
  toggleLocalLoginForm,
  setMicrosoftLoginLoadingState,
  getAuthConfig,
  setLoginLoadingState,
  showLoginError,
  clearLoginErrors,
  markInputInvalid,
  clearInputError,
  toggleLoginPassword,
  handleLogout,
  showAuthGate,

  // Attachments
  getFileMeta,
  autoSelectDefaultImageCover,
  renderFilePreviews,
  handleFileSelect,
  removeSelectedFile,
  handleDeleteAttachment,
  setCoverIndex: (idx) => { state.coverIndex = idx; },

  // Areas
  loadAreas,
  getAllAreas,
  getAreaIcon,
  renderAreaTabs,
  populateAreaSelects,
  loadAreasList,
  changeAreasPage,
  handleCreateArea,
  handleEditAreaInline,
  openEditAreaModal,
  handleUpdateArea,
  handleInactivarArea,
  loadAreaForShow,
  loadAreaForEdit,
  hasAreaEditChanged,
  handleSaveEditArea,
  handleCancelEditArea,
  handleDeleteAreaFromForm,

  // Modulos
  loadModulos,
  updateModulePillActiveState,
  filterByModule,
  onPostCategoriaChange,
  updatePostSubmoduloSelect,
  populateModuloAreaSelect,
  loadModulesList,
  changeModulesPage,
  handleCreateModule,
  openEditModuleModal,
  handleUpdateModule,
  handleInactivarModulo,
  handleEditModuloInline,
  loadModuleForShow,
  loadModuleForEdit,
  hasModuleEditChanged,
  handleSaveEditModule,
  handleCancelEditModule,
  handleDeleteModuleFromForm,

  // Tipos
  loadPostTipos,
  loadTiposConocimiento,
  loadPostTiposList,
  changePostTiposPage,
  handleCreatePostTipo,
  handleEditPostTipo,
  handleDeletePostTipo,
  switchTiposSubTab,
  changeTiposConocimientoPage,
  loadTiposConocimientoList,
  handleCreateTipoConocimientoInline,
  handleEditTipoConocimientoInline,
  handleDeleteTipoConocimiento,
  loadEditPostTipos,
  prepareCreatePostTipoForm,
  loadPostTipoForShow,
  loadPostTipoForEdit,
  hasPostTipoEditChanged,
  handleSaveCreatePostTipo,
  handleSaveEditPostTipo,
  handleCancelEditPostTipo,
  handleDeleteTipoFromForm,
  loadTipoConocimientoForShow,
  loadTipoConocimientoForEdit,
  hasTipoConocimientoEditChanged,
  handleSaveCreateTipoConocimiento,
  handleSaveEditTipoConocimiento,
  handleCancelEditTipoConocimiento,
  handleDeleteTipoConocimientoFromForm,
  populatePostTipoRoleSelects,

  // RBAC
  loadRbacUsers,
  onRbacUserSearchInput,
  renderRbacUsersTable,
  changeRbacUsersPage,
  handleAssignUserRole,
  loadRbacMatrix,
  handleSaveRolePermisos,
  handleCheckAllRolePermisos,
  handleUncheckAllRolePermisos,
  switchRbacMatrixView,
  renderRbacMatrix,
  toggleNewRoleForm,
  handleCreateRole,
  loadRbacRolesList,
  renderRbacRolesTable,
  changeRbacRolesPage,
  switchRbacSubTab,
  openRbacModal,
  handleDeleteRole,
  loadRoleForShow,
  loadRoleForEdit,
  hasRoleEditChanged,
  handleSaveCreateRole,
  handleSaveEditRole,
  handleCancelEditRole,
  handleDeleteRoleFromForm,

  // Posts
  isImageUrl,
  getPostCoverUrl,
  renderPostCard,
  loadPosts,
  renderPaginationControls,
  goToPage,
  debounceSearch,
  handleCreatePost,
  openDetailView,
  openDetailModal,
  openEditView,
  openEditModal,
  hasPostEditChanged,
  handleCancelEditPost,
  handleDeletePostFromModal,
  handleSetPortada,
  onEditPostCategoriaChange,
  updateEditPostSubmoduloSelect,
  handleEditFileSelect,
  renderEditFilePreviews,
  removeEditFile,
  handleSaveEditPost,
  handleDeletePost,

  // Navigation / Modal Shortcuts
  openCreateModal: () => navigateTo('/posts/create'),
  openModuleModal: () => navigateTo('/modulos'),
  openAreaModal: () => navigateTo('/areas'),
  openPostTiposModal: () => navigateTo('/tipos'),
  openRbacModal: () => navigateTo('/rbac'),
  openModal: (id) => navigateTo('/dashboard'),
  closeModal: (id) => navigateTo('/dashboard')
});

// ==========================================================================
// Logica del Asistente IA Flotante
// ==========================================================================
window.toggleChatWindow = function() {
  const win = document.getElementById('chatFloatingWindow');
  if (!win) return;
  win.classList.toggle('active');
  if (win.classList.contains('active')) {
    setTimeout(() => {
      const input = document.getElementById('chatInput');
      if (input) input.focus();
    }, 150);
  }
};

window.enviarPreguntaChat = async function(event) {
  event.preventDefault();
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');
  const container = document.getElementById('chatMessages');
  if (!input || !container) return;

  const pregunta = input.value.trim();
  if (!pregunta) return;

  // Agregar mensaje del usuario
  const userMsgDiv = document.createElement('div');
  userMsgDiv.className = 'chat-msg chat-msg-user';
  userMsgDiv.textContent = pregunta;
  container.appendChild(userMsgDiv);
  input.value = '';

  // Mensaje temporal de espera
  const botMsgDiv = document.createElement('div');
  botMsgDiv.className = 'chat-msg chat-msg-bot';
  botMsgDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Consultando en los posts...';
  container.appendChild(botMsgDiv);
  container.scrollTop = container.scrollHeight;

  input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;

  try {
    const res = await fetch('/api/Chat/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      botMsgDiv.textContent = 'Error: ' + (errData.mensaje || errData.message || 'No se pudo obtener respuesta.');
    } else {
      const data = await res.json();
      botMsgDiv.textContent = data.respuesta || 'Sin respuesta.';
    }
  } catch (error) {
    botMsgDiv.textContent = 'Error de conexión: ' + error.message;
  } finally {
    input.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
    container.scrollTop = container.scrollHeight;
  }
};