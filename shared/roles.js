/**
 * SGIE — Controle de papéis e permissões da interface (shared/roles.js)
 * Única fonte de permissões no frontend.
 * Ordem de carga: config.js -> api.js -> shared/dom.js -> shared/formatters.js -> shared/mocks.js -> shared/roles.js -> shared/layout.js
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
        let u = null;
        if (typeof window.getUser === 'function') {
            u = window.getUser();
        } else {
            try {
                const raw = localStorage.getItem('sgie_user');
                u = raw ? JSON.parse(raw) : null;
            } catch {
                u = null;
            }
        }

        // MOCK 7.3: sobrescrever papéis para testes na interface sem trocar de conta
        if (u && window.SGIE_MOCKS && window.SGIE_MOCKS.ativo && window.SGIE_MOCKS.perfil) {
            return Object.assign({}, u, window.SGIE_MOCKS.perfil);
        }

        return u;
    }

    /**
     * Sincroniza sgie_user a partir de GET /usuarios/perfil/
     * Campos retornados pelo backend (UsuarioSerializer):
     * id, nome_completo, email, cpf, cpf_formatado, data_nascimento, telefone,
     * organizador, ativo, acesso_admin, superusuario, data_cadastro, ultimo_acesso.
     */
    async function sincronizarPerfilUsuario() {
        if (!isAutenticado() || typeof window.apiFetch !== 'function') return null;
        try {
            const resp = await window.apiFetch('/usuarios/perfil/');
            if (resp.ok) {
                const perfil = await resp.json();
                const atual = getUsuarioLogado() || {};
                const mesclado = Object.assign({}, atual, perfil);
                if (typeof window.setUser === 'function') {
                    window.setUser(mesclado);
                } else {
                    localStorage.setItem('sgie_user', JSON.stringify(mesclado));
                }
                return mesclado;
            }
        } catch {
            // Silencioso em caso de erro de rede para não travar a UI offline
        }
        return null;
    }

    /**
     * Regra 1.7: podeCriarEvento = organizador homologado ou staff/superusuário.
     * Organizador contextual não ganha permissão de criar outro evento.
     */
    function podeCriarEvento(usuario = null) {
        const u = usuario || getUsuarioLogado();
        if (!u || !isAutenticado()) return false;
        if (u.acesso_admin || u.superusuario || u.is_staff || u.is_superuser) return true;
        if (u.organizador === true || u.is_organizador === true) return true;
        return false;
    }

    /**
     * Regra 1.7: Menu "Meus eventos" visível quando /eventos/meus-eventos/ retornar itens
     * OU podeCriarEvento.
     */
    function podeAcessarMeusEventos(usuario = null) {
        const u = usuario || getUsuarioLogado();
        if (!u || !isAutenticado()) return false;
        if (podeCriarEvento(u)) return true;
        if (u.tem_eventos_organizados === true) return true;
        return false;
    }

    /**
     * Regra 1.7: Gestão de um evento:
     * ev.pode_gerenciar === true OU
     * String(ev.usuario_representante) === String(user.id) OU
     * staff / superusuário OU
     * Mock 7.2 (organizador contextual simulado)
     */
    function podeGerenciarEvento(evento, usuario = null) {
        const u = usuario || getUsuarioLogado();
        if (!u || !isAutenticado() || !evento) return false;

        // Staff / superusuário
        if (u.acesso_admin || u.superusuario || u.is_staff || u.is_superuser) return true;

        // Flag vinda do backend (quando houver)
        if (evento.pode_gerenciar === true) return true;

        // Representante principal do evento
        const repId = evento.usuario_representante?.id || evento.usuario_representante || evento.representante;
        if (repId && String(repId) === String(u.id)) return true;

        // MOCK 7.2: organizador contextual simulado por ID de evento
        if (window.SGIE_MOCKS && window.SGIE_MOCKS.ativo && Array.isArray(window.SGIE_MOCKS.gestorDosEventos)) {
            const evId = String(evento.id);
            if (window.SGIE_MOCKS.gestorDosEventos.some(id => String(id) === evId)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Avaliações (Fase 9): bloqueada para uso real até endpoint seguro de atribuições.
     */
    function podeAvaliar(usuario = null) {
        return false;
    }

    // Auto-sincronização na carga da página
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', () => {
            if (isAutenticado()) {
                sincronizarPerfilUsuario();
            }
        });
    }

    window.SGIE_ROLES = {
        isAutenticado,
        getUsuarioLogado,
        sincronizarPerfilUsuario,
        podeCriarEvento,
        podeAcessarMeusEventos,
        podeGerenciarEvento,
        podeAvaliar
    };

})(window);
