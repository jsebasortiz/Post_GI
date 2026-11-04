import { state } from '../core/state.js';
import { apiFetch } from '../core/api.js';
import { escapeHtml, formatDate, formatRelativeTime, estimateReadingTime, formatBytes } from '../core/utils.js';
import { getPrixmaSwal, setFormSkeletonState, startTopProgressBar, finishTopProgressBar } from '../core/ui-helpers.js';
import { hasPermission, showAuthGate } from './auth.js';
import { getFileMeta, autoSelectDefaultImageCover, renderFilePreviews } from './attachments.js';
import { populateAreaSelects } from './areas.js';
import { loadModulos } from './modulos.js';
import { loadEditPostTipos, loadTiposConocimiento } from './tipos.js';

export function isImageUrl(url) {
  if (!url) return false;
  const cleanUrl = url.split('?')[0].toLowerCase();
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.ico', '.avif'];
  return validExtensions.some(ext => cleanUrl.endsWith(ext)) || cleanUrl.startsWith('data:image/');
}

// Catálogo de portadas predeterminadas en 10 colores vibrantes
const DEFAULT_PORTADAS = [
  'images/portada-azul.jpg',
  'images/portada-esmeralda.jpg',
  'images/portada-turquesa.jpg',
  'images/portada-purpura.jpg',
  'images/portada-indigo.jpg',
  'images/portada-magenta.jpg',
  'images/portada-rojo.jpg',
  'images/portada-naranja.jpg',
  'images/portada-dorado.jpg',
  'images/portada-verde.jpg'
];

export function getPostCoverUrl(post) {
  if (post.portadaUrl && isImageUrl(post.portadaUrl)) {
    return post.portadaUrl;
  }
  if (post.adjuntos && post.adjuntos.length > 0) {
    const imgAdj = post.adjuntos.find(a => isImageUrl(a.archivoUrl));
    if (imgAdj) return imgAdj.archivoUrl;
  }
  // Asignar determinísticamente una de las 10 portadas según el ID del post
  const idNum = Number(post.id) || 0;
  const index = Math.abs(idNum) % DEFAULT_PORTADAS.length;
  return DEFAULT_PORTADAS[index];
}

export function renderPostCard(post) {
  const coverUrl = getPostCoverUrl(post);
  const coverHtml = `<img src="${coverUrl}" alt="${escapeHtml(post.titulo)}" loading="lazy" onerror="this.onerror=null; this.src='images/portada.jpg';">`;

  const dateStr = formatDate(post.creadoEn);
  const attachCount = post.adjuntos ? post.adjuntos.length : 0;

  const canEdit = hasPermission('posts.edit');
  const canDelete = hasPermission('posts.delete');

  const actionsHtml = (canEdit || canDelete) ? `
    <div class="post-card-actions">
      ${canEdit ? `<button class="btn-card-action" onclick="event.stopPropagation(); openEditModal(${post.id})" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>` : ''}
      ${canDelete ? `<button class="btn-card-action btn-card-delete" onclick="event.stopPropagation(); handleDeletePost(${post.id})" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>` : ''}
    </div>
  ` : '';

  // Badges sobre la imagen
  const isInfra = (post.moduloCategoriaPadre || '').toLowerCase().includes('infra');
  const catLabel = isInfra ? 'Infraestructura' : (post.moduloCategoriaPadre || 'Aplicaciones');
  const catClass = isInfra ? 'badge-cat-infra' : 'badge-cat-apps';
  const catIcon = isInfra ? 'fa-server' : 'fa-rocket';

  let badgesOverlay = `
    <div class="post-card-badges">
      <span class="badge ${catClass}"><i class="fa-solid ${catIcon}"></i> ${escapeHtml(catLabel)}</span>
      ${post.moduloNombre ? `<span class="badge badge-module"><i class="fa-solid fa-folder"></i> ${escapeHtml(post.moduloNombre)}</span>` : ''}
    </div>
  `;

  let tagsHtml = '';
  if (post.palabrasClave) {
    const tags = post.palabrasClave.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length > 0) {
      tagsHtml = `<div class="post-tags">` +
        tags.slice(0, 3).map(tag => `<span class="post-tag-chip"><i class="fa-solid fa-hashtag"></i>${escapeHtml(tag)}</span>`).join('') +
        (tags.length > 3 ? `<span class="post-tag-more">+${tags.length - 3}</span>` : '') +
        `</div>`;
    }
  }

  return `
    <article class="post-card" onclick="openDetailModal(${post.id})">
      ${actionsHtml}
      <div class="post-cover">
        ${coverHtml}
        <div class="post-cover-overlay"></div>
        ${badgesOverlay}
      </div>
      <div class="post-body">
        <h3 class="post-title" title="${escapeHtml(post.titulo)}">${escapeHtml(post.titulo)}</h3>
        <p class="post-summary">${escapeHtml(post.resumen || post.contenido)}</p>
        ${tagsHtml}
        <div class="post-meta">
          <div class="author-info" title="${escapeHtml(post.usuarioNombre)}">
            <div class="avatar-sm">${escapeHtml(post.usuarioNombre.charAt(0).toUpperCase())}</div>
            <span class="author-name">${escapeHtml(post.usuarioNombre)}</span>
          </div>
          <div class="post-meta-right">
            ${attachCount > 0 ? `<span class="post-attachments-count" title="${attachCount} archivo(s) adjunto(s)"><i class="fa-solid fa-paperclip"></i> ${attachCount}</span>` : ''}
            <span class="post-card-date" title="${dateStr}">${formatRelativeTime(post.creadoEn)}</span>
          </div>
        </div>
      </div>
    </article>
  `;
}

