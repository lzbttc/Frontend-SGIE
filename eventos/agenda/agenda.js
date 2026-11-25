/* SGIE — eventos/agenda/agenda.js
 * Locais de apresentação e agendamento de apresentações.
 * Endpoints: GET/POST /locais-apresentacao/, PATCH/DELETE /locais-apresentacao/{uuid}/ (filtro por evento no cliente),
 *            GET/POST /apresentacoes/, PATCH/DELETE /apresentacoes/{uuid}/, GET /submissoes/?evento_id=
 */
(function () {
    'use strict';
    const D = window.SGIE_DOM;
    const F = window.SGIE_FORMATTERS;
    const esc = D.escapeHTML;
    let evento = null;
    let locais = [];
    let submissoes = [];
    let apresentacoes = [];

    const ehAprovada = (s) => String(s.status || '').toLowerCase().startsWith('aprovad');
    const idsSub = () => new Set(submissoes.map((s) => String(s.id)));
    const tituloSub = (id) => (submissoes.find((s) => String(s.id) === String(id)) || {}).titulo || 'Trabalho';

    const CAMPOS_LOCAL = [
        { name: 'nome', label: 'Nome do local', tipo: 'text', obrigatorio: true, maxLength: 150, placeholder: 'Ex.: Auditório 2' },
        { name: 'capacidade', label: 'Capacidade (pessoas)', tipo: 'number', min: 1, step: '1' },
        { name: 'descricao', label: 'Descrição', tipo: 'textarea', linhas: 2 },
    ];

    function renderStats() {
        const agendadas = new Set(apresentacoes.map((a) => String(a.submissao)));
        const aprovadas = submissoes.filter(ehAprovada);
        document.getElementById('stat-locais').textContent = String(locais.length);
        document.getElementById('stat-agendadas').textContent = String(apresentacoes.length);
        document.getElementById('stat-aprovadas').textContent = String(aprovadas.length);
        document.getElementById('stat-sem-agenda').textContent = String(aprovadas.filter((s) => !agendadas.has(String(s.id))).length);
    }

    function renderLocais() {
        const box = document.getElementById('bloco-locais');
        if (!locais.length) {
            D.renderEmpty(box, { titulo: 'Nenhum local cadastrado', mensagem: 'Cadastre salas ou auditórios para poder agendar apresentações.', icone: 'ic-info', acaoTexto: 'Novo local', acaoOnClick: novoLocal });
            return;
        }
        box.innerHTML = D.tabela(
            [{ titulo: 'Local' }, { titulo: 'Capacidade' }, { titulo: 'Descrição' }, { titulo: 'Ações', acoes: true }],
            locais.map((l) => [
                `<b>${esc(l.nome)}</b>`,
                l.capacidade ? `<span class="num">${esc(l.capacidade)}</span>` : '<span class="muted">—</span>',
                esc(l.descricao || '—'),
                `<button type="button" class="btn btn-ghost btn-sm" data-editar-local="${esc(l.id)}">Editar</button> <button type="button" class="btn btn-danger-outline btn-sm" data-excluir-local="${esc(l.id)}">Excluir</button>`,
            ]));
        box.querySelectorAll('[data-editar-local]').forEach((b) => b.addEventListener('click', () => editarLocal(b.getAttribute('data-editar-local'))));
        box.querySelectorAll('[data-excluir-local]').forEach((b) => b.addEventListener('click', () => excluirLocal(b.getAttribute('data-excluir-local'))));
    }

    function renderApresentacoes() {
        const box = document.getElementById('bloco-apresentacoes');
        if (!apresentacoes.length) {
            D.renderEmpty(box, { titulo: 'Nenhuma apresentação agendada', mensagem: 'Agende os trabalhos aprovados em um dos locais cadastrados.', icone: 'ic-info' });
            return;
        }
        const ordenadas = [...apresentacoes].sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
        box.innerHTML = D.tabela(
            [{ titulo: 'Início' }, { titulo: 'Trabalho' }, { titulo: 'Local' }, { titulo: 'Duração' }, { titulo: 'Ações', acoes: true }],
            ordenadas.map((a) => [
                esc(F.formatarDataHora(a.inicio)),
                `<b>${esc(tituloSub(a.submissao))}</b>`,
                esc(a.local_nome || '—'),
                `<span class="num">${esc(a.duracao_minutos)} min</span>`,
                `<button type="button" class="btn btn-ghost btn-sm" data-editar-apres="${esc(a.id)}">Editar</button> <button type="button" class="btn btn-danger-outline btn-sm" data-excluir-apres="${esc(a.id)}">Cancelar</button>`,
            ]));
        box.querySelectorAll('[data-editar-apres]').forEach((b) => b.addEventListener('click', () => formApresentacao(b.getAttribute('data-editar-apres'))));
        box.querySelectorAll('[data-excluir-apres]').forEach((b) => b.addEventListener('click', () => excluirApresentacao(b.getAttribute('data-excluir-apres'))));
    }

    async function recarregar() {
        const [l, s, a] = await Promise.all([
            D.chamar('/locais-apresentacao/'),
            D.chamar(`/submissoes/?evento_id=${encodeURIComponent(evento.id)}`),
            D.chamar('/apresentacoes/'),
        ]);
        if (!l.ok) {
            D.renderError('bloco-locais', { titulo: 'Não foi possível carregar os locais', mensagem: l.erro, tentarNovamenteFn: recarregar });
        }
        locais = D.extrairLista(l.dados).filter((x) => String(x.evento) === String(evento.id));
        submissoes = D.extrairLista(s.dados);
        apresentacoes = D.extrairLista(a.dados).filter((x) => idsSub().has(String(x.submissao)));
        renderStats();
        if (l.ok) renderLocais();
        if (a.ok) renderApresentacoes();
        else D.renderError('bloco-apresentacoes', { titulo: 'Não foi possível carregar as apresentações', mensagem: a.erro, tentarNovamenteFn: recarregar });
    }

    function corpoLocal(v) {
        const c = { nome: v.nome, descricao: v.descricao || '' };
        c.capacidade = v.capacidade ? Number(v.capacidade) : null;
        return c;
    }
    async function novoLocal() {
        const v = await D.formulario({
            titulo: 'Novo local', campos: CAMPOS_LOCAL,
            onConfirmar: async (val) => { const r = await D.chamar('/locais-apresentacao/', 'POST', { ...corpoLocal(val), evento: evento.id }); return r.ok ? undefined : r.erro; },
        });
        if (v) { D.showAlert('mensagem-alerta', 'Local cadastrado.', 'success'); await recarregar(); }
    }
    async function editarLocal(id) {
        const l = locais.find((x) => String(x.id) === String(id));
        const v = await D.formulario({
            titulo: 'Editar local', campos: CAMPOS_LOCAL, valores: l,
            onConfirmar: async (val) => { const r = await D.chamar(`/locais-apresentacao/${encodeURIComponent(id)}/`, 'PATCH', corpoLocal(val)); return r.ok ? undefined : r.erro; },
        });
        if (v) { D.showAlert('mensagem-alerta', 'Local atualizado.', 'success'); await recarregar(); }
    }
    async function excluirLocal(id) {
        const ok = await D.confirmar({ titulo: 'Excluir local?', mensagem: 'Apresentações agendadas neste local podem ser afetadas.', confirmarTexto: 'Excluir', perigo: true });
        if (!ok) return;
        const r = await D.chamar(`/locais-apresentacao/${encodeURIComponent(id)}/`, 'DELETE');
        D.showAlert('mensagem-alerta', r.ok ? 'Local excluído.' : r.erro, r.ok ? 'success' : 'danger');
        await recarregar();
    }

    async function formApresentacao(id) {
        const editando = id ? apresentacoes.find((a) => String(a.id) === String(id)) : null;
        if (!locais.length) {
            D.showAlert('mensagem-alerta', 'Cadastre ao menos um local antes de agendar apresentações.', 'warning');
            return;
        }
        const agendadas = new Set(apresentacoes.map((a) => String(a.submissao)));
        const candidatas = submissoes.filter((s) => ehAprovada(s) && (!agendadas.has(String(s.id)) || (editando && String(editando.submissao) === String(s.id))));
        if (!candidatas.length) {
            D.showAlert('mensagem-alerta', 'Não há trabalhos aprovados aguardando agendamento.', 'warning');
            return;
        }
        const v = await D.formulario({
            titulo: editando ? 'Editar apresentação' : 'Agendar apresentação', largo: true,
            campos: [
                { name: 'submissao', label: 'Trabalho aprovado', tipo: 'select', obrigatorio: true, opcoes: candidatas.map((s) => ({ valor: s.id, rotulo: s.titulo })) },
                { name: 'local', label: 'Local', tipo: 'select', obrigatorio: true, opcoes: locais.map((l) => ({ valor: l.id, rotulo: l.nome })) },
                { name: 'inicio', label: 'Data e hora de início', tipo: 'datetime-local', obrigatorio: true },
                { name: 'duracao_minutos', label: 'Duração (minutos)', tipo: 'number', obrigatorio: true, min: 1, step: '1' },
            ],
            valores: editando ? { ...editando, inicio: D.isoParaInputLocal(editando.inicio) } : { duracao_minutos: 15 },
            onConfirmar: async (val) => {
                const corpo = { submissao: val.submissao, local: val.local, inicio: D.inputLocalParaIso(val.inicio), duracao_minutos: Number(val.duracao_minutos) };
                const r = editando
                    ? await D.chamar(`/apresentacoes/${encodeURIComponent(id)}/`, 'PATCH', corpo)
                    : await D.chamar('/apresentacoes/', 'POST', corpo);
                return r.ok ? undefined : r.erro;
            },
        });
        if (v) { D.showAlert('mensagem-alerta', editando ? 'Apresentação atualizada.' : 'Apresentação agendada.', 'success'); await recarregar(); }
    }
    async function excluirApresentacao(id) {
        const ok = await D.confirmar({ titulo: 'Cancelar apresentação?', mensagem: 'O trabalho volta a ficar sem horário definido.', confirmarTexto: 'Cancelar apresentação', cancelarTexto: 'Voltar', perigo: true });
        if (!ok) return;
        const r = await D.chamar(`/apresentacoes/${encodeURIComponent(id)}/`, 'DELETE');
        D.showAlert('mensagem-alerta', r.ok ? 'Apresentação cancelada.' : r.erro, r.ok ? 'success' : 'danger');
        await recarregar();
    }

    document.addEventListener('DOMContentLoaded', async () => {
        evento = await window.SGIE_GESTAO.iniciar({ secao: 'Agenda' });
        if (!evento) return;
        document.getElementById('btn-novo-local').addEventListener('click', novoLocal);
        document.getElementById('btn-nova-apresentacao').addEventListener('click', () => formApresentacao(null));
        ['bloco-locais', 'bloco-apresentacoes'].forEach((id) => D.renderLoading(id, 'Carregando...'));
        await recarregar();
    });
})();
