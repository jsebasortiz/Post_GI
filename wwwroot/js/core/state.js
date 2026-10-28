// Global Application State Store (Singleton Pattern)

class AppState {
  constructor() {
    this.currentCategoriaPadre = null;
    this.currentModuloId = null;
    this.currentSearch = '';
    this.selectedFiles = [];
    this.coverIndex = 0;
    this.searchDebounceTimer = null;

    this.currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    this.jwtToken = localStorage.getItem('jwtToken') || null;

    this.currentTheme = localStorage.getItem('prixmaTheme') || 'light';

    this.currentPage = 1;
    this.pageSize = 10;
    this.totalPages = 1;
    this.totalItems = 0;

    this.allModulosCache = [];
    this.allAreasCache = [];

    this.selectedEditFiles = [];
    this.currentEditingPost = null;
    this.editPostInitialValues = {
      categoriaPadre: '',
      moduloId: '',
      tipoId: '',
      tipoConocimientoId: '',
      palabrasClave: '',
      titulo: '',
      resumen: '',
      contenido: ''
    };

    this.isHandlingRoute = false;
    this.isAppInitialized = false;
  }

  saveSession(user, token) {
    if (user) {
      this.currentUser = {
        id: user.id || user.Id,
        nombre: user.nombre || user.Nombre || '',
        correo: user.correo || user.Correo || '',
        rolId: user.rolId || user.RolId,
        rolNombre: user.rolNombre || user.RolNombre || '',
        permisos: user.permisos || user.Permisos || []
      };
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    }
    if (token) {
      this.jwtToken = token;
      localStorage.setItem('jwtToken', token);
    }
  }

  clearSession() {
    this.currentUser = null;
    this.jwtToken = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('jwtToken');
    this.isAppInitialized = false;
  }

  hasPermission(codigo) {
    if (!this.currentUser) return false;
    if (this.currentUser.rolNombre === 'Administrador' || (this.currentUser.rolId && this.currentUser.rolId === 1)) {
      return true;
    }
    if (!this.currentUser.permisos) return false;
    return this.currentUser.permisos.includes(codigo);
  }
}

export const state = new AppState();
