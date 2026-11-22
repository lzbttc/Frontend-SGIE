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
        obterVagasOcupadas(eventoOuId, capacidade) {
            let id = 1;
            let cap = 100;
            if (typeof eventoOuId === 'object' && eventoOuId !== null) {
                if (typeof eventoOuId.vagas_ocupadas === 'number') return eventoOuId.vagas_ocupadas;
                id = Number(eventoOuId.id) || 1;
                cap = Number(eventoOuId.capacidade) || 100;
            } else {
                id = Number(eventoOuId) || 1;
                cap = Number(capacidade) || 100;
            }
            const seed = typeof id === 'number' && !isNaN(id) ? id : 1;
            return Math.floor(((seed * 37) % 85) / 100 * cap);
        },

        obterVagasDisponiveis(eventoOuId, capacidade) {
            if (typeof eventoOuId === 'object' && eventoOuId !== null) {
                if (typeof eventoOuId.vagas_disponiveis === 'number') return eventoOuId.vagas_disponiveis;
                const cap = Number(eventoOuId.capacidade) || 100;
                return Math.max(0, cap - this.obterVagasOcupadas(eventoOuId));
            }
            const cap = Number(capacidade) || 100;
            return Math.max(0, cap - this.obterVagasOcupadas(eventoOuId, cap));
        },

        // MOCK 7.5: Prazo de submissão na listagem caso regra_submissao não venha em GET /eventos/
        // → remover quando GET /eventos/ incluir regra_submissao aninhada
        obterRegraSubmissao(evento) {
            if (evento && evento.regra_submissao) return evento.regra_submissao;
            return null;
        },

        exibirSeloDadosExemplo(containerId) {
            if (!this.ativo) return;
            const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
            if (!container) return;
            const pai = container.parentElement || container;
            if (pai.querySelector('.badge-mock-exemplo')) return;

            const selo = document.createElement('span');
            selo.className = 'badge badge-neutral badge-mock-exemplo';
            selo.style.fontSize = '11px';
            selo.style.opacity = '0.85';
            selo.style.marginLeft = '8px';
            selo.title = 'Alguns dados nesta visualização são demonstrativos pois o endpoint da API ainda não os fornece.';
            selo.textContent = 'Dados de exemplo';

            if (container.classList && (container.classList.contains('events') || container.classList.contains('grid'))) {
                container.parentNode.insertBefore(selo, container);
                selo.style.display = 'inline-block';
                selo.style.marginBottom = '12px';
            } else {
                container.appendChild(selo);
            }
        }
    };

    /**
     * Helper global para exibir o selo discreto "Dados de exemplo"
     */
    window.exibirSeloDadosExemplo = function (containerId) {
        return window.SGIE_MOCKS.exibirSeloDadosExemplo(containerId);
    };

})(window);
