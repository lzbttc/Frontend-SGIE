/* SGIE — submissao/avaliacoes/avaliacoes.js
 * Pareceres emitidos pelo usuário (GET /avaliacoes/).
 *
 * Limite conhecido do backend: a API não expõe ao avaliador a fila de trabalhos
 * ATRIBUÍDOS (AtribuicaoAvaliacao só aparece aninhada no detalhe da submissão, que
 * o avaliador não consegue abrir). Esta tela mostra, portanto, os pareceres já
 * registrados; a fila de pendentes depende de um endpoint dedicado no backend.
 */

const PARECER_BADGES = {
    'aprovado': 'badge-success',
    'rejeitado': 'badge-danger',
    'necessita correção': 'badge-warning',
};

function _esc(valor) {
    return window.SGIE_DOM.escapeHTML(valor == null ? '' : String(valor));
}

function _badgeParecer(status) {
    return PARECER_BADGES[String(status || '').toLowerCase().trim()] || 'badge-neutral';
}

function _htmlAvaliacao(av) {
    const rotulo = av.status_parecer_display || av.status_parecer || 'Parecer';
    const temNota = av.pontuacao !== null && av.pontuacao !== undefined && av.pontuacao !== '';
    const nota = temNota ? `<span class="small muted">Nota: <b>${_esc(av.pontuacao)}</b></span>` : '';
    const avaliador = av.avaliador_nome ? `<span class="small muted">Avaliador: ${_esc(av.avaliador_nome)}</span>` : '';
    const observacoes = av.observacoes
        ? `<p class="small">${_esc(av.observacoes)}</p>`
        : '<p class="small muted">Sem observações registradas.</p>';

    return `
        <article class="card stack">
            <div class="row between">
                <b class="h3">Trabalho ${_esc(String(av.submissao || '').slice(0, 8))}</b>
                <span class="badge ${_badgeParecer(av.status_parecer)}">${_esc(rotulo)}</span>
            </div>
            ${observacoes}
            <div class="row">
                ${avaliador}
                ${nota}
                <span class="small muted">${_esc(formatarDataHora(av.atualizado_em || av.criado_em))}</span>
            </div>
        </article>
    `;
}

async function carregarAvaliacoes() {
    const container = document.getElementById('lista-avaliacoes-container');
    if (!container) return;

    window.SGIE_DOM.renderLoading(container, 'Carregando pareceres...');

    try {
        const resp = await apiFetch('/avaliacoes/');
        if (!resp.ok) {
            const erro = await resp.json().catch(() => ({}));
            window.SGIE_DOM.renderError(container, {
                titulo: 'Não foi possível carregar os pareceres',
                mensagem: window.SGIE_DOM.extrairMensagemErro(erro),
                tentarNovamenteFn: carregarAvaliacoes,
            });
            return;
        }

        const dados = await resp.json();
        const lista = Array.isArray(dados) ? dados : (dados.results || []);

        if (!lista.length) {
            window.SGIE_DOM.renderEmpty(container, {
                titulo: 'Nenhum parecer registrado',
                mensagem: 'Os pareceres que você emitir aparecerão aqui.',
            });
            return;
        }

        container.innerHTML = lista.map(_htmlAvaliacao).join('');
    } catch (erro) {
        console.error('Erro ao carregar avaliações:', erro);
        window.SGIE_DOM.renderError(container, {
            titulo: 'Erro de conexão',
            mensagem: 'Não foi possível falar com o servidor do SGIE.',
            tentarNovamenteFn: carregarAvaliacoes,
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!isAuthenticated()) {
        window.location.href = resolveAppUrl('usuarios/login/login.html');
        return;
    }

    atualizarCabecalhoUsuario('avaliacoes');
    carregarAvaliacoes();
});
