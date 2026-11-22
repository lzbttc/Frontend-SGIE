/**
 * SGIE — Shell compartilhado e navegação (shared/layout.js)
 * Ordem de carga: config.js -> api.js -> shared/dom.js -> shared/formatters.js -> shared/roles.js -> shared/layout.js
 */

(function (window) {
    'use strict';

    function getAppUrl(pathRelativo) {
        if (typeof window.resolveAppUrl === 'function') {
            return window.resolveAppUrl(pathRelativo);
        }
        return pathRelativo;
    }

    function normalizarPaginaAtiva(activePage = '') {
        const aliases = {
            'submissoes': 'minhas-submissoes',
            'submissao': 'minhas-submissoes',
            'minhas-submissoes': 'minhas-submissoes',
            'novo': 'cadastrar-evento',
            'novo-evento': 'cadastrar-evento',
            'cadastrar-evento': 'cadastrar-evento',
            'inscricoes': 'minhas-inscricoes',
            'minhas-inscricoes': 'minhas-inscricoes',
            'realizar-inscricao': 'minhas-inscricoes',
            'meus-eventos': 'meus-eventos',
            'participantes': 'meus-eventos',
            'credenciamento': 'meus-eventos',
            'gestao-submissoes': 'meus-eventos',
            'eventos': 'eventos',
            'explorar': 'eventos',
            'home': 'eventos',
        };

        let resolved = aliases[activePage] || activePage;

        // Se ainda não resolveu para nenhum dos links, tenta inferir pelo pathname da URL
        if (!resolved && typeof window !== 'undefined' && window.location) {
            const p = window.location.pathname.toLowerCase();
            if (p.includes('/submissao/') || p.includes('minhas-submissoes') || p.includes('submeter-trabalho')) {
                resolved = 'minhas-submissoes';
            } else if (p.includes('/inscricao/minhas-inscricoes')) {
                resolved = 'minhas-inscricoes';
            } else if (p.includes('/eventos/meus-eventos') || p.includes('gestao-submissoes') || p.includes('consulta-de-participantes') || p.includes('credenciamento')) {
                resolved = 'meus-eventos';
            } else if (p.includes('/eventos/cadastrar-evento')) {
                resolved = 'cadastrar-evento';
            } else if (p.endsWith('/') || p.endsWith('/index.html') || p.includes('detalhes-do-evento')) {
                resolved = 'eventos';
            }
        }
        return resolved;
    }

    function renderNavLinks(activePage = '') {
        const isAuth = typeof window.SGIE_ROLES?.isAutenticado === 'function'
            ? window.SGIE_ROLES.isAutenticado()
            : Boolean(localStorage.getItem('sgie_access_token'));

        const user = typeof window.SGIE_ROLES?.getUsuarioLogado === 'function'
            ? window.SGIE_ROLES.getUsuarioLogado()
            : (function () {
                  try {
                      return JSON.parse(localStorage.getItem('sgie_user'));
                  } catch {
                      return null;
                  }
              })();

        const podeMeusEventos = typeof window.SGIE_ROLES?.podeAcessarMeusEventos === 'function'
            ? window.SGIE_ROLES.podeAcessarMeusEventos(user)
            : false;

        const podeCriarEvento = typeof window.SGIE_ROLES?.podeCriarEvento === 'function'
            ? window.SGIE_ROLES.podeCriarEvento(user)
            : false;

        const links = [];

        // Link padrão disponível para todos
        links.push({
            id: 'eventos',
            label: 'Explorar eventos',
            href: getAppUrl('index.html'),
        });

        if (isAuth) {
            links.push({
                id: 'minhas-inscricoes',
                label: 'Minhas inscrições',
                href: getAppUrl('inscricao/minhas-inscricoes/index.html'),
            });

            // Submissões do autor
            links.push({
                id: 'minhas-submissoes',
                label: 'Minhas submissões',
                href: getAppUrl('submissao/minhas-submissoes/index.html'),
            });

            // Meus eventos para organizadores
            if (podeMeusEventos) {
                links.push({
                    id: 'meus-eventos',
                    label: 'Meus eventos',
                    href: getAppUrl('eventos/meus-eventos/index.html'),
                });
            }

            // Cadastrar evento para quem tem permissão
            if (podeCriarEvento) {
                links.push({
                    id: 'cadastrar-evento',
                    label: 'Cadastrar evento',
                    href: getAppUrl('eventos/cadastrar-evento/index.html'),
                });
            }
        }

        const paginaAtiva = normalizarPaginaAtiva(activePage);
        return links
            .map((item) => {
                const isActive = paginaAtiva === item.id ? 'is-active' : '';
                return `<a class="nav-link ${isActive}" href="${item.href}">${item.label}</a>`;
            })
            .join('');
    }

    function renderNavUser(activePage = '') {
        const isAuth = typeof window.SGIE_ROLES?.isAutenticado === 'function'
            ? window.SGIE_ROLES.isAutenticado()
            : Boolean(localStorage.getItem('sgie_access_token'));

        const user = typeof window.SGIE_ROLES?.getUsuarioLogado === 'function'
            ? window.SGIE_ROLES.getUsuarioLogado()
            : (function () {
                  try {
                      return JSON.parse(localStorage.getItem('sgie_user'));
                  } catch {
                      return null;
                  }
              })();

        if (isAuth) {
            return `
                <details class="menu" id="menu-conta">
                    <summary class="user-btn" aria-label="Menu da conta"><i class="ic ic-user"></i></summary>
                    <div class="menu-pop">
                        <a class="menu-item" href="${getAppUrl('usuarios/perfil/perfil.html')}">
                            <i class="ic ic-user"></i>Meu perfil
                        </a>
                        <a class="menu-item danger" href="#" data-logout-action>
                            <i class="ic ic-out"></i>Sair
                        </a>
                    </div>
                </details>
            `;
        }

        return `
            <a class="btn btn-ghost btn-sm" href="${getAppUrl('usuarios/login/login.html')}">Entrar</a>
            <a class="btn btn-primary btn-sm" href="${getAppUrl('usuarios/cadastro/cadastro.html')}">Criar conta</a>
        `;
    }

    function renderBreadcrumbs(crumbs = []) {
        if (!crumbs || crumbs.length === 0) return '';
        const esc = typeof window.SGIE_DOM?.escapeHTML === 'function'
            ? window.SGIE_DOM.escapeHTML
            : (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const itemsHtml = crumbs
            .map((crumb, idx) => {
                const isLast = idx === crumbs.length - 1;
                if (isLast || !crumb.href) {
                    return `<span>${esc(crumb.label)}</span>`;
                }
                return `<a href="${esc(crumb.href)}">${esc(crumb.label)}</a> <span aria-hidden="true">/</span>`;
            })
            .join(' ');

        return `<nav class="crumb" aria-label="Você está em">${itemsHtml}</nav>`;
    }

    function montarHeader(activePage = '') {
        return `
            <header class="nav" id="app-nav">
                <div class="container nav-in">
                    <a class="brand" href="${getAppUrl('index.html')}">
                        <span class="brand-mark"><i class="ic ic-cap"></i></span>SGIE
                    </a>
                    <nav aria-label="Principal" class="nav-links">
                        ${renderNavLinks(activePage)}
                    </nav>
                    <div class="nav-user" id="nav-user-area">
                        ${renderNavUser(activePage)}
                    </div>
                </div>
            </header>
        `;
    }

    function montarFooter() {
        return `
            <footer class="footer" id="app-footer">
                <div class="container">
                    SGIE — Sistema de Gestão de Inscrições e Eventos Universitários
                </div>
            </footer>
        `;
    }

    let _menuEventsConfigured = false;

    function setupMenuEvents() {
        if (_menuEventsConfigured) return;
        _menuEventsConfigured = true;

        // Fechar menu ao clicar fora
        document.addEventListener('click', (event) => {
            const menu = document.getElementById('menu-conta');
            if (menu && menu.hasAttribute('open') && !menu.contains(event.target)) {
                menu.removeAttribute('open');
            }
        });

        // Ação de logout idempotente via delegação de evento
        document.addEventListener('click', (e) => {
            const btnLogout = e.target.closest('[data-logout-action]');
            if (btnLogout) {
                e.preventDefault();
                if (typeof window.logout === 'function') {
                    window.logout();
                } else {
                    localStorage.removeItem('sgie_access_token');
                    localStorage.removeItem('sgie_refresh_token');
                    localStorage.removeItem('sgie_user');
                    window.location.href = getAppUrl('usuarios/login/login.html');
                }
            }
        });
    }

    function atualizarNavegacao(activePage = '') {
        const navLinks = document.querySelector('.nav-links');
        const navUser = document.getElementById('nav-user-area');

        if (navLinks) {
            navLinks.innerHTML = renderNavLinks(activePage);
        }
        if (navUser) {
            navUser.innerHTML = renderNavUser(activePage);
        }

        setupMenuEvents();
    }

    function montarShell(options = {}) {
        const { activePage = '', breadcrumbs = [] } = options;

        // Se já existe header.nav, atualiza seu conteúdo
        const navExistente = document.querySelector('header.nav, nav.pay-navbar, nav.navbar');
        if (navExistente) {
            const brand = navExistente.querySelector('.brand, .pay-brand');
            if (brand) {
                brand.className = 'brand';
                brand.href = getAppUrl('index.html');
                brand.innerHTML = '<span class="brand-mark"><i class="ic ic-cap"></i></span>SGIE';
            }
            atualizarNavegacao(activePage);
        } else {
            // Insere no topo do body ou .app
            const app = document.querySelector('.app') || document.body;
            const headerDiv = document.createElement('div');
            headerDiv.innerHTML = montarHeader(activePage);
            app.insertBefore(headerDiv.firstElementChild, app.firstChild);
            setupMenuEvents();
        }

        // Breadcrumbs
        if (breadcrumbs && breadcrumbs.length > 0) {
            const container = document.querySelector('.container');
            if (container && !document.querySelector('.crumb')) {
                const crumbDiv = document.createElement('div');
                crumbDiv.innerHTML = renderBreadcrumbs(breadcrumbs);
                container.insertBefore(crumbDiv.firstElementChild, container.firstChild);
            }
        }

        // Rodapé
        const footerExistente = document.querySelector('footer.footer, footer.pay-footer, footer.app-footer');
        if (footerExistente) {
            footerExistente.className = 'footer';
            footerExistente.innerHTML = `
                <div class="container">
                    SGIE — Sistema de Gestão de Inscrições e Eventos Universitários
                </div>
            `;
        } else {
            const app = document.querySelector('.app') || document.body;
            const footerDiv = document.createElement('div');
            footerDiv.innerHTML = montarFooter();
            app.appendChild(footerDiv.firstElementChild);
        }
    }

    window.SGIE_LAYOUT = {
        montarHeader,
        montarFooter,
        montarShell,
        atualizarNavegacao,
        renderBreadcrumbs,
    };
})(window);
