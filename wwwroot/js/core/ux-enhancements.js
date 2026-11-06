import { apiFetch } from './api.js';
import { escapeHtml, formatRelativeTime, estimateReadingTime } from './utils.js';
import { showToast } from './ui-helpers.js';
import { state } from './state.js';
import { initDragAndDropZone } from '../modules/attachments.js';

let debounceTimer = null;
let selectedIndex = -1;
let currentResults = [];

export function initCommandPalette() {
  const backdrop = document.getElementById('cmdPaletteBackdrop');
  const input = document.getElementById('cmdPaletteInput');
  const resultsContainer = document.getElementById('cmdPaletteResults');
  if (!backdrop || !input) return;

  // Open / Close functions
  window.openCommandPalette = function() {
    backdrop.classList.add('active');
    input.value = '';
    renderDefaultCommands();
    setTimeout(() => input.focus(), 50);
  };

  window.closeCommandPalette = function() {
    backdrop.classList.remove('active');
    input.value = '';
    selectedIndex = -1;
  };

  // Keyboard shortcut Ctrl + K or Cmd + K or /
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (backdrop.classList.contains('active')) {
        window.closeCommandPalette();
      } else {
        window.openCommandPalette();
      }
    } else if (e.key === 'Escape' && backdrop.classList.contains('active')) {
      window.closeCommandPalette();
    }
  });

  // Close on click backdrop
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      window.closeCommandPalette();
    }
  });

  // Input search handler
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (!query) {
      renderDefaultCommands();
      return;
    }

    debounceTimer = setTimeout(() => {
      searchContent(query);
    }, 220);
  });

  // Keyboard navigation within palette
  input.addEventListener('keydown', (e) => {
    const items = resultsContainer.querySelectorAll('.cmd-palette-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % items.length;
      updateSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      updateSelection(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && items[selectedIndex]) {
        items[selectedIndex].click();
      }
    }
  });
}

function updateSelection(items) {
  items.forEach((item, idx) => {
    if (idx === selectedIndex) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });
}

function renderDefaultCommands() {
  const container = document.getElementById('cmdPaletteResults');
  if (!container) return;
  selectedIndex = 0;
  container.innerHTML = `
    <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); font-weight:700; padding:0.4rem 0.75rem;">
      Acciones Rápidas
    </div>
    <div class="cmd-palette-item selected" onclick="window.closeCommandPalette(); navigateTo('/posts/create');">
      <div class="cmd-palette-item-icon"><i class="fa-solid fa-plus"></i></div>
      <div class="cmd-palette-item-text">
        <span class="cmd-palette-item-title">Nueva Publicación</span>
        <span class="cmd-palette-item-subtitle">Crear un artículo técnico o corporativo</span>
      </div>
      <kbd class="cmd-palette-kbd">Alt + C</kbd>
    </div>
    <div class="cmd-palette-item" onclick="window.closeCommandPalette(); navigateTo('/buscadorinteligente');">
      <div class="cmd-palette-item-icon" style="color:var(--accent-purple);"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
      <div class="cmd-palette-item-text">
        <span class="cmd-palette-item-title">Buscador Inteligente con IA</span>
        <span class="cmd-palette-item-subtitle">Sintetizar y consultar la base de conocimiento</span>
      </div>
      <kbd class="cmd-palette-kbd">Buscador</kbd>
    </div>
    <div class="cmd-palette-item" onclick="window.closeCommandPalette(); toggleTheme();">
      <div class="cmd-palette-item-icon" style="color:var(--accent-amber);"><i class="fa-solid fa-circle-half-stroke"></i></div>
      <div class="cmd-palette-item-text">
        <span class="cmd-palette-item-title">Alternar Tema</span>
        <span class="cmd-palette-item-subtitle">Cambiar entre Modo Claro y Modo Oscuro</span>
      </div>
      <kbd class="cmd-palette-kbd">Tema</kbd>
    </div>
  `;
}

