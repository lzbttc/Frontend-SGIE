/**
 * SGIE — Abas de gestão do evento (shared/evento-tabs.js)
 *
 * Renderiza a navegação entre as seções de gestão de um evento, sempre carregando o
 * ID do evento na URL (cada tela lê o parâmetro que sempre usou: `id` ou `evento`).
 *
 * Uso: <nav class="tabs" id="tabs-evento" aria-label="Seções do evento" data-tab-ativa="financeiro"></nav>
 * O componente se monta sozinho a partir de ?evento= / ?id= e pode ser atualizado
 * depois com SGIE_EVENTO_TABS.atualizar(eventoId) quando o evento só é conhecido depois.
 *
 * Depende de: config.js, api.js (resolveAppUrl)
 */

(function (window) {
    'use strict';

    const SECOES = [
        { id: 'visao-geral', rotulo: 'Visão geral', caminho: 'eventos/detalhes-do-evento/index.html', param: 'id' },
        { id: 'participantes', rotulo: 'Participantes', caminho: 'inscricao/consulta-de-participantes/index.html', param: 'evento', contador: 'contador-participantes' },
        { id: 'credenciamento', rotulo: 'Credenciamento', caminho: 'inscricao/credenciamento/index.html', param: 'evento' },
        { id: 'submissoes', rotulo: 'Submissões', caminho: 'eventos/gestao-submissoes/index.html', param: 'evento', contador: 'count-total-tab' },
        { id: 'avaliadores', rotulo: 'Avaliadores', caminho: 'eventos/avaliadores/index.html', param: 'evento' },
        { id: 'agenda', rotulo: 'Agenda', caminho: 'eventos/agenda/index.html', param: 'evento' },
        { id: 'lotes', rotulo: 'Lotes e preços', caminho: 'eventos/lotes/index.html', param: 'evento' },
        { id: 'financeiro', rotulo: 'Financeiro', caminho: 'eventos/financeiro/index.html', param: 'evento' },
        { id: 'equipe', rotulo: 'Equipe', caminho: 'eventos/equipe/index.html', param: 'evento' },
    ];

    function eventoIdDaUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('evento') || params.get('id') || '';
    }

    function href(secao, eventoId) {
        const base = typeof window.resolveAppUrl === 'function' ? window.resolveAppUrl(secao.caminho) : secao.caminho;
        return eventoId ? `${base}?${secao.param}=${encodeURIComponent(eventoId)}` : base;
    }

    function render(container, ativa, eventoId) {
        if (!container) return;
        container.innerHTML = SECOES.map((s) => {
            const ehAtiva = s.id === ativa;
            const contador = ehAtiva && s.contador ? ` <span class="count" id="${s.contador}">0</span>` : '';
            return `<a class="tab${ehAtiva ? ' is-active' : ''}" id="tab-${s.id}" href="${href(s, eventoId)}"${ehAtiva ? ' aria-current="page"' : ''}>${s.rotulo}${contador}</a>`;
        }).join('');
    }

    function atualizar(eventoId) {
        const container = document.getElementById('tabs-evento');
        if (!container) return;
        // Preserva o contador já preenchido pela tela, se houver.
        const contadorAtual = container.querySelector('.count');
        const idContador = contadorAtual ? contadorAtual.id : null;
        const valorContador = contadorAtual ? contadorAtual.textContent : null;
        render(container, container.dataset.tabAtiva || '', eventoId);
        if (idContador) {
            const novo = document.getElementById(idContador);
            if (novo && valorContador !== null) novo.textContent = valorContador;
        }
    }

    function iniciar() {
        const container = document.getElementById('tabs-evento');
        if (container) render(container, container.dataset.tabAtiva || '', eventoIdDaUrl());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }

    window.SGIE_EVENTO_TABS = { SECOES, render, atualizar, eventoIdDaUrl };
})(window);
