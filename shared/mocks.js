/**
 * SGIE — Ganchos de desenvolvimento (shared/mocks.js)
 *
 * DESLIGADO por padrão: nenhum dado inventado chega à interface.
 * Para testar papéis sem trocar de conta, ligue manualmente no console:
 *     SGIE_MOCKS.ativo = true;
 *     SGIE_MOCKS.perfil = { organizador: true, acesso_admin: true };
 *
 * Observação: GET /eventos/ não devolve vagas_disponiveis (só o detalhe devolve).
 * Por isso as telas mostram apenas a capacidade na listagem, sem simular vagas.
 */

(function (window) {
    'use strict';

    window.SGIE_MOCKS = {
        ativo: false,

        // Simula organizador contextual em eventos específicos (ids) quando
        // pode_gerenciar não vier do backend. Só vale com ativo = true.
        gestorDosEventos: [],

        // Sobrescreve papéis do usuário logado para testes. Só vale com ativo = true.
        perfil: null,

        // Usa a regra de submissão real do evento; não inventa prazos.
        obterRegraSubmissao(evento) {
            if (evento && evento.regra_submissao) return evento.regra_submissao;
            return null;
        },
    };

})(window);