export async function loadPosts(page = 1) {
  state.currentPage = page;
  const grid = document.getElementById('postsGrid');
  const pagination = document.getElementById('paginationContainer');
  if (!grid) return;

  grid.innerHTML = Array.from({ length: 6 }).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-box" style="height:135px; width:100%;"></div>
      <div style="padding:1rem;">
        <div class="skeleton-box" style="height:14px; width:35%; margin-bottom:0.75rem; border-radius:10px;"></div>
        <div class="skeleton-box" style="height:20px; width:85%; margin-bottom:0.75rem; border-radius:6px;"></div>
        <div class="skeleton-box" style="height:14px; width:95%; margin-bottom:0.4rem; border-radius:4px;"></div>
        <div class="skeleton-box" style="height:14px; width:65%; margin-bottom:1.25rem; border-radius:4px;"></div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--bg-card-border); padding-top:0.75rem;">
          <div class="skeleton-box" style="height:14px; width:40%; border-radius:4px;"></div>
          <div class="skeleton-box" style="height:14px; width:25%; border-radius:4px;"></div>
        </div>
      </div>
    </div>
  `).join('');

  try {
    let url = `/api/posts?estado=publicado&page=${state.currentPage}&pageSize=${state.pageSize}`;
    if (state.currentCategoriaPadre) url += `&categoriaPadre=${encodeURIComponent(state.currentCategoriaPadre)}`;
    if (state.currentModuloId) url += `&moduloId=${state.currentModuloId}`;
    if (state.currentSearch) url += `&search=${encodeURIComponent(state.currentSearch)}`;

    const res = await apiFetch(url);
    if (!res.ok) throw new Error('No se pudieron obtener las publicaciones.');

    const pagedResult = await res.json();
    const posts = pagedResult.items || [];
    state.totalItems = pagedResult.totalItems || 0;
    state.totalPages = pagedResult.totalPages || 1;

    if (!posts || posts.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 4rem 1rem;">
          <i class="fa-solid fa-folder-open fa-3x" style="margin-bottom: 1rem; color: var(--primary);"></i>
          <h3>No se encontraron publicaciones</h3>
          <p style="font-size:0.9rem; margin-top:0.5rem;">Intenta seleccionar otro módulo o crea una nueva publicación.</p>
        </div>
      `;
      if (pagination) pagination.innerHTML = '';
      return;
    }

    grid.innerHTML = posts.map(post => renderPostCard(post)).join('');
    renderPaginationControls();
  } catch (err) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--accent-rose); padding: 3rem;">
        <i class="fa-solid fa-triangle-exclamation fa-2x"></i>
        <p style="margin-top: 0.5rem;">${escapeHtml(err.message)}</p>
      </div>
    `;
    if (pagination) pagination.innerHTML = '';
  }
}

export function renderPaginationControls() {
  const pagination = document.getElementById('paginationContainer');
  if (!pagination) return;

  if (state.totalItems === 0 || state.totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  const startItem = (state.currentPage - 1) * state.pageSize + 1;
  const endItem = Math.min(state.currentPage * state.pageSize, state.totalItems);

  let pagesHtml = '';

  pagesHtml += `
    <button class="page-btn" ${state.currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${state.currentPage - 1})" title="Página Anterior">
      <i class="fa-solid fa-chevron-left"></i>
    </button>
  `;

  const maxVisiblePages = 5;
  let startPage = Math.max(1, state.currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(state.totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    pagesHtml += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
    if (startPage > 2) {
      pagesHtml += `<span class="page-btn page-btn-ellipsis">&hellip;</span>`;
    }
  }

  for (let p = startPage; p <= endPage; p++) {
    pagesHtml += `
      <button class="page-btn ${p === state.currentPage ? 'active' : ''}" onclick="goToPage(${p})">
        ${p}
      </button>
    `;
  }

  if (endPage < state.totalPages) {
    if (endPage < state.totalPages - 1) {
      pagesHtml += `<span class="page-btn page-btn-ellipsis">&hellip;</span>`;
    }
    pagesHtml += `<button class="page-btn" onclick="goToPage(${state.totalPages})">${state.totalPages}</button>`;
  }

  pagesHtml += `
    <button class="page-btn" ${state.currentPage === state.totalPages ? 'disabled' : ''} onclick="goToPage(${state.currentPage + 1})" title="Página Siguiente">
      <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;

  pagination.innerHTML = `
    <div class="pagination-info">
      Mostrando <strong>${startItem} - ${endItem}</strong> de <strong>${state.totalItems}</strong> publicaciones
    </div>
    <div class="pagination-nav">
      ${pagesHtml}
    </div>
  `;
}

