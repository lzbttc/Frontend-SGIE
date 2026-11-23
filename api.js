const API_BASE_URL = (function() {
    if (typeof window !== 'undefined') {
        // Fonte da verdade: config.js expõe window.SGIE_CONFIG
        if (window.SGIE_CONFIG && window.SGIE_CONFIG.API_BASE_URL) {
            return String(window.SGIE_CONFIG.API_BASE_URL).replace(/\/+$/, '');
        }
    }
    return 'http://127.0.0.1:8000/api/sgie/v1';
})();

const ACCESS_TOKEN_KEY = 'sgie_access_token';
const REFRESH_TOKEN_KEY = 'sgie_refresh_token';
const USER_KEY = 'sgie_user';

function getAppRoot() {
    if (typeof window === 'undefined') return './';

    const path = window.location.pathname;
    const modulos = [
        '/usuarios/',
        '/eventos/',
        '/inscricao/',
        '/pagamentos/',
        '/submissao/'
    ];

    for (const modulo of modulos) {
        const index = path.indexOf(modulo);

        if (index !== -1) {
            const caminho = path.slice(index + 1);
            const partes = caminho.split('/').filter(Boolean);

            if (partes.length > 0 && partes[partes.length - 1].includes('.')) {
                partes.pop();
            }

            return partes.length > 0 ? '../'.repeat(partes.length) : './';
        }
    }

    return './';
}

function resolveAppUrl(relativePathFromRoot) {
    const cleanPath = String(relativePathFromRoot || '').replace(/^\/+/, '');
    return `${getAppRoot()}${cleanPath}`;
}

function getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function getUser() {
    try {
        const u = localStorage.getItem(USER_KEY);
        return u ? JSON.parse(u) : null;
    } catch {
        return null;
    }
}

function setUser(usuario) {
    if (usuario) {
        localStorage.setItem(USER_KEY, JSON.stringify(usuario));
    }
}

function setAuth(data) {
    if (data.access) localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
    if (data.refresh) localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
    if (data.usuario) localStorage.setItem(USER_KEY, JSON.stringify(data.usuario));
}

function clearAuth() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

function isAuthenticated() {
    return Boolean(getAccessToken());
}

function logout() {
    clearAuth();
    window.location.href = resolveAppUrl('usuarios/login/login.html');
}

let _refreshPromise = null;

async function refreshToken() {
    const refresh = getRefreshToken();
    if (!refresh) {
        logout();
        return null;
    }

    if (_refreshPromise) {
        return _refreshPromise;
    }

    _refreshPromise = (async function() {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.access) {
                    localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
                    if (data.refresh) {
                        localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
                    }
                    return data.access;
                }
            }
        } catch (err) {
            console.error('Falha ao renovar token JWT:', err);
        } finally {
            _refreshPromise = null;
        }

        logout();
        return null;
    })();

    return _refreshPromise;
}

async function apiFetch(path, options = {}) {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
    const opts = { ...options };
    opts.headers = { ...options.headers };

    const token = getAccessToken();
    if (token) {
        opts.headers['Authorization'] = `Bearer ${token}`;
    }

    if (opts.body && !(opts.body instanceof FormData) && !opts.headers['Content-Type']) {
        opts.headers['Content-Type'] = 'application/json';
    }

    let response = await fetch(url, opts);

    if (response.status === 401 && getRefreshToken() && !options._retry) {
        const newToken = await refreshToken();
        if (newToken) {
            opts._retry = true;
            opts.headers['Authorization'] = `Bearer ${newToken}`;
            response = await fetch(url, opts);
        }
    }

    return response;
}

function showAlert(containerId, message, type = 'danger') {
    if (window.SGIE_DOM && typeof window.SGIE_DOM.showAlert === 'function') {
        window.SGIE_DOM.showAlert(containerId, message, type);
        return;
    }
    const container = document.getElementById(containerId);
    if (!container) return;

    let text = message;
    if (typeof message === 'object' && message !== null) {
        if (message.detail) {
            text = String(message.detail);
        } else if (message.non_field_errors) {
            text = Array.isArray(message.non_field_errors) ? message.non_field_errors.join(' ') : String(message.non_field_errors);
        } else {
            text = Object.entries(message)
                .map(([field, errs]) => {
                    const arr = Array.isArray(errs) ? errs : [errs];
                    return `${field.replace(/_/g, ' ')}: ${arr.join(' ')}`;
                })
                .join(' | ');
        }
    }

    const safeText = String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    container.innerHTML = `
        <div class="alert alert-${type}" role="alert">
            ${safeText}
        </div>
    `;
    container.style.display = 'block';
}

function clearAlert(containerId) {
    if (window.SGIE_DOM && typeof window.SGIE_DOM.clearAlert === 'function') {
        window.SGIE_DOM.clearAlert(containerId);
        return;
    }
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
    }
}

