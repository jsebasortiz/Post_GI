window.openPostInNewTab = function(id) {
  if (!id) return;
  const url = window.location.origin + '/#/post/' + id;
  window.open(url, '_blank');
};
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
      botMsgDiv.innerHTML = window.renderAiResponseClean(data.respuesta || 'Sin respuesta.');
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
// ==========================================================================
// Logica del Buscador y Analizador Inteligente con IA (Ruta /ia-search)
// ==========================================================================
window.setAiQuery = function(text) {
  const input = document.getElementById('aiSearchInput');
  if (input) {
    input.value = text;
    input.focus();
  }
};

window.copyAiResponse = function() {
  const content = document.getElementById('aiResultsContent');
  if (!content) return;
  navigator.clipboard.writeText(content.innerText).then(() => {
    if (window.Swal) {
      Swal.fire({
        icon: 'success',
        title: 'Copiado',
        text: 'El informe de la IA ha sido copiado al portapapeles.',
        timer: 1800,
        showConfirmButton: false
      });
    } else {
      alert('Informe copiado.');
    }
  });
};

window.handleAiSearchSubmit = async function(event) {
  event.preventDefault();
  const input = document.getElementById('aiSearchInput');
  const btn = document.getElementById('btnAiSearchSubmit');
  const loader = document.getElementById('aiSearchLoader');
  const resultsCard = document.getElementById('aiSearchResults');
  const resultsContent = document.getElementById('aiResultsContent');

  if (!input || !loader || !resultsCard || !resultsContent) return;

  const pregunta = input.value.trim();
  if (!pregunta) return;

  // Estado visual de carga
  loader.style.display = 'block';
  resultsCard.style.display = 'none';
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/Chat/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      resultsContent.textContent = 'Error: ' + (err.mensaje || err.message || 'No se pudo completar el análisis.');
    } else {
      const data = await res.json();
      resultsContent.innerHTML = window.renderAiResponseClean(data.respuesta || 'Sin resultados generados.');
    }
    resultsCard.style.display = 'block';
  } catch (error) {
    resultsContent.textContent = 'Error al comunicarse con el servidor: ' + error.message;
    resultsCard.style.display = 'block';
  } finally {
    loader.style.display = 'none';
    if (btn) btn.disabled = false;
    resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};
// ==========================================================================
// Parser Visual Profesional de Respuestas de IA (Convierte texto en tarjetas limpias)
// ==========================================================================
window.renderAiResponseClean = function(rawText) {
  if (!rawText) return '';
  
  // Si la libreria marked esta disponible y es texto libre, pre-procesamos
  // Extraemos secciones limpiamente
  let resumenHtml = '';
  let postsHtml = '';
  let relacionesHtml = '';

  const sections = rawText.split('###');

  sections.forEach(sec => {
    const trimmed = sec.trim();
    if (!trimmed) return;

    if (trimmed.includes('Resumen Ejecutivo') || trimmed.includes('📌')) {
      const cleanBody = trimmed.replace(/^.*Resumen Ejecutivo.*$/m, '').trim();
      resumenHtml = `
        <div class="ai-card-block" style="border-left: 4px solid var(--accent-cyan);">
          <div class="ai-card-title"><i class="fa-solid fa-compass"></i> Resumen Ejecutivo</div>
          <div style="font-size:0.95rem; line-height:1.6; color:var(--text-main);">${window.formatMarkdownMini(cleanBody)}</div>
        </div>
      `;
    } else if (trimmed.includes('Publicaciones Encontradas') || trimmed.includes('📚')) {
      const rawPosts = trimmed.replace(/^.*Publicaciones Encontradas.*$/m, '').trim();
      postsHtml = `
        <div class="ai-card-block">
          <div class="ai-card-title"><i class="fa-solid fa-layer-group"></i> Publicaciones Relacionadas</div>
          <div class="ai-posts-wrapper">${window.parsePostsListToCards(rawPosts)}</div>
        </div>
      `;
    } else if (trimmed.includes('Relación') || trimmed.includes('Conclusiones') || trimmed.includes('🔗')) {
      const cleanRel = trimmed.replace(/^.*Relación.*$/m, '').trim();
      const lines = cleanRel.split('\n').filter(l => l.trim().length > 0);
      let items = '';
      lines.forEach(l => {
        const itemText = l.replace(/^[\*\-\•]\s*/, '').trim();
        if (itemText) {
          items += `<li class="ai-relation-item">${window.formatMarkdownMini(itemText)}</li>`;
        }
      });
      relacionesHtml = `
        <div class="ai-card-block" style="border-left: 4px solid var(--accent-purple);">
          <div class="ai-card-title"><i class="fa-solid fa-diagram-project"></i> Relación & Conexiones Identificadas</div>
          <ul class="ai-relation-list">${items}</ul>
        </div>
      `;
    }
  });

  // Si no coincidieron los encabezados clasicos, renderizamos con formato Markdown limpio
  if (!resumenHtml && !postsHtml && !relacionesHtml) {
    if (window.marked && window.marked.parse) {
      return `<div class="ai-card-block">${window.marked.parse(rawText)}</div>`;
    }
    return `<div class="ai-card-block">${window.formatMarkdownMini(rawText)}</div>`;
  }

  return resumenHtml + postsHtml + relacionesHtml;
};