export function goToPage(page) {
  if (page < 1 || page > state.totalPages || page === state.currentPage) return;
  loadPosts(page);
  const grid = document.getElementById('postsGrid');
  if (grid) {
    grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export function debounceSearch() {
  clearTimeout(state.searchDebounceTimer);
  state.searchDebounceTimer = setTimeout(() => {
    state.currentSearch = document.getElementById('searchInput').value.trim();
    loadPosts(1);
  }, 350);
}


// ==========================================================================
// Gestor de Etiquetas Interactivas (Interactive Tag Input)
// ==========================================================================
export let postTagsList = [];

export function renderPostTags() {
  const container = document.getElementById('postTagChips');
  const hiddenInput = document.getElementById('postPalabrasClave');
  if (!container || !hiddenInput) return;

  container.innerHTML = postTagsList.map((tag, idx) => `
    <span class="tag-chip">
      <i class="fa-solid fa-hashtag" style="font-size:0.65rem; opacity:0.8;"></i>
      <span>${escapeHtml(tag)}</span>
      <button type="button" class="tag-chip-remove" onclick="removePostTag(${idx})" title="Eliminar etiqueta">&times;</button>
    </span>
  `).join('');

  hiddenInput.value = postTagsList.join(', ');
}

export function addPostTag(rawTag) {
  if (!rawTag) return;
  const clean = rawTag.trim().toLowerCase().replace(/[^a-záéíóúüñ0-9\-_\s]/g, '').trim();
  if (clean && !postTagsList.includes(clean)) {
    postTagsList.push(clean);
    renderPostTags();
  }
  const input = document.getElementById('postTagInput');
  if (input) input.value = '';
}

export function removePostTag(index) {
  if (index >= 0 && index < postTagsList.length) {
    postTagsList.splice(index, 1);
    renderPostTags();
  }
}

export function initPostTagInput() {
  postTagsList = [];
  const input = document.getElementById('postTagInput');
  const hidden = document.getElementById('postPalabrasClave');
  if (hidden && hidden.value) {
    postTagsList = hidden.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  }
  renderPostTags();

  if (input && !input.dataset.tagBound) {
    input.dataset.tagBound = 'true';
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addPostTag(input.value);
      } else if (e.key === 'Backspace' && !input.value && postTagsList.length > 0) {
        removePostTag(postTagsList.length - 1);
      }
    });

    input.addEventListener('blur', () => {
      if (input.value.trim()) {
        addPostTag(input.value);
      }
    });
  }
}

export async function handleCreatePost(event) {
  if (event) event.preventDefault();

  if (!state.currentUser) {
    getPrixmaSwal().fire({
      icon: 'info',
      title: 'Autenticación Requerida',
      text: 'Por favor inicia sesión con tu cuenta de Microsoft 365 antes de publicar.'
    });
    showAuthGate();
    return;
  }

  const btn = document.getElementById('btnSubmitPost');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
  }

  try {
    const formData = new FormData();
    formData.append('UsuarioId', state.currentUser.id);
    formData.append('ModuloId', document.getElementById('selectModulo').value);
    formData.append('TipoId', document.getElementById('selectTipo').value);
    const tcIdVal = document.getElementById('selectTipoConocimiento').value;
    if (tcIdVal) formData.append('TipoConocimientoId', tcIdVal);
    formData.append('PalabrasClave', document.getElementById('postPalabrasClave').value.trim());
    formData.append('Titulo', document.getElementById('postTitulo').value);
    formData.append('Resumen', document.getElementById('postResumen').value);
    formData.append('Contenido', document.getElementById('postContenido').value);
    formData.append('Estado', 'publicado');
    formData.append('PortadaIndex', state.coverIndex);

    state.selectedFiles.forEach(file => {
      formData.append('Archivos', file);
    });

    const res = await apiFetch('/api/posts', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.message || 'Error al guardar la publicación.');
    }

    const form = document.getElementById('createPostForm');
    if (form) form.reset();
    state.selectedFiles = [];
    renderFilePreviews();
    postTagsList = [];
    renderPostTags();

    if (window.navigateTo) window.navigateTo('/dashboard');
    await loadPosts(1);

    getPrixmaSwal().fire({
      icon: 'success',
      title: '¡Publicación Creada!',
      text: 'Tu artículo ha sido publicado correctamente.',
      timer: 2000,
      showConfirmButton: false
    });
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error de Publicación',
      text: err.message
    });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publicar Ahora';
    }
  }
}

