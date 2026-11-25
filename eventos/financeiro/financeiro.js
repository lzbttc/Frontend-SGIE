/* SGIE — eventos/financeiro/financeiro.js
 * Painel financeiro do organizador.
 * Endpoints:
 *   GET  /eventos/{id}/relatorio-financeiro/
 *   GET  /eventos/{id}/inscritos/         (ids das inscrições do evento)
 *   GET  /cobrancas/                      (filtrado no cliente pelas inscrições do evento)
 *   POST /cobrancas/{id}/conceder-isencao/
 *   GET  /reembolsos/ e /pagamentos/      (filtrados no cliente pelas cobranças do evento)
 */
(function () {
    'use strict';
    const D = window.SGIE_DOM;
    const F = window.SGIE_FORMATTERS;
    const esc = D.escapeHTML;

    let evento = null;
    let cobrancas = [];

    function porId(id) { return document.getElementById(id); }

    function renderKpis(r) {
        porId('kpi-bruto').textContent = F.formatarMoeda(r.total_arrecadado_bruto);
        porId('kpi-reembolsado').textContent = F.formatarMoeda(r.total_reembolsado);
        porId('kpi-liquido').textContent = F.formatarMoeda(r.total_liquido);
        porId('kpi-pendente').textContent = F.formatarMoeda(r.total_pendente);

        const metodos = r.distribuicao_metodos || [];
        if (!metodos.length) {
            D.renderEmpty('bloco-metodos', { titulo: 'Sem pagamentos aprovados', mensagem: 'Os valores aparecem aqui assim que houver pagamentos aprovados.', icone: 'ic-info' });
        } else {
            porId('bloco-metodos').innerHTML = D.tabela(
                [{ titulo: 'Método' }, { titulo: 'Pagamentos' }, { titulo: 'Total', acoes: true }],
                metodos.map((m) => [esc(F.formatarMetodoPagamento(m.metodo)), esc(m.quantidade), `<span class="num">${esc(F.formatarMoeda(m.total))}</span>`])
            );
        }

        const lotes = r.vendas_por_lote || [];
        if (!lotes.length) {
            D.renderEmpty('bloco-lotes', { titulo: 'Sem vendas por lote', mensagem: 'Cobranças pagas vinculadas a um lote aparecem aqui.', icone: 'ic-info' });
        } else {
            porId('bloco-lotes').innerHTML = D.tabela(
                [{ titulo: 'Lote' }, { titulo: 'Vendas' }, { titulo: 'Total', acoes: true }],
                lotes.map((l) => [esc(l.lote__nome || `Lote ${l.lote__numero}`), esc(l.quantidade), `<span class="num">${esc(F.formatarMoeda(l.total))}</span>`])
            );
        }
    }

    function renderCobrancas() {
        const busca = porId('filtro-cobranca-busca').value.trim().toLowerCase();
        const status = porId('filtro-cobranca-status').value;
        const lista = cobrancas.filter((c) =>
            (!status || String(c.status).toUpperCase() === status) &&
            (!busca || String(c.participante_nome || '').toLowerCase().includes(busca))
        );
        porId('total-cobrancas').textContent = String(lista.length);
        if (!lista.length) {
            D.renderEmpty('bloco-cobrancas', { titulo: 'Nenhuma cobrança encontrada', mensagem: 'Cobranças são geradas quando o participante se inscreve em um evento pago.', icone: 'ic-info' });
            return;
        }
        porId('bloco-cobrancas').innerHTML = D.tabela(
            [{ titulo: 'Participante' }, { titulo: 'Lote' }, { titulo: 'Valor' }, { titulo: 'Status' }, { titulo: 'Ações', acoes: true }],
            lista.map((c) => {
                const st = F.formatarStatusPagamento(c.status);
                const temDesconto = Number(c.valor_final) < Number(c.valor_original);
                const valor = temDesconto
                    ? `<span class="muted small" style="text-decoration: line-through;">${esc(F.formatarMoeda(c.valor_original))}</span> <b class="num">${esc(F.formatarMoeda(c.valor_final))}</b>`
                    : `<span class="num">${esc(F.formatarMoeda(c.valor_final))}</span>`;
                const iso = c.isencao ? `<div class="small muted">Isenção ${esc(String(c.isencao.tipo).toLowerCase())}: ${esc(c.isencao.motivo)}</div>` : '';
                const acao = String(c.status).toUpperCase() === 'PENDENTE' && !c.isencao
                    ? `<button type="button" class="btn btn-secondary btn-sm" data-isencao="${esc(c.id)}">Conceder isenção</button>`
                    : '<span class="muted small">—</span>';
                return [`<b>${esc(c.participante_nome || '—')}</b>${iso}`, esc(c.lote_nome || '—'), valor, `<span class="badge ${st.badgeClass}">${esc(st.label)}</span>`, acao];
            })
        );
        porId('bloco-cobrancas').querySelectorAll('[data-isencao]').forEach((b) =>
            b.addEventListener('click', () => conceder(b.getAttribute('data-isencao'))));
    }

    async function conceder(id) {
        const c = cobrancas.find((x) => String(x.id) === String(id));
        if (!c) return;
        const v = await D.formulario({
            titulo: 'Conceder isenção',
            mensagem: `Cobrança de ${c.participante_nome || 'participante'} — ${F.formatarMoeda(c.valor_original)}.`,
            confirmarTexto: 'Conceder isenção',
            campos: [
                { name: 'tipo', label: 'Tipo de isenção', tipo: 'select', obrigatorio: true, opcoes: [{ valor: 'TOTAL', rotulo: 'Total (cobrança zerada)' }, { valor: 'PARCIAL', rotulo: 'Parcial (desconto)' }] },
                { name: 'desconto_percentual', label: 'Desconto (%)', tipo: 'number', min: 0, max: 100, step: '0.01', ajuda: 'Somente para isenção parcial. Informe percentual ou valor.' },
                { name: 'desconto_valor', label: 'Desconto (R$)', tipo: 'number', min: 0, step: '0.01' },
                { name: 'motivo', label: 'Motivo', tipo: 'textarea', obrigatorio: true, maxLength: 500, linhas: 3 },
            ],
            valores: { tipo: 'TOTAL' },
            onConfirmar: async (val) => {
                const corpo = { tipo: val.tipo, motivo: val.motivo };
                if (val.tipo === 'PARCIAL') {
                    if (val.desconto_percentual) corpo.desconto_percentual = String(val.desconto_percentual);
                    if (val.desconto_valor) corpo.desconto_valor = String(val.desconto_valor);
                }
                const r = await D.chamar(`/cobrancas/${encodeURIComponent(id)}/conceder-isencao/`, 'POST', corpo);
                return r.ok ? undefined : r.erro;
            },
        });
        if (v) {
            D.showAlert('mensagem-alerta', 'Isenção concedida com sucesso.', 'success');
            await carregar();
        }
    }

    function renderReembolsos(lista) {
        porId('total-reembolsos').textContent = String(lista.length);
        if (!lista.length) {
            D.renderEmpty('bloco-reembolsos', { titulo: 'Nenhum reembolso', mensagem: 'Pedidos de reembolso dos participantes deste evento aparecem aqui.', icone: 'ic-info' });
            return;
        }
        porId('bloco-reembolsos').innerHTML = D.tabela(
            [{ titulo: 'Solicitante' }, { titulo: 'Motivo' }, { titulo: 'Valor' }, { titulo: 'Data' }, { titulo: 'Status' }],
            lista.map((r) => {
                const st = F.formatarStatusReembolso(r.status);
                return [esc(r.solicitado_por_nome || '—'), esc(r.motivo || '—'), `<span class="num">${esc(F.formatarMoeda(r.valor))}</span>`, esc(F.formatarDataHora(r.data_solicitacao)), `<span class="badge ${st.badgeClass}">${esc(st.label)}</span>`];
            })
        );
    }

    async function carregar() {
        ['bloco-metodos', 'bloco-lotes', 'bloco-cobrancas', 'bloco-reembolsos'].forEach((id) => D.renderLoading(id, 'Carregando...'));
        const [rel, inscritos, cob, pag, reemb] = await Promise.all([
            D.chamar(`/eventos/${encodeURIComponent(evento.id)}/relatorio-financeiro/`),
            D.chamar(`/eventos/${encodeURIComponent(evento.id)}/inscritos/`),
            D.chamar('/cobrancas/'),
            D.chamar('/pagamentos/'),
            D.chamar('/reembolsos/'),
        ]);

        if (rel.ok) {
            renderKpis(rel.dados);
        } else {
            ['bloco-metodos', 'bloco-lotes'].forEach((id) => D.renderError(id, { titulo: 'Relatório indisponível', mensagem: rel.erro, tentarNovamenteFn: carregar }));
        }

        const idsInscricao = new Set(D.extrairLista(inscritos.dados).map((i) => String(i.id)));
        cobrancas = D.extrairLista(cob.dados).filter((c) => idsInscricao.has(String(c.inscricao)));
        if (cob.ok) {
            renderCobrancas();
        } else {
            D.renderError('bloco-cobrancas', { titulo: 'Não foi possível carregar as cobranças', mensagem: cob.erro, tentarNovamenteFn: carregar });
        }

        const idsCobranca = new Set(cobrancas.map((c) => String(c.id)));
        const pagamentosEvento = new Set(D.extrairLista(pag.dados).filter((p) => idsCobranca.has(String(p.cobranca))).map((p) => String(p.id)));
        if (reemb.ok) {
            renderReembolsos(D.extrairLista(reemb.dados).filter((r) => pagamentosEvento.has(String(r.pagamento))));
        } else {
            D.renderError('bloco-reembolsos', { titulo: 'Não foi possível carregar os reembolsos', mensagem: reemb.erro, tentarNovamenteFn: carregar });
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        evento = await window.SGIE_GESTAO.iniciar({ secao: 'Financeiro' });
        if (!evento) return;
        porId('filtro-cobranca-busca').addEventListener('input', renderCobrancas);
        porId('filtro-cobranca-status').addEventListener('change', renderCobrancas);
        await carregar();
    });
})();
