/**
 * SGIE — Mocks Permitidos (shared/mocks.js)
 * Conforme REGRAS GERAIS e BLOCO 7 do Plano de Implementação.
 * Cada mock possui a identificação do que falta no backend e a condição de remoção.
 */

(function (window) {
    'use strict';

    window.SGIE_MOCKS = {
        ativo: true,

        // MOCK 7.2: Simular organizador contextual em eventos específicos quando pode_gerenciar não vier do backend
        // → remover quando o endpoint do evento retornar flag pode_gerenciar baseada em PapelContextual
        gestorDosEventos: [],

        // MOCK 7.3: Sobrescrever papéis para testes na interface sem trocar de conta
        // Exemplo de uso em console: SGIE_MOCKS.perfil = { organizador: true, acesso_admin: true }
        // → remover quando autenticação multifacetada com perfis múltiplos estiver disponível no backend
        perfil: null,

        // MOCK 7.1: Vagas calculadas na listagem de eventos a partir da capacidade
        // → remover quando GET /eventos/ retornar vagas_disponiveis e vagas_ocupadas
        obterVagasOcupadas(evento) {
            if (typeof evento.vagas_ocupadas === 'number') return evento.vagas_ocupadas;
            const cap = Number(evento.capacidade) || 100;
            const seed = Number(evento.id) || 1;
            return Math.floor(((seed * 37) % 85) / 100 * cap);
        },

        obterVagasDisponiveis(evento) {
            if (typeof evento.vagas_disponiveis === 'number') return evento.vagas_disponiveis;
            const cap = Number(evento.capacidade) || 100;
            return Math.max(0, cap - this.obterVagasOcupadas(evento));
        },

        // MOCK 7.5: Prazo de submissão na listagem caso regra_submissao não venha em GET /eventos/
        // → remover quando GET /eventos/ incluir regra_submissao aninhada
        obterRegraSubmissao(evento) {
            if (evento.regra_submissao) return evento.regra_submissao;
            return null;
        }
    };

    /**
     * Insere um selo discreto "Dados de exemplo" em telas que estiverem exibindo dados mockados.
     */
    window.exibirSeloDadosExemplo = function (containerId) {
        if (!window.SGIE_MOCKS || !window.SGIE_MOCKS.ativo) return;
        const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        if (!container || container.querySelector('.badge-mock-exemplo')) return;

        const selo = document.createElement('span');
        selo.className = 'badge badge-neutral badge-mock-exemplo';
        selo.style.fontSize = '11px';
        selo.style.opacity = '0.85';
        selo.style.marginLeft = '8px';
        selo.title = 'Alguns dados nesta visualização são demonstrativos pois o endpoint da API ainda não os fornece.';
        selo.textContent = 'Dados de exemplo';
        container.appendChild(selo);
    };

})(window);
