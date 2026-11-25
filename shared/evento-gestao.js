/**
 * SGIE — Inicialização das telas de gestão de um evento (shared/evento-gestao.js)
 *
 * Padrão único para as telas "por evento" (financeiro, lotes, agenda, avaliadores, equipe):
 *   1. exige login;
 *   2. lê o evento de ?evento= / ?id=;
 *   3. carrega GET /eventos/{id}/ e confirma que o usuário pode gerenciá-lo;
 *   4. preenche o cabeçalho (#titulo-evento, #crumb-evento-nome, #badge-status-evento,
 *      #btn-editar-evento) e atualiza as abas.
 *
 * Em qualquer falha redireciona para a página inicial com um alerta (mesmo padrão de
 * gestao_submissoes.js). Devolve o evento, ou null se redirecionou.
 *
 * Depende de: config.js, api.js, shared/dom.js, shared/roles.js, shared/layout.js, shared/evento-tabs.js
 */

(function (window) {
    'use strict';

    function sairComAlerta(mensagem, tipo) {
        sessionStorage.setItem('sgie_alerta_redirect', JSON.stringify({ mensagem, tipo }));
        window.location.href = window.resolveAppUrl('index.html');
        return null;
    }

    /**
     * @param {{ secao: string }} opcoes  secao = rótulo exibido no breadcrumb (ex.: "Financeiro")
     */
    async function iniciar(opcoes = {}) {
        if (!window.isAuthenticated()) {
            window.location.href = window.resolveAppUrl('usuarios/login/login.html');
            return null;
        }

        window.atualizarCabecalhoUsuario('meus-eventos');

        const eventoId = window.SGIE_EVENTO_TABS.eventoIdDaUrl();
        if (!eventoId) {
            return sairComAlerta('Selecione um evento em "Meus eventos" para acessar esta seção.', 'warning');
        }

        let evento;
        try {
            const resp = await window.apiFetch(`/eventos/${encodeURIComponent(eventoId)}/`);
            if (!resp.ok) {
                return sairComAlerta('Evento não encontrado ou acesso não autorizado.', 'danger');
            }
            evento = await resp.json();
        } catch {
            window.showAlert('mensagem-alerta', 'Erro de conexão com o servidor do SGIE.', 'danger');
            return null;
        }

        const user = window.SGIE_ROLES.getUsuarioLogado();
        if (!window.SGIE_ROLES.podeGerenciarEvento(evento, user)) {
            return sairComAlerta('Você não possui permissão para gerenciar este evento.', 'danger');
        }

        const titulo = document.getElementById('titulo-evento');
        const crumb = document.getElementById('crumb-evento-nome');
        const badge = document.getElementById('badge-status-evento');
        const editar = document.getElementById('btn-editar-evento');
        if (titulo) titulo.textContent = evento.nome || 'Evento';
        if (crumb) crumb.textContent = opcoes.secao || evento.nome || 'Evento';
        if (badge) badge.textContent = evento.status_display || evento.status || 'Evento';
        if (editar) editar.href = `../editar-evento/index.html?id=${encodeURIComponent(evento.id)}`;
        document.title = `${opcoes.secao || 'Gestão'} — ${evento.nome || 'Evento'} — SGIE`;

        window.SGIE_EVENTO_TABS.atualizar(evento.id);
        return evento;
    }

    window.SGIE_GESTAO = { iniciar };
})(window);
