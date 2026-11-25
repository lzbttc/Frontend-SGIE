/* SGIE — eventos/equipe/equipe.js
 * Equipe organizadora do evento.
 * Endpoints: GET /organizadores-evento/?evento_id=, POST, PATCH/DELETE /organizadores-evento/{id}/
 */
(function () {
    'use strict';
    const D = window.SGIE_DOM;
    const esc = D.escapeHTML;
    let evento = null;
    let equipe = [];

    const CAMPOS = [
        { name: 'nome', label: 'Nome', tipo: 'text', obrigatorio: true, maxLength: 150 },
        { name: 'papel_funcao', label: 'Papel / função', tipo: 'text', obrigatorio: true, maxLength: 100, placeholder: 'Ex.: Coordenação geral' },
        { name: 'email_publico', label: 'E-mail público', tipo: 'email', obrigatorio: true },
    ];

    function render() {
        const box = document.getElementById('bloco-equipe');
        if (!equipe.length) {
            D.renderEmpty(box, { titulo: 'Equipe ainda não cadastrada', mensagem: 'Adicione as pessoas de contato que aparecerão na página do evento.', icone: 'ic-info', acaoTexto: 'Adicionar integrante', acaoOnClick: novo });
            return;
        }
        box.innerHTML = D.tabela(
            [{ titulo: 'Nome' }, { titulo: 'Função' }, { titulo: 'E-mail' }, { titulo: 'Ações', acoes: true }],
            equipe.map((m) => [
                `<b>${esc(m.nome)}</b>`, esc(m.papel_funcao || '—'), esc(m.email_publico || '—'),
                `<button type="button" class="btn btn-ghost btn-sm" data-editar="${esc(m.id)}">Editar</button> <button type="button" class="btn btn-danger-outline btn-sm" data-excluir="${esc(m.id)}">Remover</button>`,
            ]));
        box.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => editar(b.getAttribute('data-editar'))));
        box.querySelectorAll('[data-excluir]').forEach((b) => b.addEventListener('click', () => remover(b.getAttribute('data-excluir'))));
    }

    async function recarregar() {
        const r = await D.chamar(`/organizadores-evento/?evento_id=${encodeURIComponent(evento.id)}`);
        if (!r.ok) {
            D.renderError('bloco-equipe', { titulo: 'Não foi possível carregar a equipe', mensagem: r.erro, tentarNovamenteFn: recarregar });
            return;
        }
        equipe = D.extrairLista(r.dados);
        render();
    }

    async function novo() {
        const v = await D.formulario({
            titulo: 'Adicionar integrante', campos: CAMPOS,
            onConfirmar: async (val) => { const r = await D.chamar('/organizadores-evento/', 'POST', { ...val, evento: evento.id }); return r.ok ? undefined : r.erro; },
        });
        if (v) { D.showAlert('mensagem-alerta', 'Integrante adicionado.', 'success'); await recarregar(); }
    }
    async function editar(id) {
        const m = equipe.find((x) => String(x.id) === String(id));
        const v = await D.formulario({
            titulo: 'Editar integrante', campos: CAMPOS, valores: m,
            onConfirmar: async (val) => { const r = await D.chamar(`/organizadores-evento/${encodeURIComponent(id)}/`, 'PATCH', val); return r.ok ? undefined : r.erro; },
        });
        if (v) { D.showAlert('mensagem-alerta', 'Integrante atualizado.', 'success'); await recarregar(); }
    }
    async function remover(id) {
        const ok = await D.confirmar({ titulo: 'Remover integrante?', mensagem: 'Ele deixa de aparecer na página do evento.', confirmarTexto: 'Remover', perigo: true });
        if (!ok) return;
        const r = await D.chamar(`/organizadores-evento/${encodeURIComponent(id)}/`, 'DELETE');
        D.showAlert('mensagem-alerta', r.ok ? 'Integrante removido.' : r.erro, r.ok ? 'success' : 'danger');
        await recarregar();
    }

    document.addEventListener('DOMContentLoaded', async () => {
        evento = await window.SGIE_GESTAO.iniciar({ secao: 'Equipe' });
        if (!evento) return;
        document.getElementById('btn-novo-integrante').addEventListener('click', novo);
        D.renderLoading('bloco-equipe', 'Carregando equipe...');
        await recarregar();
    });
})();
