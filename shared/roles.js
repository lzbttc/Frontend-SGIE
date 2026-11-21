/**
 * SGIE — Controle de papéis e permissões da interface (shared/roles.js)
 * Ordem de carga: config.js -> api.js -> shared/dom.js -> shared/formatters.js -> shared/roles.js -> shared/layout.js
 */

(function (window) {
    'use strict';

    function isAutenticado() {
        if (typeof window.isAuthenticated === 'function') {
            return window.isAuthenticated();
        }
        return Boolean(localStorage.getItem('sgie_access_token'));
    }

    function getUsuarioLogado() {
        if (typeof window.getUser === 'function') {
            return window.getUser();
        }
        try {
            const u = localStorage.getItem('sgie_user');
            return u ? JSON.parse(u) : null;
        } catch {
            return null;
        }
    }

    /**
     * Regra da seção 3.1: A criação de novos eventos deve exigir o perfil global
     * de organizador homologado ou staff. Organizador contextual não cria eventos.
     */
    function podeCriarEvento(usuario = null) {
        const u = usuario || getUsuarioLogado();
        if (!u || !isAutenticado()) return false;
        if (u.is_staff || u.is_superuser) return true;
        // Perfil global de organizador (quando homologado / ativo)
        if (u.perfil_organizador && (u.perfil_organizador.status === 'aprovado' || u.perfil_organizador.status === 'homologado' || u.perfil_organizador.ativo)) {
            return true;
        }
        if (u.eh_organizador === true || u.tipo === 'organizador') {
            return true;
        }
        return false;
    }

    /**
     * Regra da seção 3.1: Menu "Meus eventos" visível quando logado e o usuário
     * for organizador global ou tiver acesso à gestão de eventos.
     */
    function podeAcessarMeusEventos(usuario = null) {
        const u = usuario || getUsuarioLogado();
        if (!u || !isAutenticado()) return false;
        return Boolean(podeCriarEvento(u) || u.tem_eventos_organizados || u.eh_organizador);
    }

    /**
     * Regra da seção 3.2: O detalhe do evento não deve decidir permissões de gestão
     * apenas comparando o usuário com o representante do evento.
     * Considera organizadores vinculados (equipe organizadora) e staff.
     */
    function podeGerenciarEvento(evento, usuario = null) {
        const u = usuario || getUsuarioLogado();
        if (!u || !isAutenticado() || !evento) return false;
        if (u.is_staff || u.is_superuser) return true;

        const userId = u.id || u.uuid || u.usuario_id;
        if (!userId) return false;

        // Representante principal
        const repId = evento.representante_id || evento.representante?.id || evento.representante;
        if (repId && String(repId) === String(userId)) return true;

        // Equipe organizadora contextual do evento
        if (Array.isArray(evento.organizadores)) {
            const vinculado = evento.organizadores.some((org) => {
                const orgUserId = org.usuario_id || org.usuario?.id || org.usuario || org.id;
                return String(orgUserId) === String(userId);
            });
            if (vinculado) return true;
        }

        // Flag de permissão explícita vinda do serializer da API (se presente)
        if (evento.pode_gerenciar === true || evento.usuario_eh_organizador === true) {
            return true;
        }

        return false;
    }

    /**
     * Avaliações (Fase 9): bloqueada para uso real até endpoint seguro de atribuições.
     */
    function podeAvaliar(usuario = null) {
        // Bloqueada conforme seção 3.5 e Fase 9 até haver endpoint seguro de atribuições
        return false;
    }

    window.SGIE_ROLES = {
        isAutenticado,
        getUsuarioLogado,
        podeCriarEvento,
        podeAcessarMeusEventos,
        podeGerenciarEvento,
        podeAvaliar,
    };
})(window);
