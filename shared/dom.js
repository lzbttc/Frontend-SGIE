/**
 * SGIE — Utilitários de DOM e renderização segura (shared/dom.js)
 * Ordem de carga sugerida: config.js -> api.js -> shared/dom.js -> shared/formatters.js -> shared/roles.js -> shared/layout.js
 */

(function (window) {
    'use strict';

    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function createElement(tag, attributes = {}, ...children) {
        const el = document.createElement(tag);
        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'className' || key === 'class') {
                el.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(el.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                el.addEventListener(key.slice(2).toLowerCase(), value);
            } else if (key === 'dataset' && typeof value === 'object') {
                Object.assign(el.dataset, value);
            } else if (value !== false && value !== null && value !== undefined) {
                el.setAttribute(key, value === true ? '' : value);
            }
        }
        for (const child of children) {
            if (child === null || child === undefined) continue;
            if (typeof child === 'string' || typeof child === 'number') {
                el.appendChild(document.createTextNode(String(child)));
            } else if (child instanceof Node) {
                el.appendChild(child);
            } else if (Array.isArray(child)) {
                child.forEach((c) => {
                    if (c instanceof Node) el.appendChild(c);
                    else if (c !== null && c !== undefined) el.appendChild(document.createTextNode(String(c)));
                });
            }
        }
        return el;
    }

    function renderLoading(container, mensagem = 'Carregando...') {
        const target = typeof container === 'string' ? document.getElementById(container) : container;
        if (!target) return;
        target.innerHTML = `
            <div class="empty" role="status" aria-live="polite">
                <div class="bar" style="width: 140px; margin-bottom: 12px;"><span style="width: 60%;"></span></div>
                <p class="muted">${escapeHTML(mensagem)}</p>
            </div>
        `;
    }

    function renderEmpty(container, options = {}) {
        const target = typeof container === 'string' ? document.getElementById(container) : container;
        if (!target) return;
        const {
            titulo = 'Nenhum registro encontrado',
            mensagem = 'Não há itens para exibir neste momento.',
            icone = 'ic-info',
            acaoTexto = '',
            acaoHref = '',
            acaoOnClick = null,
        } = options;

        target.innerHTML = `
            <div class="empty">
                <i class="ic ${escapeHTML(icone)}" style="width: 36px; height: 36px; color: var(--muted); margin-bottom: 8px;"></i>
                <h3 class="h3">${escapeHTML(titulo)}</h3>
                <p class="small muted" style="max-width: 360px;">${escapeHTML(mensagem)}</p>
                ${acaoTexto && acaoHref ? `<a href="${escapeHTML(acaoHref)}" class="btn btn-secondary btn-sm" style="margin-top: 12px;">${escapeHTML(acaoTexto)}</a>` : ''}
                ${acaoTexto && !acaoHref && acaoOnClick ? `<button type="button" class="btn btn-secondary btn-sm" style="margin-top: 12px;" data-empty-action>${escapeHTML(acaoTexto)}</button>` : ''}
            </div>
        `;

        if (acaoTexto && !acaoHref && acaoOnClick) {
            const btn = target.querySelector('[data-empty-action]');
            if (btn) btn.addEventListener('click', acaoOnClick);
        }
    }

    function renderError(container, options = {}) {
        const target = typeof container === 'string' ? document.getElementById(container) : container;
        if (!target) return;
        const {
            titulo = 'Erro ao carregar dados',
            mensagem = 'Ocorreu uma falha na comunicação com o servidor. Tente novamente mais tarde.',
            tentarNovamenteFn = null,
        } = options;

        target.innerHTML = `
            <div class="alert alert-danger" role="alert" style="margin: 16px 0;">
                <i class="ic ic-alert" style="width: 22px; height: 22px; flex: none;"></i>
                <div style="flex: 1;">
                    <b>${escapeHTML(titulo)}</b>
                    <p class="small" style="margin-top: 4px;">${escapeHTML(mensagem)}</p>
                    ${tentarNovamenteFn ? `<button type="button" class="btn btn-secondary btn-sm" style="margin-top: 10px;" data-retry-action>Tentar novamente</button>` : ''}
                </div>
            </div>
        `;

        if (tentarNovamenteFn) {
            const btn = target.querySelector('[data-retry-action]');
            if (btn) btn.addEventListener('click', tentarNovamenteFn);
        }
    }

    function extrairMensagemErro(message) {
        if (!message) return 'Ocorreu um erro inesperado.';
        if (typeof message === 'string') return message;
        if (typeof message === 'object') {
            if (message.detail) return String(message.detail);
            if (message.mensagem) return String(message.mensagem);
            if (message.erro) return String(message.erro);
            if (message.non_field_errors) {
                return Array.isArray(message.non_field_errors)
                    ? message.non_field_errors.join(' ')
                    : String(message.non_field_errors);
            }
            // Mapeia erros de campos
            const erros = Object.entries(message)
                .map(([field, errs]) => {
                    const rotulo = field.replace(/_/g, ' ');
                    const lista = Array.isArray(errs) ? errs.join(' ') : String(errs);
                    return `${rotulo}: ${lista}`;
                })
                .join(' | ');
            return erros || JSON.stringify(message);
        }
        return String(message);
    }

    function showAlert(containerIdOrElement, message, type = 'danger') {
        const container = typeof containerIdOrElement === 'string'
            ? document.getElementById(containerIdOrElement)
            : containerIdOrElement;
        if (!container) return;

        const texto = extrairMensagemErro(message);
        const mapType = {
            danger: { cls: 'alert-danger', ic: 'ic-alert' },
            error: { cls: 'alert-danger', ic: 'ic-alert' },
            warning: { cls: 'alert-warning', ic: 'ic-alert' },
            warn: { cls: 'alert-warning', ic: 'ic-alert' },
            success: { cls: 'alert-success', ic: 'ic-check' },
            info: { cls: 'alert-info', ic: 'ic-info' },
        }[type] || { cls: 'alert-danger', ic: 'ic-alert' };

        container.innerHTML = `
            <div class="alert ${mapType.cls}" role="alert">
                <i class="ic ${mapType.ic}" style="flex: none;"></i>
                <div style="flex: 1;">${escapeHTML(texto)}</div>
            </div>
        `;
        container.style.display = 'block';
        if (container.hasAttribute('hidden')) {
            container.removeAttribute('hidden');
        }
    }

    function clearAlert(containerIdOrElement) {
        const container = typeof containerIdOrElement === 'string'
            ? document.getElementById(containerIdOrElement)
            : containerIdOrElement;
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }
    }

    window.SGIE_DOM = {
        escapeHTML,
        createElement,
        renderLoading,
        renderEmpty,
        renderError,
        showAlert,
        clearAlert,
        extrairMensagemErro,
    };
})(window);