function formatarData(dataIso) {
    if (window.SGIE_FORMATTERS && typeof window.SGIE_FORMATTERS.formatarData === 'function') {
        return window.SGIE_FORMATTERS.formatarData(dataIso);
    }
    if (!dataIso) return '—';
    const partes = String(dataIso).split('T')[0].split('-');
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dataIso;
}

function formatarHora(horaStr) {
    if (window.SGIE_FORMATTERS && typeof window.SGIE_FORMATTERS.formatarHora === 'function') {
        return window.SGIE_FORMATTERS.formatarHora(horaStr);
    }
    if (!horaStr) return '—';
    return String(horaStr).slice(0, 5);
}

function formatarDataHora(dataHoraIso) {
    if (window.SGIE_FORMATTERS && typeof window.SGIE_FORMATTERS.formatarDataHora === 'function') {
        return window.SGIE_FORMATTERS.formatarDataHora(dataHoraIso);
    }
    if (!dataHoraIso) return '—';
    try {
        const d = new Date(dataHoraIso);
        if (isNaN(d.getTime())) return dataHoraIso;
        return d.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dataHoraIso;
    }
}

function formatarMoeda(valor) {
    if (window.SGIE_FORMATTERS && typeof window.SGIE_FORMATTERS.formatarMoeda === 'function') {
        return window.SGIE_FORMATTERS.formatarMoeda(valor);
    }
    const num = parseFloat(valor || 0);
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Arquivos enviados ficam em /media/ na raiz do servidor (fora de /api/sgie/v1).
function resolverUrlMidia(caminho) {
    if (!caminho) return '';
    const texto = String(caminho);
    if (/^https?:\/\//i.test(texto)) return texto;
    try {
        return new URL(texto.startsWith('/') ? texto : `/media/${texto}`, new URL(API_BASE_URL).origin).href;
    } catch {
        return texto;
    }
}

// Submissão: a API devolve `versoes` [{numero_versao, caminho_arquivo}]; a versão ativa é a de maior número.
function obterVersaoAtualSubmissao(sub) {
    const versoes = sub && Array.isArray(sub.versoes) ? sub.versoes : [];
    if (!versoes.length) return null;
    const atual = versoes.reduce((a, b) => (Number(b.numero_versao) > Number(a.numero_versao) ? b : a));
    return {
        numero: Number(atual.numero_versao) || 1,
        arquivo: atual.caminho_arquivo ? resolverUrlMidia(atual.caminho_arquivo) : '',
    };
}

function mascaraTelefone(valor) {
    if (window.SGIE_FORMATTERS && typeof window.SGIE_FORMATTERS.mascaraTelefone === 'function') {
        return window.SGIE_FORMATTERS.mascaraTelefone(valor);
    }
    let v = String(valor || '').replace(/\D/g, '').slice(0, 11);
    if (v.length > 10) {
        return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    } else if (v.length > 6) {
        return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
    } else if (v.length > 2) {
        return `(${v.slice(0, 2)}) ${v.slice(2)}`;
    }
    return v;
}

function mascaraCPF(valor) {
    if (window.SGIE_FORMATTERS && typeof window.SGIE_FORMATTERS.mascaraCPF === 'function') {
        return window.SGIE_FORMATTERS.mascaraCPF(valor);
    }
    let v = String(valor || '').replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) {
        return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
    } else if (v.length > 6) {
        return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
    } else if (v.length > 3) {
        return `${v.slice(0, 3)}.${v.slice(3)}`;
    }
    return v;
}

function mascaraData(valor) {
    if (window.SGIE_FORMATTERS && typeof window.SGIE_FORMATTERS.mascaraData === 'function') {
        return window.SGIE_FORMATTERS.mascaraData(valor);
    }
    const v = String(valor || '').replace(/\D/g, '').slice(0, 8);
    if (v.length > 4) return `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
    if (v.length > 2) return `${v.slice(0, 2)}/${v.slice(2)}`;
    return v;
}

function atualizarCabecalhoUsuario(activePage = '') {
    // A navegação é montada por shared/layout.js (carregado em todas as páginas).
    if (window.SGIE_LAYOUT && typeof window.SGIE_LAYOUT.atualizarNavegacao === 'function') {
        window.SGIE_LAYOUT.atualizarNavegacao(activePage);
    }
}

// Botão "olho" dos campos de senha.
// HTML: <div class="input-icon"> <input type="password"> <button type="button" class="btn btn-ghost btn-sm toggle" data-toggle-senha aria-label="Mostrar senha"><i class="ic ic-eye"></i></button></div>
function iniciarToggleSenha() {
    document.querySelectorAll('[data-toggle-senha]').forEach((btn) => {
        const wrap = btn.closest('.input-icon');
        const input = wrap ? wrap.querySelector('input') : null;
        if (!input) return;
        const icone = btn.querySelector('.ic');
        btn.addEventListener('click', () => {
            const mostrar = input.type === 'password';
            input.type = mostrar ? 'text' : 'password';
            if (icone) {
                icone.classList.toggle('ic-eye', !mostrar);
                icone.classList.toggle('ic-eye-off', mostrar);
            }
            btn.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
        });
    });
}
