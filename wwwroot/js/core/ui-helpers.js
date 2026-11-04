import { escapeHtml } from './utils.js';

let topProgressTimer = null;
let topProgressWidth = 0;

export function startTopProgressBar() {
  const bar = document.getElementById('topProgressBar');
  if (!bar) return;

  if (topProgressTimer) clearInterval(topProgressTimer);
  topProgressWidth = 15;
  bar.style.width = topProgressWidth + '%';
  bar.classList.add('active');

  topProgressTimer = setInterval(() => {
    if (topProgressWidth < 85) {
      topProgressWidth += Math.random() * 10 + 3;
      bar.style.width = topProgressWidth + '%';
    }
  }, 180);
}

export function finishTopProgressBar() {
  const bar = document.getElementById('topProgressBar');
  if (!bar) return;

  if (topProgressTimer) {
    clearInterval(topProgressTimer);
    topProgressTimer = null;
  }
  bar.style.width = '100%';
  setTimeout(() => {
    bar.classList.remove('active');
    setTimeout(() => {
      bar.style.width = '0%';
    }, 350);
  }, 180);
}

let routeSpinnerCount = 0;
export function showRouteSpinner(title = 'Cargando...', subtext = 'Por favor espera un momento') {
  routeSpinnerCount++;
  const spinner = document.getElementById('globalRouteSpinner');
  const titleEl = document.getElementById('globalSpinnerTitle');
  const subtextEl = document.getElementById('globalSpinnerSubtext');

  if (titleEl) titleEl.textContent = title;
  if (subtextEl) subtextEl.textContent = subtext;

  if (spinner) spinner.classList.add('active');
  startTopProgressBar();
}

export function hideRouteSpinner(force = false) {
  if (force) {
    routeSpinnerCount = 0;
  } else {
    routeSpinnerCount = Math.max(0, routeSpinnerCount - 1);
  }

  if (routeSpinnerCount === 0) {
    const spinner = document.getElementById('globalRouteSpinner');
    if (spinner) spinner.classList.remove('active');
    finishTopProgressBar();
  }
}

/**
 * Pone un botón en estado de carga con spinner
 * @param {HTMLElement|string} btn Elemento del botón o id
 * @param {boolean} isLoading True para activar spinner, false para restaurar
 * @param {string} loadingText Texto a mostrar mientras carga (ej: "Guardando...", "Autenticando...")
 */
export function setButtonLoading(btn, isLoading, loadingText = 'Procesando...') {
  if (!btn) return;
  if (typeof btn === 'string') btn = document.getElementById(btn);
  if (!btn) return;

  if (isLoading) {
    if (btn.classList.contains('btn-loading')) return;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('btn-loading');
    btn.innerHTML = `<span class="btn-text-content">${btn.innerHTML}</span><span class="btn-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> ${loadingText}</span>`;
  } else {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
    if (btn.dataset.originalHtml !== undefined) {
      btn.innerHTML = btn.dataset.originalHtml;
      delete btn.dataset.originalHtml;
    }
  }
}

// Helper: Skeleton Loading State for Forms
export function setFormSkeletonState(formIdOrElement, isLoading) {
  const container = typeof formIdOrElement === 'string' ? document.getElementById(formIdOrElement) : formIdOrElement;
  if (!container) return;

  const inputs = container.querySelectorAll('.form-control, input:not([type="hidden"]), select, textarea');
  const buttons = container.querySelectorAll('button[type="submit"], .btn-primary, .btn-secondary, .btn-danger');

  inputs.forEach(input => {
    if (isLoading) {
      input.classList.add('skeleton-input');
    } else {
      input.classList.remove('skeleton-input');
    }
  });

  buttons.forEach(btn => {
    btn.disabled = isLoading;
    if (isLoading) {
      btn.classList.add('skeleton-input');
    } else {
      btn.classList.remove('skeleton-input');
    }
  });
}

// Helper: Toggle Read-Only Mode for Forms (Ver / Detalles)
export function setFormReadOnlyMode(formIdOrElement, isReadOnly, titleText, titleIcon) {
  const container = typeof formIdOrElement === 'string' ? document.getElementById(formIdOrElement) : formIdOrElement;
  if (!container) return;

  container.dataset.readOnly = isReadOnly ? 'true' : 'false';

  const inputs = container.querySelectorAll('.form-control, input, select, textarea');
  inputs.forEach(input => {
    if (isReadOnly) {
      input.setAttribute('disabled', 'disabled');
      input.style.pointerEvents = 'none';
      input.style.opacity = '0.85';
    } else {
      input.removeAttribute('disabled');
      input.style.pointerEvents = '';
      input.style.opacity = '';
    }
  });

  const checkables = container.querySelectorAll('input[type="checkbox"], input[type="radio"]');
  checkables.forEach(chk => {
    chk.disabled = isReadOnly;
  });

  const submitBtns = container.querySelectorAll('button[type="submit"], .btn-primary:not([onclick*="navigateTo"])');
  submitBtns.forEach(btn => {
    btn.style.display = isReadOnly ? 'none' : '';
  });

  const dangerBtns = container.querySelectorAll('.btn-danger, button[onclick*="Inactivar"], button[onclick*="Delete"], button[onclick*="inactivar"], button[onclick*="delete"]');
  dangerBtns.forEach(btn => {
    btn.style.display = isReadOnly ? 'none' : '';
  });

  const parentView = container.closest('.app-view') || container.parentElement;
  if (parentView) {
    const titleEl = parentView.querySelector('h2, h3, .card-title, .view-title');
    if (titleEl) {
      if (!titleEl.dataset.originalTitle) {
        titleEl.dataset.originalTitle = titleEl.innerHTML;
      }
      if (isReadOnly && titleText) {
        const iconClass = titleIcon || 'fa-eye';
        titleEl.innerHTML = `<i class="fa-solid ${iconClass}" style="color:var(--accent-cyan);"></i> ${escapeHtml(titleText)}`;
      } else {
        titleEl.innerHTML = titleEl.dataset.originalTitle;
      }
    }
  }
}

// Helper: Skeleton HTML generator for Table Rows
export function getTableSkeletonHtml(rowsCount = 5, colsCount = 4) {
  return `
    <div class="table-responsive">
      <table class="rbac-table" style="width:100%; border-collapse:collapse;">
        <tbody>
          ${Array.from({ length: rowsCount }).map(() => `
            <tr>
              ${Array.from({ length: colsCount }).map(() => `
                <td style="padding:0.75rem;">
                  <div class="skeleton-box" style="height:18px; width:85%; border-radius:4px;"></div>
                </td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// SweetAlert2 Prixma Custom Light/Dark Helper
export function getPrixmaSwal() {
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  if (typeof Swal !== 'undefined') {
    return Swal.mixin({
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#e11d48',
      customClass: {
        popup: 'prixma-swal-popup',
        title: 'prixma-swal-title',
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-secondary'
      },
      buttonsStyling: false
    });
  }
  return {
    fire: (opts) => alert(opts.text || opts.title)
  };
}


/**
 * Toast Notification system for subtle, non-blocking feedback
 * @param {string} message Texto a mostrar
 * @param {'success'|'info'|'warning'|'error'} type Tipo de toast
 * @param {number} duration Duración en ms (default 3200ms)
 */
export function showToast(message, type = 'success', duration = 3200) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'fa-circle-check',
    info: 'fa-circle-info',
    warning: 'fa-triangle-exclamation',
    error: 'fa-circle-xmark'
  };

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}"></i>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Cerrar">&times;</button>
  `;

  toast.querySelector('.toast-close').onclick = () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  };

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 250);
    }
  }, duration);
}