async function searchContent(query) {
  const container = document.getElementById('cmdPaletteResults');
  if (!container) return;
  container.innerHTML = `
    <div style="padding:1.5rem; text-align:center; color:var(--text-muted); font-size:0.9rem;">
      <i class="fa-solid fa-circle-notch fa-spin"></i> Buscando publicaciones...
    </div>
  `;

  try {
    const res = await apiFetch(`/api/posts?estado=publicado&search=${encodeURIComponent(query)}&pageSize=6`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const posts = data.items || [];

    if (posts.length === 0) {
      container.innerHTML = `
        <div style="padding:1.5rem; text-align:center; color:var(--text-muted); font-size:0.9rem;">
          No se encontraron resultados para "<strong>${escapeHtml(query)}</strong>"
        </div>
      `;
      return;
    }

    selectedIndex = 0;
    container.innerHTML = `
      <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); font-weight:700; padding:0.4rem 0.75rem;">
        Publicaciones coincidentes (${posts.length})
      </div>
      ${posts.map((p, idx) => `
        <div class="cmd-palette-item ${idx === 0 ? 'selected' : ''}" onclick="window.closeCommandPalette(); navigateTo('/post/${p.id}');">
          <div class="cmd-palette-item-icon"><i class="fa-solid fa-file-lines"></i></div>
          <div class="cmd-palette-item-text">
            <span class="cmd-palette-item-title">${escapeHtml(p.titulo)}</span>
            <span class="cmd-palette-item-subtitle">Por ${escapeHtml(p.usuarioNombre)} &bull; ${formatRelativeTime(p.creadoEn)}</span>
          </div>
          <span style="font-size:0.75rem; color:var(--primary); font-weight:600;">Abrir &rarr;</span>
        </div>
      `).join('')}
    `;
  } catch (e) {
    container.innerHTML = `
      <div style="padding:1.5rem; text-align:center; color:var(--accent-rose); font-size:0.9rem;">
        Error al buscar resultados.
      </div>
    `;
  }
}

/* ==========================================================================
   Autosave Form Draft System (Desactivado a solicitud del usuario)
   ========================================================================== */
export function initPostDraftAutoSave() {
  // Limpiar cualquier borrador previo que haya quedado almacenado en localStorage
  try {
    localStorage.removeItem('prixma_post_draft_v1');
  } catch (e) {}
}

/* ==========================================================================
   Reading Progress Bar on Scroll
   ========================================================================== */
export function initReadingProgressBar() {
  const bar = document.getElementById('readingProgressBar');
  if (!bar) return;

  window.addEventListener('scroll', () => {
    const detailView = document.getElementById('viewPostDetail');
    if (detailView && !detailView.classList.contains('view-hidden')) {
      const scrollY = window.scrollY || window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const progress = Math.min(100, Math.max(0, (scrollY / docHeight) * 100));
        bar.style.width = progress + '%';
      }
    } else {
      bar.style.width = '0%';
    }
  }, { passive: true });
}

/* ==========================================================================
   Drag & Drop Enhancements for Form
   ========================================================================== */
export function initFormDragAndDrop() {
  const uploadZone = document.querySelector('.file-upload-zone');
  if (uploadZone) {
    initDragAndDropZone(uploadZone, (files) => {
      state.selectedFiles = [...state.selectedFiles, ...files];
      if (window.renderFilePreviews) window.renderFilePreviews();
      showToast(`${files.length} archivo(s) añadido(s) con éxito.`, 'success');
    });
  }

  // Paste image directly from clipboard (Ctrl + V)
  document.addEventListener('paste', (e) => {
    const viewCreate = document.getElementById('viewCreatePost');
    if (viewCreate && !viewCreate.classList.contains('view-hidden')) {
      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
      if (!items) return;
      let pastedFiles = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const blob = item.getAsFile();
          if (blob) pastedFiles.push(blob);
        }
      }
      if (pastedFiles.length > 0) {
        state.selectedFiles = [...state.selectedFiles, ...pastedFiles];
        if (window.renderFilePreviews) window.renderFilePreviews();
        showToast(`${pastedFiles.length} imagen pegada desde el portapapeles.`, 'success');
      }
    }
  });
}
