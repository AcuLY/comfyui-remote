// Simple client-side router
class Router {
  constructor() {
    this.routes = {}
    this.currentRoute = null

    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRoute())
    window.addEventListener('load', () => this.handleRoute())
  }

  // Register a route
  register(path, handler) {
    this.routes[path] = handler
  }

  // Handle route change
  handleRoute() {
    const hash = window.location.hash.slice(1) || '/'
    const route = this.matchRoute(hash)

    if (route) {
      this.currentRoute = hash
      route.handler(route.params)
      this.updateActiveNav(hash)
    } else {
      // 404
      this.render404()
    }
  }

  // Match route with params
  matchRoute(path) {
    // Exact match
    if (this.routes[path]) {
      return { handler: this.routes[path], params: {} }
    }

    // Pattern match (e.g., /projects/:id)
    for (const [pattern, handler] of Object.entries(this.routes)) {
      const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '$')
      const match = path.match(regex)

      if (match) {
        const paramNames = (pattern.match(/:[^/]+/g) || []).map(p => p.slice(1))
        const params = {}
        paramNames.forEach((name, i) => {
          params[name] = match[i + 1]
        })
        return { handler, params }
      }
    }

    return null
  }

  // Update active nav link
  updateActiveNav(path) {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active')
      const route = link.getAttribute('data-route')
      if (route && (path === route || path.startsWith(route + '/'))) {
        link.classList.add('active')
      }
    })
  }

  // Navigate to a route
  navigate(path) {
    window.location.hash = path
  }

  // Render 404
  render404() {
    const content = document.getElementById('main-content')
    content.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <h3>页面未找到</h3>
        <p>您访问的页面不存在</p>
        <button class="btn btn-primary" onclick="router.navigate('/')">返回首页</button>
      </div>
    `
  }
}

// Create global router instance for inline demo links.
window.router = new Router()
