/* SGIE — eventos/lotes/lotes.js
 * Categorias de preço e lotes do evento.
 * Endpoints: GET/POST /categorias-preco/?evento=, PATCH/DELETE /categorias-preco/{id}/,
 *            GET/POST /lotes/?evento=, PATCH/DELETE /lotes/{id}/
 */
(function () {
    'use strict';
    const D = window.SGIE_DOM;
    const F = window.SGIE_FORMATTERS;
    const esc = D.escapeHTML;
    let evento = null;
    let categorias = [];
    let lotes = [];

    const CAMPOS_CATEGORIA = [
        { name: 'nome', label: 'Nome da categoria', tipo: 'text', obrigatorio: true, maxLength: 100, placeholder: 'Ex.: Estudante' },
        { name: 'descricao', label: 'Descrição', tipo: 'textarea', linhas: 2, maxLength: 500 },
    ];

    function camposLote(editando) {
        const c = [
            { name: 'nome', label: 'Nome do lote', tipo: 'text', obrigatorio: true, maxLength: 100, placeholder: 'Ex.: 1º lote' },
            { name: 'numero', label: 'Número do lote', tipo: 'number', obrigatorio: true, min: 1, step: '1' },
            { name: 'preco', label: 'Preço (R$)', tipo: 'number', obrigatorio: true, min: 0, step: '0.01' },
            { name: 'quantidade_total', label: 'Quantidade de vagas', tipo: 'number', obrigatorio: true, min: 1, step: '1' },
            { name: 'data_inicio', label: 'Início da vigência', tipo: 'datetime-local', obrigatorio: true },
            { name: 'data_fim', label: 'Fim da vigência', tipo: 'datetime-local', obrigatorio: true },
        ];
        return c;
    }

    function corpoLote(v, categoriaId) {
        const corpo = {
            nome: v.nome,
            numero: Number(v.numero),
            preco: String(v.preco),
            quantidade_total: Number(v.quantidade_total),
            data_inicio: D.inputLocalParaIso(v.data_inicio),
            data_fim: D.inputLocalParaIso(v.data_fim),
        };
        if (categoriaId) corpo.categoria_preco = categoriaId;
        return corpo;
    }

    function render() {
        const box = document.getElementById('lista-categorias');
        if (!categorias.length) {
            D.renderEmpty(box, { titulo: 'Nenhuma categoria cadastrada', mensagem: 'Crie uma categoria (ex.: Estudante) e depois adicione seus lotes.', icone: 'ic-info', acaoTexto: 'Nova categoria', acaoOnClick: novaCategoria });
            return;
        }
        box.innerHTML = categorias.map((cat) => {
            const dela = lotes.filter((l) => String(l.categoria_preco) === String(cat.id)).sort((a, b) => a.numero - b.numero);
            const tabela = dela.length
                ? D.tabela(
                    [{ titulo: 'Lote' }, { titulo: 'Preço' }, { titulo: 'Vagas' }, { titulo: 'Vigência' }, { titulo: 'Situação' }, { titulo: 'Ações', acoes: true }],
                    dela.map((l) => {
                        const sit = !l.ativo ? '<span class="badge badge-neutral">Inativo</span>'
                            : !l.tem_vagas ? '<span class="badge badge-danger">Esgotado</span>'
                            : l.esta_vigente ? '<span class="badge badge-success">Vigente</span>'
                            : '<span class="badge badge-warning">Fora da vigência</span>';
                        return [
                            `<b>${esc(l.nome)}</b> <span class="muted small">#${esc(l.numero)}</span>`,
                            `<span class="num">${esc(F.formatarMoeda(l.preco))}</span>`,
                            `<span class="num">${esc(l.quantidade_disponivel)} / ${esc(l.quantidade_total)}</span>`,
                            `${esc(F.formatarDataHora(l.data_inicio))} — ${esc(F.formatarDataHora(l.data_fim))}`,
                            sit,
                            `<button type="button" class="btn btn-ghost btn-sm" data-editar-lote="${esc(l.id)}">Editar</button> <button type="button" class="btn btn-danger-outline btn-sm" data-excluir-lote="${esc(l.id)}">Excluir</button>`,
                        ];
                    }))
                : '<p class="muted small">Nenhum lote nesta categoria.</p>';
            return `
                <div class="card">
                    <div class="card-head">
                        <div>
                            <h3 class="h3">${esc(cat.nome)} ${cat.ativo === false ? '<span class="badge badge-neutral">Inativa</span>' : ''}</h3>
                            ${cat.descricao ? `<p class="muted small">${esc(cat.descricao)}</p>` : ''}
                        </div>
                        <div class="row">
                            <button type="button" class="btn btn-secondary btn-sm" data-novo-lote="${esc(cat.id)}"><i class="ic ic-plus"></i>Novo lote</button>
                            <button type="button" class="btn btn-ghost btn-sm" data-editar-cat="${esc(cat.id)}">Editar</button>
                            <button type="button" class="btn btn-danger-outline btn-sm" data-excluir-cat="${esc(cat.id)}">Excluir</button>
                        </div>
                    </div>
                    ${tabela}
                </div>`;
        }).join('');
        const on = (attr, fn) => box.querySelectorAll(`[${attr}]`).forEach((b) => b.addEventListener('click', () => fn(b.getAttribute(attr))));
        on('data-novo-lote', novoLote);
        on('data-editar-lote', editarLote);
        on('data-excluir-lote', excluirLote);
        on('data-editar-cat', editarCategoria);
        on('data-excluir-cat', excluirCategoria);
    }

    async function recarregar() {
        const [c, l] = await Promise.all([
            D.chamar(`/categorias-preco/?evento=${encodeURIComponent(evento.id)}`),
            D.chamar(`/lotes/?evento=${encodeURIComponent(evento.id)}`),
        ]);
        if (!c.ok || !l.ok) {
            D.renderError('lista-categorias', { titulo: 'Não foi possível carregar categorias e lotes', mensagem: c.erro || l.erro, tentarNovamenteFn: recarregar });
            return;
        }
        categorias = D.extrairLista(c.dados);
        lotes = D.extrairLista(l.dados);
        render();
    }

    async function salvarCategoria(id, v) {
        const corpo = { nome: v.nome, descricao: v.descricao || '' };
        const r = id
            ? await D.chamar(`/categorias-preco/${encodeURIComponent(id)}/`, 'PATCH', corpo)
            : await D.chamar('/categorias-preco/', 'POST', { ...corpo, evento: evento.id });
        return r.ok ? undefined : r.erro;
    }

    async function novaCategoria() {
        const v = await D.formulario({ titulo: 'Nova categoria de preço', campos: CAMPOS_CATEGORIA, onConfirmar: (val) => salvarCategoria(null, val) });
        if (v) { D.showAlert('mensagem-alerta', 'Categoria criada.', 'success'); await recarregar(); }
    }
    async function editarCategoria(id) {
        const cat = categorias.find((c) => String(c.id) === String(id));
        const v = await D.formulario({ titulo: 'Editar categoria', campos: CAMPOS_CATEGORIA, valores: cat, onConfirmar: (val) => salvarCategoria(id, val) });
        if (v) { D.showAlert('mensagem-alerta', 'Categoria atualizada.', 'success'); await recarregar(); }
    }
    async function excluirCategoria(id) {
        const ok = await D.confirmar({ titulo: 'Excluir categoria?', mensagem: 'Os lotes desta categoria também podem ser removidos. Esta ação não pode ser desfeita.', confirmarTexto: 'Excluir', perigo: true });
        if (!ok) return;
        const r = await D.chamar(`/categorias-preco/${encodeURIComponent(id)}/`, 'DELETE');
        D.showAlert('mensagem-alerta', r.ok ? 'Categoria excluída.' : r.erro, r.ok ? 'success' : 'danger');
        await recarregar();
    }

    async function novoLote(categoriaId) {
        const proximo = Math.max(0, ...lotes.filter((l) => String(l.categoria_preco) === String(categoriaId)).map((l) => Number(l.numero) || 0)) + 1;
        const v = await D.formulario({
            titulo: 'Novo lote', largo: true, campos: camposLote(), valores: { numero: proximo },
            onConfirmar: async (val) => { const r = await D.chamar('/lotes/', 'POST', corpoLote(val, categoriaId)); return r.ok ? undefined : r.erro; },
        });
        if (v) { D.showAlert('mensagem-alerta', 'Lote criado.', 'success'); await recarregar(); }
    }
    async function editarLote(id) {
        const l = lotes.find((x) => String(x.id) === String(id));
        const v = await D.formulario({
            titulo: 'Editar lote', largo: true, campos: camposLote(),
            valores: { ...l, data_inicio: D.isoParaInputLocal(l.data_inicio), data_fim: D.isoParaInputLocal(l.data_fim) },
            onConfirmar: async (val) => { const r = await D.chamar(`/lotes/${encodeURIComponent(id)}/`, 'PATCH', corpoLote(val)); return r.ok ? undefined : r.erro; },
        });
        if (v) { D.showAlert('mensagem-alerta', 'Lote atualizado.', 'success'); await recarregar(); }
    }
    async function excluirLote(id) {
        const ok = await D.confirmar({ titulo: 'Excluir lote?', mensagem: 'Lotes com cobranças existentes podem não ser excluídos. Esta ação não pode ser desfeita.', confirmarTexto: 'Excluir', perigo: true });
        if (!ok) return;
        const r = await D.chamar(`/lotes/${encodeURIComponent(id)}/`, 'DELETE');
        D.showAlert('mensagem-alerta', r.ok ? 'Lote excluído.' : r.erro, r.ok ? 'success' : 'danger');
        await recarregar();
    }

    document.addEventListener('DOMContentLoaded', async () => {
        evento = await window.SGIE_GESTAO.iniciar({ secao: 'Lotes e preços' });
        if (!evento) return;
        const gratuito = evento.e_gratuito === true;
        document.getElementById('aviso-evento-gratuito').hidden = !gratuito;
        document.getElementById('btn-nova-categoria').addEventListener('click', novaCategoria);
        D.renderLoading('lista-categorias', 'Carregando categorias e lotes...');
        await recarregar();
    });
})();
