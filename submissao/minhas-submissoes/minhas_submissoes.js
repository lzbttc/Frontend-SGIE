/* SGIE — submissao/minhas-submissoes/minhas_submissoes.js
 * Lista de submissões acadêmicas do autor.
 * Endpoint: GET /submissoes/
 */

document.addEventListener('DOMContentLoaded', async () => {
    if (!isAuthenticated()) {
        window.location.href = resolveAppUrl('usuarios/login/login.html');
        return;
    }

    atualizarCabecalhoUsuario('minhas-submissoes');

    const inputBusca = document.getElementById('filtro-busca');
    const selectStatus = document.getElementById('filtro-status');
    const btnLimpar = document.getElementById('btn-limpar-filtros');

    if (inputBusca) inputBusca.addEventListener('input', filtrarLocalmente);
    if (selectStatus) selectStatus.addEventListener('change', filtrarLocalmente);
    if (btnLimpar) {
        btnLimpar.addEventListener('click', () => {
            if (inputBusca) inputBusca.value = '';
            if (selectStatus) selectStatus.value = '';
            filtrarLocalmente();
        });
    }

    await carregarSubmissoes();
});

let _todasSubmissoes = [];

async function carregarSubmissoes() {
    const tbody = document.getElementById('lista-submissoes-corpo');
    if (!tbody) return;

    try {
        const resp = await apiFetch('/submissoes/');
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--danger);padding:32px 0;">${err.detail || 'Não foi possível carregar suas submissões.'}</td></tr>`;
            return;
        }

        const dados = await resp.json();
        _todasSubmissoes = Array.isArray(dados) ? dados : (dados.results || []);

        verificarAvisosCorrecao(_todasSubmissoes);
        renderizarTabela(_todasSubmissoes);

    } catch (e) {
        console.error('[minhas_submissoes] Erro:', e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--danger);padding:32px 0;">Erro de conexão com o servidor do SGIE.</td></tr>';
    }
}

function verificarAvisosCorrecao(lista) {
    const banner = document.getElementById('alerta-correcoes');
    const texto = document.getElementById('alerta-correcoes-texto');
    if (!banner || !texto) return;

    const pendentes = lista.filter(s => s.status === 'Correções solicitadas');
    if (pendentes.length > 0) {
        const primeiro = pendentes[0];
        const prazoFmt = primeiro.data_limite_correcao
            ? ` Prazo: ${window.SGIE_FORMATTERS ? window.SGIE_FORMATTERS.formatarData(primeiro.data_limite_correcao) : primeiro.data_limite_correcao}.`
            : '';
        texto.innerHTML = `<b>${pendentes.length} trabalho(s) precisa(m) de correção:</b> "${escapeHtml(primeiro.titulo || 'Trabalho')}".${prazoFmt} <a href="../detalhe-submissao/index.html?id=${primeiro.uuid || primeiro.id}" class="btn btn-secondary btn-sm right" style="margin-left:12px;">Ver parecer</a>`;
        banner.style.display = 'flex';
    } else {
        banner.style.display = 'none';
    }
}

function filtrarLocalmente() {
    const busca = (document.getElementById('filtro-busca')?.value || '').toLowerCase().trim();
    const status = (document.getElementById('filtro-status')?.value || '').trim();

    const filtradas = _todasSubmissoes.filter(sub => {
        const tituloBate = !busca || (sub.titulo || '').toLowerCase().includes(busca);
        const statusBate = !status || sub.status === status;
        return tituloBate && statusBate;
    });

    renderizarTabela(filtradas);
}

function renderizarTabela(lista) {
    const tbody = document.getElementById('lista-submissoes-corpo');
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--muted); padding: 48px 0;">
                    Nenhuma submissão encontrada.<br><br>
                    <a href="../submeter-trabalho/index.html" class="btn btn-primary btn-sm">Submeter meu primeiro trabalho</a>
                </td>
            </tr>
        `;
        return;
    }

    const fmt = window.SGIE_FORMATTERS;

    tbody.innerHTML = lista.map(sub => {
        const uuid = sub.uuid || sub.id;
        const titulo = escapeHtml(sub.titulo || 'Sem título');
        const tipo = escapeHtml(sub.tipo_display || sub.tipo || 'Artigo');
        const area = escapeHtml(sub.area_nome || (sub.area && sub.area.nome) || 'Área Geral');
        const eventoNome = escapeHtml(sub.evento_nome || (sub.evento && sub.evento.nome) || 'Evento');
        const versaoAtual = obterVersaoAtualSubmissao(sub);
        const versao = versaoAtual ? `v${versaoAtual.numero}` : '—';
        const dataFmt = fmt ? fmt.formatarData(sub.atualizado_em || sub.criado_em) : (sub.atualizado_em || '—');
        const statusBadge = getStatusBadge(sub.status);

        let acaoHtml = `<a class="btn btn-secondary btn-sm" href="../detalhe-submissao/index.html?id=${encodeURIComponent(uuid)}">Ver</a>`;

        if (sub.status === 'Rascunho') {
            acaoHtml = `<a class="btn btn-secondary btn-sm" href="../submeter-trabalho/index.html?id=${encodeURIComponent(uuid)}"><i class="ic ic-pencil"></i>Continuar</a>`;
        } else if (sub.status === 'Correções solicitadas') {
            acaoHtml = `<a class="btn btn-primary btn-sm" href="../detalhe-submissao/index.html?id=${encodeURIComponent(uuid)}#nova-versao">Enviar nova versão</a>`;
        }

        return `
            <tr>
                <td>
                    <b>${titulo}</b>
                    <div class="small muted">${tipo} · ${area}</div>
                </td>
                <td>${eventoNome}</td>
                <td>${statusBadge}</td>
                <td class="num">${versao}</td>
                <td class="num">${dataFmt}</td>
                <td class="actions">${acaoHtml}</td>
            </tr>
        `;
    }).join('');
}

function getStatusBadge(status) {
    const s = String(status || '').trim();
    const map = {
        'Rascunho': 'badge-neutral',
        'Submetida': 'badge-info',
        'Em avaliação': 'badge-warning',
        'Correções solicitadas': 'badge-warning',
        'Aprovada': 'badge-success',
        'Rejeitada': 'badge-danger'
    };
    const cls = map[s] || 'badge-neutral';
    return `<span class="badge ${cls}">${escapeHtml(s || '—')}</span>`;
}

const escapeHtml = (texto) => window.SGIE_DOM.escapeHTML(texto);
