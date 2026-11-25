/* SGIE — eventos/avaliadores/avaliadores.js
 * Vínculo de avaliadores ao evento.
 * Endpoints: GET /avaliadores-evento/?evento=, POST /avaliadores-evento/, DELETE /avaliadores-evento/{id}/,
 *            GET /avaliadores/ (candidatos ativos)
 */
(function () {
    'use strict';
    const D = window.SGIE_DOM;
    const esc = D.escapeHTML;
    let evento = null;
    let vinculos = [];

    function render() {
        const box = document.getElementById('bloco-avaliadores');
        if (!vinculos.length) {
            D.renderEmpty(box, { titulo: 'Nenhum avaliador vinculado', mensagem: 'Vincule avaliadores para poder sortear pareceristas para os trabalhos submetidos.', icone: 'ic-info', acaoTexto: 'Vincular avaliador', acaoOnClick: vincular });
            return;
        }
        box.innerHTML = D.tabela(
            [{ titulo: 'Avaliador' }, { titulo: 'Áreas de atuação' }, { titulo: 'Ações', acoes: true }],
            vinculos.map((v) => [
                `<b>${esc(v.avaliador_nome || '—')}</b><div class="small muted">${esc(v.avaliador_email || '')}</div>`,
                (v.avaliador_areas_nomes || []).map((a) => `<span class="badge badge-neutral">${esc(a)}</span>`).join(' ') || '<span class="muted">—</span>',
                `<button type="button" class="btn btn-danger-outline btn-sm" data-desvincular="${esc(v.id)}">Desvincular</button>`,
            ]));
        box.querySelectorAll('[data-desvincular]').forEach((b) => b.addEventListener('click', () => desvincular(b.getAttribute('data-desvincular'))));
    }

    async function recarregar() {
        const r = await D.chamar(`/avaliadores-evento/?evento=${encodeURIComponent(evento.id)}`);
        if (!r.ok) {
            D.renderError('bloco-avaliadores', { titulo: 'Não foi possível carregar os avaliadores', mensagem: r.erro, tentarNovamenteFn: recarregar });
            return;
        }
        vinculos = D.extrairLista(r.dados);
        render();
    }

    async function vincular() {
        const r = await D.chamar('/avaliadores/');
        if (!r.ok) { D.showAlert('mensagem-alerta', r.erro, 'danger'); return; }
        const jaVinculados = new Set(vinculos.map((v) => String(v.avaliador)));
        const candidatos = D.extrairLista(r.dados).filter((a) => a.ativo !== false && !jaVinculados.has(String(a.id)));
        if (!candidatos.length) {
            D.showAlert('mensagem-alerta', 'Não há avaliadores ativos disponíveis. Peça que a pessoa cadastre o "Perfil de avaliador" no menu da conta.', 'info');
            return;
        }
        const v = await D.formulario({
            titulo: 'Vincular avaliador', confirmarTexto: 'Vincular',
            campos: [{ name: 'avaliador', label: 'Avaliador', tipo: 'select', obrigatorio: true, opcoes: candidatos.map((a) => ({ valor: a.id, rotulo: `${a.usuario_nome || 'Avaliador'}${(a.areas_nomes || []).length ? ' — ' + a.areas_nomes.join(', ') : ''}` })) }],
            onConfirmar: async (val) => { const x = await D.chamar('/avaliadores-evento/', 'POST', { evento: evento.id, avaliador: val.avaliador }); return x.ok ? undefined : x.erro; },
        });
        if (v) { D.showAlert('mensagem-alerta', 'Avaliador vinculado ao evento.', 'success'); await recarregar(); }
    }

    async function desvincular(id) {
        const ok = await D.confirmar({ titulo: 'Desvincular avaliador?', mensagem: 'Ele deixa de poder ser sorteado para trabalhos deste evento.', confirmarTexto: 'Desvincular', perigo: true });
        if (!ok) return;
        const r = await D.chamar(`/avaliadores-evento/${encodeURIComponent(id)}/`, 'DELETE');
        D.showAlert('mensagem-alerta', r.ok ? 'Avaliador desvinculado.' : r.erro, r.ok ? 'success' : 'danger');
        await recarregar();
    }

    document.addEventListener('DOMContentLoaded', async () => {
        evento = await window.SGIE_GESTAO.iniciar({ secao: 'Avaliadores' });
        if (!evento) return;
        document.getElementById('btn-vincular-avaliador').addEventListener('click', vincular);
        D.renderLoading('bloco-avaliadores', 'Carregando avaliadores...');
        await recarregar();
    });
})();