window.formatMarkdownMini = function(str) {
  if (!str) return '';
  // Remover asteriscos de negrita transformandolos a <strong>
  let html = str
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code style="background:var(--bg-input); padding:0.15rem 0.35rem; border-radius:4px; font-size:0.85rem; color:var(--primary);">$1</code>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
  return html;
};

window.parsePostsListToCards = function(postsText) {
  if (!postsText) return '<p style="color:var(--text-muted);">No se encontraron publicaciones específicas.</p>';
  
  // Dividir por cada publicacion (inician con * o - o numero)
  const postBlocks = postsText.split(/\n(?=\s*[\*\-]\s*\*\*)/g);
  let html = '';

  postBlocks.forEach(b => {
    const text = b.trim();
    if (!text) return;

    // Extraer titulo e ID
    let title = 'Publicación';
    let id = '';
    const titleMatch = text.match(/\*\*(.*?)\*\*\s*(?:\(ID:\s*(\d+)\))?/i);
    if (titleMatch) {
      title = titleMatch[1];
      id = titleMatch[2] || '';
    }

    // Extraer detalles de Area, Modulo, Tipo
    let area = '';
    let modulo = '';
    let tipo = '';
    let autor = '';
    let fecha = '';
    let desc = '';

    const lines = text.split('\n');
    lines.forEach(l => {
      const lineClean = l.trim();
      if (lineClean.includes('Área:') || lineClean.includes('Area:')) {
        const m = lineClean.match(/Área:\s*([^\|]+)/i) || lineClean.match(/Area:\s*([^\|]+)/i);
        if (m) area = m[1].replace(/[\*\_\🏷️🏢📁]/g, '').trim();
      }
      if (lineClean.includes('Módulo:') || lineClean.includes('Modulo:')) {
        const m = lineClean.match(/Módulo:\s*([^\|]+)/i) || lineClean.match(/Modulo:\s*([^\|]+)/i);
        if (m) modulo = m[1].replace(/[\*\_\🏷️🏢📁]/g, '').trim();
      }
      if (lineClean.includes('Tipo:')) {
        const m = lineClean.match(/Tipo:\s*([^\|]+)/i);
        if (m) tipo = m[1].replace(/[\*\_\🏷️🏢📁]/g, '').trim();
      }
      if (lineClean.includes('Autor:')) {
        const m = lineClean.match(/Autor:\s*([^\|]+)/i);
        if (m) autor = m[1].replace(/[\*\_\👤📅]/g, '').trim();
      }
      if (lineClean.includes('Fecha:')) {
        const m = lineClean.match(/Fecha:\s*([^\|]+)/i);
        if (m) fecha = m[1].replace(/[\*\_\👤📅]/g, '').trim();
      }
      if (lineClean.includes('Descripción:') || lineClean.includes('Descripcion:') || lineClean.includes('Síntesis:')) {
        const m = lineClean.match(/(?:Descripción|Descripcion|Síntesis):\s*(.*)/i);
        if (m) desc = m[1].replace(/[\*\_\📝]/g, '').trim();
      }
    });

    if (!desc && lines.length > 1) {
      desc = lines[lines.length - 1].replace(/^[\*\-\•]\s*/, '').replace(/[\*\_\📝]/g, '').trim();
    }

    const clickAction = id ? `onclick="if(window.openDetailView){ openDetailView(${id}); } else { navigateTo('#/post/${id}'); }"` : '';

    html += `
      <div class="ai-post-item">
        <div class="ai-post-header">
          <a class="ai-post-title" ${clickAction}>
            <i class="fa-solid fa-file-lines" style="color:var(--primary); margin-right:0.4rem;"></i>
            ${title}
          </a>
          ${id ? `<span class="ai-post-badge-id">ID: ${id}</span>` : ''}
        </div>
        <div class="ai-post-meta">
          ${area ? `<span class="ai-post-meta-tag"><i class="fa-solid fa-sitemap" style="color:var(--accent-cyan);"></i> ${area}</span>` : ''}
          ${modulo ? `<span class="ai-post-meta-tag"><i class="fa-solid fa-folder" style="color:var(--accent-purple);"></i> ${modulo}</span>` : ''}
          ${tipo ? `<span class="ai-post-meta-tag"><i class="fa-solid fa-tag" style="color:var(--accent-emerald);"></i> ${tipo}</span>` : ''}
          ${autor ? `<span class="ai-post-meta-tag"><i class="fa-solid fa-user"></i> ${autor}</span>` : ''}
          ${fecha ? `<span class="ai-post-meta-tag"><i class="fa-solid fa-calendar"></i> ${fecha}</span>` : ''}
        </div>
        ${desc ? `<div class="ai-post-desc">${window.formatMarkdownMini(desc)}</div>` : ''}
      </div>
    `;
  });

  return html || window.formatMarkdownMini(postsText);
};
// ==========================================================================
// Parser Visual Mejorado: Grid Dashboard, Cero IDs en UI, Cards Interactivas
// ==========================================================================
window.renderAiResponseClean = function(rawText) {
  if (!rawText) return "";

  let resumenHtml = "";
  let postsHtml = "";
  let relacionesHtml = "";

  const sections = rawText.split("###");

  sections.forEach(sec => {
    const trimmed = sec.trim();
    if (!trimmed) return;

    if (trimmed.includes("Resumen Ejecutivo") || trimmed.includes("📌")) {
      let cleanBody = trimmed.replace(/^.*Resumen Ejecutivo.*$/m, "").trim();
      // Eliminar menciones de IDs en el texto del resumen si el LLM las puso
      cleanBody = cleanBody.replace(/\(ID:\s*\d+\)/gi, "").replace(/ID:\s*\d+/gi, "");
      resumenHtml = `
        <div class="ai-hero-summary-card">
          <div class="ai-card-badge-header">
            <i class="fa-solid fa-sparkles"></i> Resumen Ejecutivo de Base de Conocimiento
          </div>
          <div style="font-size:1.02rem; line-height:1.65; color:var(--text-main); font-weight:450;">
            ${window.formatMarkdownMini(cleanBody)}
          </div>
        </div>
      `;
    } else if (trimmed.includes("Publicaciones Encontradas") || trimmed.includes("📚")) {
      const rawPosts = trimmed.replace(/^.*Publicaciones Encontradas.*$/m, "").trim();
      postsHtml = `
        <div style="margin-top: 0.5rem;">
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem; font-size:1.15rem; font-weight:700; color:var(--text-main); font-family:var(--font-heading);">
            <i class="fa-solid fa-layer-group" style="color:var(--primary);"></i> Publicaciones Identificadas
          </div>
          <div class="ai-posts-grid">
            ${window.parsePostsListToCards(rawPosts)}
          </div>
        </div>
      `;
    } else if (trimmed.includes("Relación") || trimmed.includes("Conclusiones") || trimmed.includes("🔗")) {
      const cleanRel = trimmed.replace(/^.*Relación.*$/m, "").trim();
      const lines = cleanRel.split("\n").filter(l => l.trim().length > 0);
      let nodes = "";
      lines.forEach(l => {
        let itemText = l.replace(/^[\*\-\•]\s*/, "").trim();
        // Quitar IDs de conclusiones
        itemText = itemText.replace(/\(ID:\s*\d+\)/gi, "").replace(/ID:\s*\d+/gi, "");
        if (itemText) {
          nodes += `
            <div class="ai-connection-node">
              <div class="ai-node-icon"><i class="fa-solid fa-circle-nodes"></i></div>
              <div class="ai-node-text">${window.formatMarkdownMini(itemText)}</div>
            </div>
          `;
        }
      });
      relacionesHtml = `
        <div class="ai-connections-card">
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem; font-size:1.15rem; font-weight:700; color:var(--text-main); font-family:var(--font-heading);">
            <i class="fa-solid fa-diagram-project" style="color:var(--accent-purple);"></i> Conexiones & Relaciones Temáticas
          </div>
          <div class="ai-connections-grid">
            ${nodes}
          </div>
        </div>
      `;
    }
  });

  if (!resumenHtml && !postsHtml && !relacionesHtml) {
    return `<div class="ai-hero-summary-card">${window.formatMarkdownMini(rawText.replace(/\(ID:\s*\d+\)/gi, ""))}</div>`;
  }

  return `<div class="ai-results-dashboard">${resumenHtml}${postsHtml}${relacionesHtml}</div>`;
};