export async function openDetailView(postId) {
  const titleEl = document.getElementById('detailTitle');
  const badgesEl = document.getElementById('detailBadges');
  const metaEl = document.getElementById('detailMeta');
  const contentEl = document.getElementById('detailContent');

  if (badgesEl) badgesEl.innerHTML = `<div class="skeleton-box" style="height:22px; width:180px; border-radius:12px;"></div>`;
  if (titleEl) titleEl.innerHTML = `<div class="skeleton-box" style="height:30px; width:70%; border-radius:6px; margin:0.4rem 0;"></div>`;
  if (metaEl) metaEl.innerHTML = `<div class="skeleton-box" style="height:16px; width:220px; border-radius:4px;"></div>`;
  if (contentEl) contentEl.innerHTML = `<div class="skeleton-box" style="height:18px; width:95%; margin-bottom:0.5rem; border-radius:4px;"></div><div class="skeleton-box" style="height:18px; width:80%; margin-bottom:0.5rem; border-radius:4px;"></div><div class="skeleton-box" style="height:18px; width:60%; border-radius:4px;"></div>`;

  try {
    const res = await apiFetch(`/api/posts/${postId}`);
    if (!res.ok) {
      if (window.navigateTo) window.navigateTo('/dashboard');
      return;
    }
    const post = await res.json();

    // Determinar nombres y valores
    const areaNombre = (post.moduloCategoriaPadre === 'infraestructura' || (post.moduloCategoriaPadre && post.moduloCategoriaPadre.toLowerCase().includes('infra')))
      ? 'Infraestructura'
      : (post.moduloCategoriaPadre ? post.moduloCategoriaPadre.charAt(0).toUpperCase() + post.moduloCategoriaPadre.slice(1) : 'Aplicaciones');
    const areaIcon = areaNombre.toLowerCase().includes('infra') ? 'fa-server' : 'fa-rocket';
    const areaClass = areaNombre.toLowerCase().includes('infra') ? 'badge-cat-infra' : 'badge-cat-apps';

    const moduloNombre = post.moduloNombre || 'Sin Módulo';
    const tipoNombre = post.tipoNombre || 'Sin Tipo';
    const tipoConocimientoNombre = post.tipoConocimientoNombre || 'No especificado';
    const palabrasClave = post.palabrasClave ? post.palabrasClave.trim() : '';

    // Badges en la cabecera
    if (document.getElementById('detailBadges')) {
      document.getElementById('detailBadges').innerHTML = `
        <span class="badge ${areaClass}" style="position:static;"><i class="fa-solid ${areaIcon}"></i> ${escapeHtml(areaNombre)}</span>
        <span class="badge badge-module" style="position:static; margin-left:0.5rem;"><i class="fa-solid fa-folder"></i> ${escapeHtml(moduloNombre)}</span>
        <span class="badge badge-type" style="position:static; margin-left:0.5rem;"><i class="fa-solid fa-tag"></i> ${escapeHtml(tipoNombre)}</span>
        ${post.tipoConocimientoNombre ? `<span class="badge" style="position:static; margin-left:0.5rem; background:var(--accent-purple); color:#fff;"><i class="fa-solid fa-brain"></i> ${escapeHtml(post.tipoConocimientoNombre)}</span>` : ''}
      `;
    }

    if (document.getElementById('detailTitle')) {
      document.getElementById('detailTitle').innerText = post.titulo || 'Sin Título';
    }

    const headerActions = document.getElementById('detailHeaderActions');
    if (headerActions) {
      let actHtml = '';
      if (hasPermission('posts.edit')) {
        actHtml += `<button class="btn btn-secondary" style="padding:0.35rem 0.75rem; font-size:0.85rem;" onclick="navigateTo('/posts/edit/${post.id}')"><i class="fa-solid fa-pen-to-square"></i> Editar</button>`;
      }
      if (hasPermission('posts.delete')) {
        actHtml += `<button class="btn btn-danger" style="padding:0.35rem 0.75rem; font-size:0.85rem;" onclick="handleDeletePost(${post.id})"><i class="fa-solid fa-trash-can"></i> Eliminar</button>`;
      }
      headerActions.innerHTML = actHtml;
    }

    const dateStr = formatDate(post.creadoEn);
    const updatedStr = (post.actualizadoEn && post.actualizadoEn !== post.creadoEn) ? formatDate(post.actualizadoEn) : null;
    const estadoTxt = post.estado || 'publicado';

    // Barra de Metadatos
    if (document.getElementById('detailMeta')) {
      document.getElementById('detailMeta').innerHTML = `
        <span title="Autor del artículo"><i class="fa-solid fa-circle-user" style="color:var(--primary);"></i> <strong>${escapeHtml(post.usuarioNombre)}</strong></span>
        <span title="Fecha de publicación" style="white-space:nowrap;"><i class="fa-regular fa-calendar" style="color:var(--accent-cyan);"></i> Publicado: ${dateStr}</span>
        ${updatedStr ? `<span title="Última actualización" style="white-space:nowrap;"><i class="fa-solid fa-clock-rotate-left" style="color:var(--accent-amber);"></i> Editado: ${updatedStr}</span>` : ''}
        <span title="Estado del post" class="badge" style="font-size:0.72rem; padding:2px 8px; background:rgba(16,185,129,0.15); color:var(--accent-emerald); border:1px solid rgba(16,185,129,0.3); border-radius:12px;"><i class="fa-solid fa-check"></i> ${escapeHtml(estadoTxt.toUpperCase())}</span>
      `;
    }

    // Panel de Ficha Técnica / Datos Clasificatorios del Post
    let infoGridEl = document.getElementById('detailInfoGrid');
    if (!infoGridEl) {
      const metaBar = document.getElementById('detailMeta');
      if (metaBar) {
        metaBar.insertAdjacentHTML('afterend', `
          <div id="detailInfoGrid" class="post-detail-info-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; padding:1.25rem; background:rgba(15,23,42,0.03); border:1px solid var(--bg-card-border); border-radius:12px; margin-bottom:1.75rem;">
          </div>
        `);
        infoGridEl = document.getElementById('detailInfoGrid');
      }
    }

    if (infoGridEl) {
      infoGridEl.innerHTML = `
        <div class="info-grid-item">
          <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); font-weight:700; margin-bottom:0.25rem;">
            <i class="fa-solid ${areaIcon}" style="color:var(--primary);"></i> Área / Categoría
          </div>
          <div style="font-weight:600; color:var(--text-main); font-size:0.95rem;">${escapeHtml(areaNombre)}</div>
        </div>

        <div class="info-grid-item">
          <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); font-weight:700; margin-bottom:0.25rem;">
            <i class="fa-solid fa-folder" style="color:var(--accent-cyan);"></i> Módulo Temático
          </div>
          <div style="font-weight:600; color:var(--text-main); font-size:0.95rem;">${escapeHtml(moduloNombre)}</div>
        </div>

        <div class="info-grid-item">
          <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); font-weight:700; margin-bottom:0.25rem;">
            <i class="fa-solid fa-tag" style="color:var(--accent-amber);"></i> Tipo de Publicación
          </div>
          <div style="font-weight:600; color:var(--text-main); font-size:0.95rem;">${escapeHtml(tipoNombre)}</div>
        </div>

        <div class="info-grid-item">
          <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); font-weight:700; margin-bottom:0.25rem;">
            <i class="fa-solid fa-brain" style="color:var(--accent-purple);"></i> Tipo de Conocimiento
          </div>
          <div style="font-weight:600; color:var(--text-main); font-size:0.95rem;">
            ${escapeHtml(tipoConocimientoNombre)}
          </div>
        </div>
      `;
    }

    // Portada: si el post no tiene imagen propia, se oculta el contenedor para no invadir la lectura
    const coverContainer = document.getElementById('detailCoverContainer');
    if (coverContainer) {
      if (post.portadaUrl && isImageUrl(post.portadaUrl) && !post.portadaUrl.startsWith('images/portada')) {
        coverContainer.innerHTML = `<div style="max-height:360px; overflow:hidden; border-radius:12px; margin-bottom:1.5rem; box-shadow:0 8px 24px rgba(0,0,0,0.15);"><img src="${post.portadaUrl}" alt="${escapeHtml(post.titulo)}" style="width:100%; height:100%; object-fit:cover; display:block;"></div>`;
      } else {
        coverContainer.innerHTML = '';
      }
    }

    // Cuadro de Resumen Destacado
    const resumenBox = document.getElementById('detailResumenBox');
    const resumenText = document.getElementById('detailResumenText');
    if (resumenBox && resumenText) {
      if (post.resumen && post.resumen.trim()) {
        resumenText.innerText = post.resumen;
        resumenBox.style.display = 'block';
      } else {
        resumenBox.style.display = 'none';
      }
    }

    // Contenido Completo del Blog
    if (document.getElementById('detailContent')) {
      document.getElementById('detailContent').innerText = post.contenido || 'Sin contenido registrado.';
    }

    // Palabras Clave / Etiquetas
    const tagsSection = document.getElementById('detailTagsSection');
    if (tagsSection) {
      if (palabrasClave) {
        const tags = palabrasClave.split(',').map(t => t.trim()).filter(Boolean);
        if (tags.length > 0) {
          tagsSection.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.6rem; color:var(--text-muted); font-size:0.85rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">
              <i class="fa-solid fa-hashtag" style="color:var(--primary);"></i> Palabras Clave / Etiquetas:
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:0.4rem;">
              ${tags.map(t => `<span style="font-size:0.82rem; background:rgba(37,99,235,0.1); color:var(--primary); padding:4px 12px; border-radius:14px; font-weight:600; border:1px solid rgba(37,99,235,0.25);"><i class="fa-solid fa-tag" style="font-size:0.7rem; opacity:0.8;"></i> ${escapeHtml(t)}</span>`).join('')}
            </div>
          `;
          tagsSection.style.display = 'block';
        } else {
          tagsSection.innerHTML = `
            <div style="color:var(--text-muted); font-size:0.85rem; font-style:italic;">
              <i class="fa-solid fa-hashtag"></i> Palabras Clave: <em>Sin palabras clave asignadas</em>
            </div>
          `;
          tagsSection.style.display = 'block';
        }
      } else {
        tagsSection.innerHTML = `
          <div style="color:var(--text-muted); font-size:0.85rem; font-style:italic; padding-top:0.75rem;">
            <i class="fa-solid fa-hashtag"></i> <em>Sin palabras clave asignadas</em>
          </div>
        `;
        tagsSection.style.display = 'block';
      }
    }

    const attachContainer = document.getElementById('detailAttachments');
    if (attachContainer) {
      if (post.adjuntos && post.adjuntos.length > 0) {
        let galleryHtml = `<h4 style="color:var(--text-main); font-size:1.1rem; margin-bottom:0.75rem;"><i class="fa-solid fa-paperclip"></i> Archivos y Documentos Adjuntos (${post.adjuntos.length})</h4><div class="attachments-grid">`;
        post.adjuntos.forEach(att => {
          const meta = getFileMeta(att.archivoNombreOriginal, att.mimeType);
          const sizeStr = formatBytes(att.tamanioBytes);

          const filePreviewContent = meta.isImage
            ? `<a href="${att.archivoUrl}" target="_blank" title="Ver imagen en tamaño completo"><img src="${att.archivoUrl}" alt="${escapeHtml(att.archivoNombreOriginal)}"></a>`
            : `<div style="height:110px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.25rem; background:rgba(15,23,42,0.6); padding:0.5rem;">
                 <i class="${meta.icon} fa-3x" style="color:${meta.color};"></i>
                 <span style="font-size:0.72rem; color:var(--accent-cyan); font-weight:600; text-align:center; max-width:90%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(meta.label)}</span>
               </div>`;

          galleryHtml += `
            <div class="attachment-item" style="position:relative; background:var(--bg-dark); border:1px solid var(--bg-card-border); border-radius:8px; overflow:hidden;">
              ${filePreviewContent}
              <div class="attachment-info" style="padding:0.6rem;">
                <a href="${att.archivoUrl}" target="_blank" style="color:var(--accent-cyan); text-decoration:none; font-weight:600; font-size:0.85rem; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(att.archivoNombreOriginal)}">
                  <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75rem;"></i> ${escapeHtml(att.archivoNombreOriginal)}
                </a>
                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">${sizeStr} ${(meta.isImage && att.esPortada) ? '• 🌟 Portada' : ''}</div>
              </div>
            </div>
          `;
        });
        galleryHtml += '</div>';
        attachContainer.innerHTML = galleryHtml;
      } else {
        attachContainer.innerHTML = `
          <div style="margin-top:1.5rem; padding:1.25rem; border:1px dashed var(--bg-card-border); border-radius:10px; background:rgba(15,23,42,0.02); text-align:center; color:var(--text-muted); font-size:0.9rem;">
            <i class="fa-solid fa-paperclip" style="opacity:0.6; margin-right:0.4rem;"></i> Sin archivos adjuntos actualmente.
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('Error al abrir detalle:', err);
    if (window.navigateTo) window.navigateTo('/dashboard');
  }
}

export function openDetailModal(postId) {
  if (window.navigateTo) window.navigateTo('/post/' + postId);
}

export function openEditModal(postId) {
  if (window.navigateTo) window.navigateTo('/posts/edit/' + postId);
}

export function hasPostEditChanged() {
  if (!state.currentEditingPost) return false;
  const catVal = (document.getElementById('editSelectCategoriaPadre')?.value || '').trim();
  const modVal = String(document.getElementById('editSelectModulo')?.value || '').trim();
  const tipoVal = String(document.getElementById('editSelectTipo')?.value || '').trim();
  const tcVal = String(document.getElementById('editSelectTipoConocimiento')?.value || '').trim();
  const kwVal = (document.getElementById('editPostPalabrasClave')?.value || '').trim();
  const titVal = (document.getElementById('editPostTitulo')?.value || '').trim();
  const resVal = (document.getElementById('editPostResumen')?.value || '').trim();
  const contVal = (document.getElementById('editPostContenido')?.value || '').trim();
  const filesCount = state.selectedEditFiles ? state.selectedEditFiles.length : 0;

  return catVal !== state.editPostInitialValues.categoriaPadre ||
    modVal !== state.editPostInitialValues.moduloId ||
    tipoVal !== state.editPostInitialValues.tipoId ||
    tcVal !== state.editPostInitialValues.tipoConocimientoId ||
    kwVal !== state.editPostInitialValues.palabrasClave ||
    titVal !== state.editPostInitialValues.titulo ||
    resVal !== state.editPostInitialValues.resumen ||
    contVal !== state.editPostInitialValues.contenido ||
    filesCount > 0;
}

export async function handleCancelEditPost(event) {
  if (event) event.preventDefault();

  if (hasPostEditChanged()) {
    const confirmResult = await getPrixmaSwal().fire({
      title: '¿Descartar cambios?',
      text: 'Has realizado modificaciones en esta publicación. ¿Estás seguro de que deseas salir sin guardar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fa-solid fa-arrow-left"></i> Sí, descartar',
      cancelButtonText: 'Continuar editando'
    });

    if (!confirmResult.isConfirmed) return;
  }

  if (window.navigateTo) window.navigateTo('/dashboard');
}

export async function openEditView(postId) {
  setFormSkeletonState('editPostForm', true);
  if (!hasPermission('posts.edit')) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Acceso Denegado',
      text: 'No tienes permisos para editar esta publicación.'
    });
    if (window.navigateTo) window.navigateTo('/dashboard');
    return;
  }

  try {
    const res = await apiFetch(`/api/posts/${postId}`);
    if (!res.ok) throw new Error('No se pudo obtener la publicación.');
    const post = await res.json();
    state.currentEditingPost = post;

    if (!state.allModulosCache || state.allModulosCache.length === 0) {
      await loadModulos();
    }
    populateAreaSelects();

    await loadEditPostTipos(post.tipoId);
    await loadTiposConocimiento();

    const idEl = document.getElementById('editPostId');
    const tituloEl = document.getElementById('editPostTitulo');
    const resumenEl = document.getElementById('editPostResumen');
    const contenidoEl = document.getElementById('editPostContenido');

    if (idEl) idEl.value = post.id;
    if (tituloEl) tituloEl.value = post.titulo || '';
    if (resumenEl) resumenEl.value = post.resumen || '';
    if (contenidoEl) contenidoEl.value = post.contenido || '';

    const catSelect = document.getElementById('editSelectCategoriaPadre');
    if (catSelect) {
      catSelect.value = post.moduloCategoriaPadre || 'apps';
      updateEditPostSubmoduloSelect(catSelect.value, post.moduloId);
    }

    const tipoSelect = document.getElementById('editSelectTipo');
    if (tipoSelect) {
      tipoSelect.value = post.tipoId || '';
    }

    const tcSelect = document.getElementById('editSelectTipoConocimiento');
    if (tcSelect) {
      tcSelect.value = post.tipoConocimientoId || '';
    }

    const tagsInput = document.getElementById('editPostPalabrasClave');
    if (tagsInput) {
      tagsInput.value = post.palabrasClave || '';
    }

    const existingContainer = document.getElementById('editExistingAdjuntos');
    if (existingContainer) {
      if (post.adjuntos && post.adjuntos.length > 0) {
        existingContainer.innerHTML = post.adjuntos.map(att => {
          const meta = getFileMeta(att.archivoNombreOriginal, att.mimeType);
          const sizeStr = formatBytes(att.tamanioBytes);

          let contentHtml = '';
          if (meta.isImage) {
            contentHtml = `<a href="${att.archivoUrl}" target="_blank"><img src="${att.archivoUrl}" style="width:100%; height:100%; object-fit:cover;"></a>`;
          } else {
            contentHtml = `
              <div class="file-preview-icon-box">
                <i class="${meta.icon} fa-2x" style="color:${meta.color}; margin-bottom:4px;"></i>
                <span class="file-preview-name" title="${escapeHtml(att.archivoNombreOriginal)}">${escapeHtml(att.archivoNombreOriginal)}</span>
                <span class="file-preview-size">${sizeStr}</span>
              </div>
            `;
          }

          const coverRadioHtml = meta.isImage ? `
            <label class="cover-radio">
              <input type="radio" name="existingPortadaRadio" ${att.esPortada ? 'checked' : ''} onchange="handleSetPortada(${att.id}, ${post.id})"> Portada
            </label>
          ` : '';

          return `
            <div class="file-preview-card" style="position:relative; width:120px; aspect-ratio:1;" title="${escapeHtml(att.archivoNombreOriginal)} (${sizeStr})">
              <button type="button" onclick="event.stopPropagation(); handleDeleteAttachment(${att.id}, ${post.id}, true)" title="Eliminar Adjunto" style="position:absolute; top:4px; right:4px; z-index:10; background:rgba(239, 68, 68, 0.9); color:white; width:22px; height:22px; border-radius:50%; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:bold;">&times;</button>
              ${contentHtml}
              ${coverRadioHtml}
            </div>
          `;
        }).join('');
      } else {
        existingContainer.innerHTML = '<span style="font-size:0.8rem; color:var(--text-muted);">Sin archivos adjuntos actualmente.</span>';
      }
    }

    state.selectedEditFiles = [];
    renderEditFilePreviews();

    state.editPostInitialValues = {
      categoriaPadre: (catSelect ? catSelect.value : '').trim(),
      moduloId: String(post.moduloId || ''),
      tipoId: String(post.tipoId || ''),
      tipoConocimientoId: String(post.tipoConocimientoId || ''),
      palabrasClave: (post.palabrasClave || '').trim(),
      titulo: (post.titulo || '').trim(),
      resumen: (post.resumen || '').trim(),
      contenido: (post.contenido || '').trim()
    };

    const btnDelete = document.getElementById('btnDeletePostInEdit');
    if (btnDelete) btnDelete.style.display = hasPermission('posts.delete') ? 'inline-flex' : 'none';

  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error de Lectura',
      text: err.message
    });
    if (window.navigateTo) window.navigateTo('/dashboard');
  } finally {
    setFormSkeletonState('editPostForm', false);
  }
}

