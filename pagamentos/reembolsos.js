/* SGIE — pagamentos/reembolsos.js
 * Solicitação e acompanhamento de reembolsos do participante.
 * Endpoints: GET /inscricoes/minhas/, GET /cobrancas/, GET /pagamentos/, GET /reembolsos/,
 *            POST /pagamentos/{id}/solicitar-reembolso/
 */
(function () {
    'use strict';
    const D = window.SGIE_DOM;
    const F = window.SGIE_FORMATTERS;
    const esc = D.escapeHTML;
    let pagamentos = [];
    let reembolsos = [];
    let cobrancaPorId = {};

    function renderPagamentos() {
        const box = document.getElementById('bloco-pagamentos');
        const jaPedidos = new Set(reembolsos.filter((r) => String(r.status).toLowerCase() !== 'recusado').map((r) => String(r.pagamento)));
        const lista = pagamentos.filter((p) => String(p.status).toLowerCase() === 'aprovado');
        if (!lista.length) {
            D.renderEmpty(box, { titulo: 'Nenhum pagamento aprovado', mensagem: 'Quando você pagar a inscrição em um evento, o pagamento aparecerá aqui.', icone: 'ic-info' });
            return;
        }
        box.innerHTML = D.tabela(
            [{ titulo: 'Evento' }, { titulo: 'Método' }, { titulo: 'Valor' }, { titulo: 'Pago em' }, { titulo: 'Ações', acoes: true }],
            lista.map((p) => {
                const c = cobrancaPorId[String(p.cobranca)] || {};
                const pedido = jaPedidos.has(String(p.id));
                return [
                    `<b>${esc(c.evento_nome || '—')}</b>`,
                    esc(F.formatarMetodoPagamento(p.metodo)),
                    `<span class="num">${esc(F.formatarMoeda(p.valor))}</span>`,
                    esc(F.formatarDataHora(p.data_pagamento)),
                    pedido
                        ? '<span class="badge badge-info">Reembolso solicitado</span>'
                        : `<button type="button" class="btn btn-secondary btn-sm" data-reembolsar="${esc(p.id)}">Solicitar reembolso</button>`,
                ];
            }));
        box.querySelectorAll('[data-reembolsar]').forEach((b) => b.addEventListener('click', () => solicitar(b.getAttribute('data-reembolsar'))));
    }

    function renderReembolsos() {
        const box = document.getElementById('bloco-reembolsos');
        if (!reembolsos.length) {
            D.renderEmpty(box, { titulo: 'Nenhuma solicitação', mensagem: 'Você ainda não solicitou reembolsos.', icone: 'ic-info' });
            return;
        }
        const pagPorId = Object.fromEntries(pagamentos.map((p) => [String(p.id), p]));
        box.innerHTML = D.tabela(
            [{ titulo: 'Evento' }, { titulo: 'Motivo' }, { titulo: 'Valor' }, { titulo: 'Solicitado em' }, { titulo: 'Status' }],
            reembolsos.map((r) => {
                const p = pagPorId[String(r.pagamento)] || {};
                const c = cobrancaPorId[String(p.cobranca)] || {};
                const st = F.formatarStatusReembolso(r.status);
                return [esc(c.evento_nome || '—'), esc(r.motivo || '—'), `<span class="num">${esc(F.formatarMoeda(r.valor))}</span>`, esc(F.formatarDataHora(r.data_solicitacao)), `<span class="badge ${st.badgeClass}">${esc(st.label)}</span>`];
            }));
    }

    async function carregar() {
        ['bloco-pagamentos', 'bloco-reembolsos'].forEach((id) => D.renderLoading(id, 'Carregando...'));
        const user = window.SGIE_ROLES.getUsuarioLogado() || {};
        const [ins, cob, pag, reemb] = await Promise.all([
            D.chamar('/inscricoes/minhas/'), D.chamar('/cobrancas/'), D.chamar('/pagamentos/'), D.chamar('/reembolsos/'),
        ]);
        const falha = [ins, cob, pag, reemb].find((r) => !r.ok);
        if (falha) {
            ['bloco-pagamentos', 'bloco-reembolsos'].forEach((id) => D.renderError(id, { titulo: 'Não foi possível carregar os dados', mensagem: falha.erro, tentarNovamenteFn: carregar }));
            return;
        }
        const minhasInscricoes = new Set(D.extrairLista(ins.dados).map((i) => String(i.id)));
        const minhasCobrancas = D.extrairLista(cob.dados).filter((c) => minhasInscricoes.has(String(c.inscricao)));
        cobrancaPorId = Object.fromEntries(minhasCobrancas.map((c) => [String(c.id), c]));
        pagamentos = D.extrairLista(pag.dados).filter((p) => cobrancaPorId[String(p.cobranca)]);
        reembolsos = D.extrairLista(reemb.dados).filter((r) => (!user.id || String(r.solicitado_por) === String(user.id)));
        renderPagamentos();
        renderReembolsos();
    }

    async function solicitar(id) {
        const p = pagamentos.find((x) => String(x.id) === String(id));
        if (!p) return;
        const v = await D.formulario({
            titulo: 'Solicitar reembolso',
            mensagem: `Valor pago: ${F.formatarMoeda(p.valor)}. Se não informar um valor, o reembolso será integral.`,
            confirmarTexto: 'Solicitar reembolso',
            campos: [
                { name: 'motivo', label: 'Motivo', tipo: 'textarea', obrigatorio: true, maxLength: 500, linhas: 3 },
                { name: 'valor', label: 'Valor a reembolsar (R$)', tipo: 'number', min: 0.01, max: Number(p.valor), step: '0.01', ajuda: 'Opcional.' },
            ],
            onConfirmar: async (val) => {
                const corpo = { motivo: val.motivo };
                if (val.valor) corpo.valor = String(val.valor);
                const r = await D.chamar(`/pagamentos/${encodeURIComponent(id)}/solicitar-reembolso/`, 'POST', corpo);
                return r.ok ? undefined : r.erro;
            },
        });
        if (v) {
            D.showAlert('mensagem-alerta', 'Reembolso solicitado. Acompanhe a situação abaixo.', 'success');
            await carregar();
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        if (!window.isAuthenticated()) { window.location.href = window.resolveAppUrl('usuarios/login/login.html'); return; }
        window.atualizarCabecalhoUsuario('');
        await carregar();
    });
})();