window.parsePostsListToCards = function(postsText) {
  if (!postsText) return '<p style="color:var(--text-muted);">No se encontraron publicaciones específicas.</p>';

  const postBlocks = postsText.split(/\n(?=\s*[\*\-]\s*\*\*)/g);
  let html = "";

  postBlocks.forEach(b => {
    const text = b.trim();
    if (!text) return;

    let title = "Publicación";
    let internalId = "";

    // Capturar ID solo para navegación interna (abrir el post), NUNCA para mostrarlo
    const titleMatch = text.match(/\*\*(.*?)\*\*\s*(?:\(ID:\s*(\d+)\))?/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/\(ID:\s*\d+\)/gi, "").trim();
      internalId = titleMatch[2] || "";
    }

    let area = "";
    let modulo = "";
    let tipo = "";
    let autor = "";
    let fecha = "";
    let desc = "";

    const lines = text.split("\n");
    lines.forEach(l => {
      const lineClean = l.trim();
      if (lineClean.includes("Área:") || lineClean.includes("Area:")) {
        const m = lineClean.match(/Área:\s*([^\|]+)/i) || lineClean.match(/Area:\s*([^\|]+)/i);
        if (m) area = m[1].replace(/[\*\_\🏷️🏢📁]/g, "").trim();
      }
      if (lineClean.includes("Módulo:") || lineClean.includes("Modulo:")) {
        const m = lineClean.match(/Módulo:\s*([^\|]+)/i) || lineClean.match(/Modulo:\s*([^\|]+)/i);
        if (m) modulo = m[1].replace(/[\*\_\🏷️🏢📁]/g, "").trim();
      }
      if (lineClean.includes("Tipo:")) {
        const m = lineClean.match(/Tipo:\s*([^\|]+)/i);
        if (m) tipo = m[1].replace(/[\*\_\🏷️🏢📁]/g, "").trim();
      }
      if (lineClean.includes("Autor:")) {
        const m = lineClean.match(/Autor:\s*([^\|]+)/i);
        if (m) autor = m[1].replace(/[\*\_\👤📅]/g, "").trim();
      }
      if (lineClean.includes("Fecha:")) {
        const m = lineClean.match(/Fecha:\s*([^\|]+)/i);
        if (m) fecha = m[1].replace(/[\*\_\👤📅]/g, "").trim();
      }
      if (lineClean.includes("Descripción:") || lineClean.includes("Descripcion:") || lineClean.includes("Síntesis:")) {
        const m = lineClean.match(/(?:Descripción|Descripcion|Síntesis):\s*(.*)/i);
        if (m) desc = m[1].replace(/[\*\_\📝]/g, "").trim();
      }
    });

    if (!desc && lines.length > 1) {
      desc = lines[lines.length - 1].replace(/^[\*\-\•]\s*/, "").replace(/[\*\_\📝]/g, "").trim();
    }

    desc = desc.replace(/\(ID:\s*\d+\)/gi, "").replace(/ID:\s*\d+/gi, "").trim();

    const clickAction = internalId 
      ? `onclick="if(window.openDetailView){ openDetailView(${internalId}); } else { navigateTo('#/post/${internalId}'); }"`
      : `onclick="navigateTo('#/dashboard');"`;

    html += `
      <div class="ai-post-modern-card">
        <div class="ai-post-card-top">
          <div class="ai-pills-row">
            ${area ? `<span class="ai-pill ai-pill-area"><i class="fa-solid fa-sitemap"></i> ${area}</span>` : ""}
            ${modulo ? `<span class="ai-pill ai-pill-modulo"><i class="fa-solid fa-folder"></i> ${modulo}</span>` : ""}
            ${tipo ? `<span class="ai-pill ai-pill-tipo"><i class="fa-solid fa-tag"></i> ${tipo}</span>` : ""}
          </div>
          <h4 class="ai-post-card-title" ${clickAction} title="Ver detalles de esta publicación">
            ${title}
          </h4>
          <p class="ai-post-card-desc">${window.formatMarkdownMini(desc)}</p>
        </div>
        <div class="ai-post-card-footer">
          <span><i class="fa-regular fa-user" style="margin-right:0.3rem;"></i> ${autor || "CentroAguas"}</span>
          <span><i class="fa-regular fa-calendar" style="margin-right:0.3rem;"></i> ${fecha || "Reciente"}</span>
        </div>
      </div>
    `;
  });

  return html || window.formatMarkdownMini(postsText);
};
// ==========================================================================
// Renderizador Estructurado Definitivo de Respuestas IA Prixma
// ==========================================================================
window.renderAiResponseObject = function(data) {
  if (!data) return '<p class="text-muted">Sin información recibida.</p>';

  // Si vino en formato estructurado (DTO)
  const resumen = data.resumen || data.Resumen || '';
  const publicaciones = data.publicaciones || data.Publicaciones || [];
  const relaciones = data.relaciones || data.Relaciones || [];

  // Si vino texto libre fallback
  if (!publicaciones.length && !relaciones.length && resumen) {
    if (window.renderAiResponseClean) {
      return window.renderAiResponseClean(resumen);
    }
  }

  let html = '<div class="ai-results-container">';

  // 1. Resumen Ejecutivo
  if (resumen) {
    html += `
      <div class="ai-resumen-banner">
        <div class="ai-resumen-tag">
          <i class="fa-solid fa-sparkles"></i> Resumen de Análisis
        </div>
        <p class="ai-resumen-texto">${window.formatMarkdownMini(resumen)}</p>
      </div>
    `;
  }

  // 2. Publicaciones en Grid
  if (publicaciones && publicaciones.length > 0) {
    html += `
      <div>
        <div class="ai-section-title">
          <i class="fa-solid fa-layer-group" style="color:var(--primary);"></i>
          <span>Publicaciones Relevantes (${publicaciones.length})</span>
        </div>
        <div class="ai-posts-cards-grid">
    `;

    publicaciones.forEach(p => {
      const id = p.id || p.Id || '';
      const titulo = p.titulo || p.Titulo || 'Sin título';
      const area = p.area || p.Area || '';
      const modulo = p.modulo || p.Modulo || '';
      const tipo = p.tipo || p.Tipo || '';
      const autor = p.autor || p.Autor || 'CentroAguas';
      const fecha = p.fecha || p.Fecha || '';
      const desc = p.descripcion || p.Descripcion || '';

      const clickAction = id ? `onclick="window.openPostInNewTab(${id})"` : `onclick="navigateTo('#/dashboard');"`;

      html += `
        <div class="ai-card-post" ${clickAction} title="Clic para abrir esta publicación">
          <div class="ai-card-post-header">
            <div class="ai-card-post-pills">
              ${area ? `<span class="ai-pill ai-pill-area"><i class="fa-solid fa-sitemap"></i> ${area}</span>` : ''}
              ${modulo ? `<span class="ai-pill ai-pill-modulo"><i class="fa-solid fa-folder"></i> ${modulo}</span>` : ''}
              ${tipo ? `<span class="ai-pill ai-pill-tipo"><i class="fa-solid fa-tag"></i> ${tipo}</span>` : ''}
            </div>
            <h4 class="ai-card-post-title">${titulo}</h4>
            <p class="ai-card-post-desc">${window.formatMarkdownMini(desc)}</p>
          </div>
          <div class="ai-card-post-meta">
            <span><i class="fa-regular fa-user" style="margin-right:0.3rem;"></i> ${autor}</span>
            <span><i class="fa-regular fa-calendar" style="margin-right:0.3rem;"></i> ${fecha}</span>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  }

  // 3. Relaciones, Puntos Clave & Sinergia
  if (relaciones && relaciones.length > 0) {
    html += `
      <div class="ai-relaciones-panel" style="border-left: 4px solid var(--accent-purple); padding:1.25rem 1.4rem; background:var(--bg-card); border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,0.05); margin-top:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid var(--bg-card-border); padding-bottom:0.6rem;">
          <div style="font-size:1.05rem; font-weight:700; color:var(--text-main); font-family:var(--font-heading); display:flex; align-items:center; gap:0.5rem;">
            <i class="fa-solid fa-diagram-project" style="color:var(--accent-purple);"></i>
            <span>Relaciones & Puntos Clave de la Arquitectura</span>
          </div>
          <span style="font-size:0.75rem; background:rgba(168,85,247,0.12); color:var(--accent-purple); padding:2px 8px; border-radius:12px; font-weight:600;">
            ${relaciones.length} conexiones detectadas
          </span>
        </div>
        <ul class="ai-relaciones-list" style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:0.75rem;">
    `;

    relaciones.forEach(r => {
      // Limpiar menciones de ID crudo si vienen
      let cleanR = r.replace(/\(ID:\s*\d+\)/gi, '').replace(/ID:\s*\d+/gi, '').trim();

      // Detectar si tiene prefijo temático
      let icon = 'fa-circle-nodes';
      let iconColor = 'var(--accent-purple)';

      if (cleanR.includes('⚠️') || cleanR.toLowerCase().includes('alerta') || cleanR.toLowerCase().includes('riesgo')) {
        icon = 'fa-triangle-exclamation';
        iconColor = 'var(--accent-amber)';
      } else if (cleanR.includes('💡') || cleanR.toLowerCase().includes('recomend') || cleanR.toLowerCase().includes('impacto')) {
        icon = 'fa-lightbulb';
        iconColor = 'var(--primary)';
      } else if (cleanR.includes('📌') || cleanR.toLowerCase().includes('flujo') || cleanR.toLowerCase().includes('orden') || cleanR.toLowerCase().includes('paso')) {
        icon = 'fa-route';
        iconColor = 'var(--accent-emerald)';
      }

      html += `
        <li class="ai-relacion-item" style="display:flex; align-items:flex-start; gap:0.75rem; padding:0.75rem 1rem; background:var(--bg-dark); border:1px solid var(--bg-card-border); border-radius:8px; line-height:1.55; font-size:0.92rem; color:var(--text-main);">
          <i class="fa-solid ${icon}" style="color:${iconColor}; font-size:1rem; margin-top:0.2rem; flex-shrink:0;"></i>
          <span>${window.formatMarkdownMini(cleanR)}</span>
        </li>
      `;
    });

    html += `
        </ul>
      </div>
    `;
  }

  html += '</div>';
  return html;
};

// Actualizar controlador del buscador
window.handleAiSearchSubmit = async function(event) {
  event.preventDefault();
  const input = document.getElementById('aiSearchInput');
  const btn = document.getElementById('btnAiSearchSubmit');
  const loader = document.getElementById('aiSearchLoader');
  const resultsCard = document.getElementById('aiSearchResults');
  const resultsContent = document.getElementById('aiResultsContent');

  if (!input || !loader || !resultsCard || !resultsContent) return;

  const pregunta = input.value.trim();
  if (!pregunta) return;

  loader.style.display = 'block';
  resultsCard.style.display = 'none';
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/Chat/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      resultsContent.innerHTML = `<div class="alert-error-banner" style="display:flex; margin:1rem 0;">${err.mensaje || err.message || 'Error en la consulta.'}</div>`;
    } else {
      const data = await res.json();
      resultsContent.innerHTML = window.renderAiResponseObject(data);
    }
    resultsCard.style.display = 'block';
  } catch (error) {
    resultsContent.innerHTML = `<div class="alert-error-banner" style="display:flex; margin:1rem 0;">Error de conexión: ${error.message}</div>`;
    resultsCard.style.display = 'block';
  } finally {
    loader.style.display = 'none';
    if (btn) btn.disabled = false;
    resultsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};
// ==========================================================================
// Renderizador en 2 Columnas: Cero Espacios Vacíos y Aprovechamiento Total
// ==========================================================================
window.renderAiResponseObject = function(data) {
  if (!data) return '<p class="text-muted">Sin información recibida.</p>';

  const resumen = data.resumen || data.Resumen || '';
  const publicaciones = data.publicaciones || data.Publicaciones || [];
  const relaciones = data.relaciones || data.Relaciones || [];

  if (!publicaciones.length && !relaciones.length && resumen) {
    if (window.renderAiResponseClean) {
      return window.renderAiResponseClean(resumen);
    }
  }

  let html = '<div class="ai-results-container">';

  // 1. Fila Superior Equilibrada: Resumen (Izquierda) + Relaciones/Conclusiones (Derecha)
  if (resumen || (relaciones && relaciones.length > 0)) {
    html += '<div class="ai-top-insights-grid">';

    // Columna Izquierda: Resumen
    if (resumen) {
      html += `
        <div class="ai-resumen-banner">
          <div class="ai-resumen-tag">
            <i class="fa-solid fa-sparkles"></i> Resumen de Análisis
          </div>
          <p class="ai-resumen-texto">${window.formatMarkdownMini(resumen)}</p>
        </div>
      `;
    }

    // Columna Derecha: Conexiones y Conclusiones
    if (relaciones && relaciones.length > 0) {
      html += `
        <div class="ai-relaciones-panel">
          <div class="ai-relaciones-header">
            <i class="fa-solid fa-diagram-project"></i> Relaciones & Puntos Clave
          </div>
          <ul class="ai-relaciones-list">
      `;
      relaciones.forEach(r => {
        html += `
          <li class="ai-relacion-item">
            <i class="fa-solid fa-circle-nodes ai-relacion-icon"></i>
            <span>${window.formatMarkdownMini(r)}</span>
          </li>
        `;
      });
      html += `
          </ul>
        </div>
      `;
    }

    html += '</div>';
  }

  // 2. Fila Inferior: Publicaciones Relevantes
  if (publicaciones && publicaciones.length > 0) {
    html += `
      <div class="ai-posts-section">
        <div class="ai-section-title">
          <i class="fa-solid fa-layer-group" style="color:var(--primary);"></i>
          <span>Publicaciones Relevantes (${publicaciones.length})</span>
        </div>
        <div class="ai-posts-cards-grid">
    `;

    publicaciones.forEach(p => {
      const id = p.id || p.Id || '';
      const titulo = p.titulo || p.Titulo || 'Sin título';
      const area = p.area || p.Area || '';
      const modulo = p.modulo || p.Modulo || '';
      const tipo = p.tipo || p.Tipo || '';
      const autor = p.autor || p.Autor || 'CentroAguas';
      const fecha = p.fecha || p.Fecha || '';
      const desc = p.descripcion || p.Descripcion || '';

      const clickAction = id ? `onclick="window.openPostInNewTab(${id})"` : `onclick="navigateTo('#/dashboard');"`;

      html += `
        <div class="ai-card-post" ${clickAction} title="Clic para abrir esta publicación">
          <div class="ai-card-post-header">
            <div class="ai-card-post-pills">
              ${area ? `<span class="ai-pill ai-pill-area"><i class="fa-solid fa-sitemap"></i> ${area}</span>` : ''}
              ${modulo ? `<span class="ai-pill ai-pill-modulo"><i class="fa-solid fa-folder"></i> ${modulo}</span>` : ''}
              ${tipo ? `<span class="ai-pill ai-pill-tipo"><i class="fa-solid fa-tag"></i> ${tipo}</span>` : ''}
            </div>
            <h4 class="ai-card-post-title">${titulo}</h4>
            <p class="ai-card-post-desc">${window.formatMarkdownMini(desc)}</p>
          </div>
          <div class="ai-card-post-meta">
            <span><i class="fa-regular fa-user" style="margin-right:0.3rem;"></i> ${autor}</span>
            <span><i class="fa-regular fa-calendar" style="margin-right:0.3rem;"></i> ${fecha}</span>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  }

  html += '</div>';
  return html;
};
// ==========================================================================
// Renderizador con Boton "Eye" y Cards Visuales de Alta Calidad
// ==========================================================================
window.renderAiResponseObject = function(data) {
  if (!data) return '<p class="text-muted">Sin información recibida.</p>';

  const resumen = data.resumen || data.Resumen || '';
  const publicaciones = data.publicaciones || data.Publicaciones || [];
  const relaciones = data.relaciones || data.Relaciones || [];

  if (!publicaciones.length && !relaciones.length && resumen) {
    if (window.renderAiResponseClean) {
      return window.renderAiResponseClean(resumen);
    }
  }

  let html = '<div class="ai-results-container">';

  // 1. Fila Superior en Grid Armónico: Resumen (Izquierda) + Relaciones/Conclusiones (Derecha)
  if (resumen || (relaciones && relaciones.length > 0)) {
    html += '<div class="ai-top-insights-grid">';

    if (resumen) {
      html += `
        <div class="ai-resumen-banner">
          <div class="ai-resumen-tag">
            <i class="fa-solid fa-sparkles"></i> Resumen de Análisis
          </div>
          <p class="ai-resumen-texto">${window.formatMarkdownMini(resumen)}</p>
        </div>
      `;
    }

    if (relaciones && relaciones.length > 0) {
      html += `
        <div class="ai-relaciones-panel">
          <div class="ai-relaciones-header">
            <i class="fa-solid fa-diagram-project"></i> Relaciones & Puntos Clave
          </div>
          <ul class="ai-relaciones-list">
      `;
      relaciones.forEach(r => {
        html += `
          <li class="ai-relacion-item">
            <i class="fa-solid fa-circle-nodes ai-relacion-icon"></i>
            <span>${window.formatMarkdownMini(r)}</span>
          </li>
        `;
      });
      html += `
          </ul>
        </div>
      `;
    }

    html += '</div>';
  }

  // 2. Fila Inferior: Publicaciones Relevantes con Boton Eye
  if (publicaciones && publicaciones.length > 0) {
    html += `
      <div class="ai-posts-section">
        <div class="ai-section-title">
          <i class="fa-solid fa-layer-group" style="color:var(--primary);"></i>
          <span>Publicaciones Relevantes (${publicaciones.length})</span>
        </div>
        <div class="ai-posts-cards-grid">
    `;

    publicaciones.forEach(p => {
      const id = p.id || p.Id || '';
      const titulo = p.titulo || p.Titulo || 'Sin título';
      const area = p.area || p.Area || '';
      const modulo = p.modulo || p.Modulo || '';
      const tipo = p.tipo || p.Tipo || '';
      const autor = p.autor || p.Autor || 'CentroAguas';
      const fecha = p.fecha || p.Fecha || '';
      const desc = p.descripcion || p.Descripcion || '';

      const clickAction = id ? `onclick="window.openPostInNewTab(${id})"` : `onclick="navigateTo('#/dashboard');"`;

      html += `
        <div class="ai-card-post">
          <div>
            <div class="ai-card-top-row">
              <div class="ai-card-post-pills">
                ${area ? `<span class="ai-pill ai-pill-area"><i class="fa-solid fa-sitemap"></i> ${area}</span>` : ''}
                ${modulo ? `<span class="ai-pill ai-pill-modulo"><i class="fa-solid fa-folder"></i> ${modulo}</span>` : ''}
                ${tipo ? `<span class="ai-pill ai-pill-tipo"><i class="fa-solid fa-tag"></i> ${tipo}</span>` : ''}
              </div>
              <button class="ai-btn-view-post" ${clickAction} title="Ver publicación completa">
                <i class="fa-solid fa-eye"></i>
              </button>
            </div>

            <h4 class="ai-card-post-title" ${clickAction} title="Ver publicación completa">
              ${titulo}
            </h4>
            <p class="ai-card-post-desc">${window.formatMarkdownMini(desc)}</p>
          </div>

          <div class="ai-card-post-meta">
            <span class="ai-meta-item"><i class="fa-regular fa-user"></i> ${autor}</span>
            <span class="ai-meta-item"><i class="fa-regular fa-calendar"></i> ${fecha}</span>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  }

  html += '</div>';
  return html;
};