export function handleEditFileSelect(event) {
  const files = Array.from(event.target.files);
  state.selectedEditFiles = state.selectedEditFiles.concat(files);
  renderEditFilePreviews();
}

export function renderEditFilePreviews() {
  const container = document.getElementById('editFilePreviews');
  if (!container) return;

  if (state.selectedEditFiles.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = state.selectedEditFiles.map((file, idx) => {
    const meta = getFileMeta(file.name, file.type);
    const sizeStr = formatBytes(file.size);

    let contentHtml = '';
    if (meta.isImage) {
      const previewUrl = URL.createObjectURL(file);
      contentHtml = `<img src="${previewUrl}" alt="${escapeHtml(file.name)}">`;
    } else {
      contentHtml = `
        <div class="file-preview-icon-box">
          <i class="${meta.icon} fa-2x" style="color:${meta.color}; margin-bottom:4px;"></i>
          <span class="file-preview-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
          <span class="file-preview-size">${sizeStr}</span>
        </div>
      `;
    }

    return `
      <div class="file-preview-card" title="${escapeHtml(file.name)} (${sizeStr})">
        ${contentHtml}
        <button type="button" onclick="removeEditFile(${idx})" style="position:absolute; top:4px; right:4px; z-index:5; background:rgba(239,68,68,0.85); color:white; border:none; border-radius:50%; width:22px; height:22px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:bold;">&times;</button>
      </div>
    `;
  }).join('');
}

export function removeEditFile(index) {
  state.selectedEditFiles.splice(index, 1);
  renderEditFilePreviews();
}

export async function handleSetPortada(adjuntoId, postId) {
  try {
    startTopProgressBar();
    const res = await apiFetch(`/api/posts/adjuntos/${adjuntoId}/portada`, {
      method: 'PUT'
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'No se pudo actualizar la portada.');
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Portada Actualizada',
      text: 'La imagen de portada ha sido asignada correctamente.',
      timer: 1500,
      showConfirmButton: false
    });

    if (postId) {
      await openEditView(postId);
    }
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error de Portada',
      text: err.message
    });
  } finally {
    finishTopProgressBar();
  }
}

