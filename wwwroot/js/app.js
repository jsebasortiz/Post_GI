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
  clearInputError, toggleLoginPassword, handleLogout, showAuthGate
} from './modules/auth.js';
import {
  getFileMeta, autoSelectDefaultImageCover, renderFilePreviews, handleFileSelect,
  removeSelectedFile, handleDeleteAttachment
} from './modules/attachments.js';
import {
  loadAreas, getAllAreas, getAreaIcon, renderAreaTabs, populateAreaSelects,
  loadAreasList, changeAreasPage, handleCreateArea, handleEditAreaInline,
  openEditAreaModal, handleUpdateArea, handleInactivarArea
} from './modules/areas.js';
import {
  loadModulos, updateModulePillActiveState, filterByModule, onPostCategoriaChange,
  updatePostSubmoduloSelect, populateModuloAreaSelect, loadModulesList, changeModulesPage,
  handleCreateModule, openEditModuleModal, handleUpdateModule, handleInactivarModulo, handleEditModuloInline
} from './modules/modulos.js';
import {
  loadPostTipos, loadTiposConocimiento, loadPostTiposList, changePostTiposPage,
  handleCreatePostTipo, handleEditPostTipo, handleDeletePostTipo, switchTiposSubTab,
  changeTiposConocimientoPage, loadTiposConocimientoList, handleCreateTipoConocimientoInline,
  handleEditTipoConocimientoInline, handleDeleteTipoConocimiento, loadEditPostTipos
} from './modules/tipos.js';
import {
  loadRbacUsers, onRbacUserSearchInput, renderRbacUsersTable, changeRbacUsersPage,
  handleAssignUserRole, loadRbacMatrix, handleSaveRolePermisos, toggleNewRoleForm,
  handleCreateRole, loadRbacRolesList, renderRbacRolesTable, changeRbacRolesPage,
  switchRbacSubTab, openRbacModal, handleDeleteRole
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
function initUserSession() {
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

  // RBAC
  loadRbacUsers,
  onRbacUserSearchInput,
  renderRbacUsersTable,
  changeRbacUsersPage,
  handleAssignUserRole,
  loadRbacMatrix,
  handleSaveRolePermisos,
  toggleNewRoleForm,
  handleCreateRole,
  loadRbacRolesList,
  renderRbacRolesTable,
  changeRbacRolesPage,
  switchRbacSubTab,
  openRbacModal,
  handleDeleteRole,

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
