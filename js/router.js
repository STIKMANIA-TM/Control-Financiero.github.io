class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.init();
  }

  init() {
    window.addEventListener('hashchange', () => this.handleRouteChange());
    window.addEventListener('load', () => this.handleRouteChange());
  }

  register(path, handler) {
    this.routes.set(path, handler);
  }

  navigate(path) {
    window.location.hash = path;
  }

  handleRouteChange() {
    const hash = window.location.hash.slice(1) || 'inicio';
    const handler = this.routes.get(hash);

    if (handler) {
      this.currentRoute = hash;
      handler();
    } else {
      this.navigate('inicio');
    }
  }

  getCurrentRoute() {
    return this.currentRoute;
  }
}

export const router = new Router();