export function onEditPostCategoriaChange(cat) {
  updateEditPostSubmoduloSelect(cat);
}

export function updateEditPostSubmoduloSelect(cat, selectedModuloId = null) {
  const selectModulo = document.getElementById('editSelectModulo');
  if (!selectModulo) return;

  const targetCat = (cat || '').toLowerCase().trim();
  const filtered = (state.allModulosCache || []).filter(m => {
    if (!targetCat) return true;
    const mCat = (m.categoriaPadre || '').toLowerCase().trim();
    const mAreaCode = (m.area ? m.area.codigo : '').toLowerCase().trim();
    return mCat === targetCat || mAreaCode === targetCat;
  });

  let selectHtml = '<option value="">Selecciona un Módulo</option>';
  filtered.forEach(m => {
    const isSel = selectedModuloId && m.id === selectedModuloId ? 'selected' : '';
    selectHtml += `<option value="${m.id}" ${isSel}>${escapeHtml(m.nombre)}</option>`;
  });
  selectModulo.innerHTML = selectHtml;
}

export async function handleSaveEditPost(event) {
  if (event) event.preventDefault();
  const postIdVal = document.getElementById('editPostId')?.value;
  const postId = parseInt(postIdVal, 10);
  const btn = document.getElementById('btnSubmitEditPost');

  if (!postId || isNaN(postId)) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo obtener el identificador de la publicación.'
    });
    return;
  }

  const moduloId = parseInt(document.getElementById('editSelectModulo')?.value, 10);
  const tipoId = parseInt(document.getElementById('editSelectTipo')?.value, 10);
  const tcIdVal = document.getElementById('editSelectTipoConocimiento')?.value;
  const tipoConocimientoId = tcIdVal ? parseInt(tcIdVal, 10) : null;

  if (!moduloId || !tipoId) {
    getPrixmaSwal().fire({
      icon: 'warning',
      title: 'Campos Incompletos',
      text: 'Por favor selecciona el Módulo y el Tipo de Publicación.'
    });
    return;
  }

  const updateDto = {
    moduloId: moduloId,
    tipoId: tipoId,
    tipoConocimientoId: tipoConocimientoId,
    palabrasClave: (document.getElementById('editPostPalabrasClave')?.value || '').trim(),
    titulo: (document.getElementById('editPostTitulo')?.value || '').trim(),
    resumen: (document.getElementById('editPostResumen')?.value || '').trim(),
    contenido: (document.getElementById('editPostContenido')?.value || '').trim(),
    estado: 'publicado'
  };

  if (!updateDto.titulo || !updateDto.contenido) {
    getPrixmaSwal().fire({
      icon: 'warning',
      title: 'Campos Requeridos',
      text: 'Por favor completa el Título y el Contenido de la publicación.'
    });
    return;
  }

  const hasChanged = hasPostEditChanged();

  const confirmResult = await getPrixmaSwal().fire({
    title: '¿Guardar cambios?',
    text: hasChanged
      ? `¿Deseas guardar las modificaciones realizadas en la publicación "${updateDto.titulo}"?`
      : `¿Deseas confirmar la información de la publicación "${updateDto.titulo}"?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#475569',
    confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Sí, guardar',
    cancelButtonText: 'Cancelar'
  });

  if (!confirmResult.isConfirmed) return;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
  }

  try {
    const res = await apiFetch(`/api/posts/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateDto)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Error al actualizar la publicación.');
    }

    if (state.selectedEditFiles && state.selectedEditFiles.length > 0) {
      for (const file of state.selectedEditFiles) {
        const formData = new FormData();
        formData.append('file', file);
        await apiFetch(`/api/posts/${postId}/adjuntos`, {
          method: 'POST',
          body: formData
        });
      }
    }

    state.selectedEditFiles = [];
    renderEditFilePreviews();

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Publicación Actualizada',
      text: 'Los cambios han sido guardados correctamente.',
      timer: 1800,
      showConfirmButton: false
    });

    if (window.navigateTo) window.navigateTo('/dashboard');
    await loadPosts(1);
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error de Actualización',
      text: err.message
    });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';
    }
  }
}

export async function handleDeletePost(postId) {
  if (!hasPermission('posts.delete')) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Acceso Denegado',
      text: 'No tienes permisos para eliminar publicaciones.'
    });
    return false;
  }

  const result = await getPrixmaSwal().fire({
    title: '¿Eliminar publicación?',
    text: 'Esta publicación pasará a estado archivado y dejará de mostrarse en el portal.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#475569',
    confirmButtonText: '<i class="fa-solid fa-trash-can"></i> Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return false;

  try {
    const res = await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('No se pudo eliminar la publicación.');

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Publicación Archivada',
      text: 'La publicación ha sido archivada correctamente.',
      timer: 2000,
      showConfirmButton: false
    });

    loadPosts(state.currentPage);
    return true;
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error al Eliminar Publicación',
      text: err.message
    });
    return false;
  }
}

export async function handleDeletePostFromModal() {
  const postIdVal = document.getElementById('editPostId')?.value;
  const postId = parseInt(postIdVal, 10);
  if (!postId || isNaN(postId)) return;

  const deleted = await handleDeletePost(postId);
  if (deleted) {
    if (window.navigateTo) window.navigateTo('/dashboard');
    await loadPosts(1);
  }
}

window.openDetailView = openDetailView;
