/* SGIE — eventos/gestao-submissoes/gestao_submissoes.js
 * Painel de Curadoria e Gestão de Submissões do Organizador.
 * Endpoints:
 *   - GET /eventos/{id}/
 *   - GET /submissoes/?evento_id={id}
 *   - GET /submissoes/{uuid}/
 *   - POST /submissoes/{uuid}/sortear_avaliador/
 *   - POST /submissoes/{uuid}/aprovar/
 *   - POST /submissoes/{uuid}/solicitar_correcao/
 *   - POST /submissoes/{uuid}/rejeitar/
 */

document.addEventListener('DOMContentLoaded', async () => {
    if (!isAuthenticated()) {
        window.location.href = resolveAppUrl('usuarios/login/login.html');
        return;
    }

    atualizarCabecalhoUsuario('meus-eventos');

    const params = new URLSearchParams(window.location.search);
    let eventoId = params.get('evento') || params.get('id');

    if (!eventoId) {
        await carregarSeletorEventos();
    } else {
        await inicializarGestaoEvento(eventoId);
    }

    configurarFiltros();
    configurarFormCuradoria();
});

let _eventoAtual = null;
let _todasSubmissoes = [];
let _submissaoSelecionada = null;

async function carregarSeletorEventos() {
    const cardSeletor = document.getElementById('card-seletor-evento');
    const select = document.getElementById('select-evento-gestao');
    if (!cardSeletor || !select) return;

    cardSeletor.style.display = 'block';

    try {
        const resp = await apiFetch('/eventos/meus-eventos/');
        if (!resp.ok) {
            showAlert('mensagem-alerta', 'Não foi possível listar seus eventos.', 'danger');
            return;
        }

        const eventos = await resp.json();
        const lista = Array.isArray(eventos) ? eventos : (eventos.results || []);

        if (lista.length === 0) {
            sessionStorage.setItem('sgie_alerta_redirect', JSON.stringify({
                mensagem: 'Você não possui eventos sob sua gestão para curadoria de submissões.',
                tipo: 'warning'
            }));
            window.location.href = resolveAppUrl('index.html');
            return;
        }

        select.innerHTML = '<option value="">Selecione um evento para gerenciar...</option>';
        lista.forEach(ev => {
            const opt = document.createElement('option');
            opt.value = ev.id;
            opt.textContent = ev.nome;
            select.appendChild(opt);
        });

        select.addEventListener('change', () => {
            if (select.value) {
                inicializarGestaoEvento(select.value);
            }
        });

    } catch (e) {
        console.error('[gestao_submissoes] Erro ao carregar eventos:', e);
        showAlert('mensagem-alerta', 'Erro ao carregar lista de eventos.', 'danger');
    }
}

async function inicializarGestaoEvento(id) {
    clearAlert('mensagem-alerta');
    try {
        const respEvento = await apiFetch(`/eventos/${encodeURIComponent(id)}/`);
        if (!respEvento.ok) {
            showAlert('mensagem-alerta', 'Evento não encontrado ou acesso não autorizado.', 'danger');
            return;
        }

        _eventoAtual = await respEvento.json();

        const user = typeof window.SGIE_ROLES?.getUsuarioLogado === 'function'
            ? window.SGIE_ROLES.getUsuarioLogado()
            : getUser();

        const podeGerenciar = typeof window.SGIE_ROLES?.podeGerenciarEvento === 'function'
            ? window.SGIE_ROLES.podeGerenciarEvento(_eventoAtual, user)
            : Boolean(user && _eventoAtual.usuario_representante && String(user.id) === String(_eventoAtual.usuario_representante));

        if (!podeGerenciar) {
            sessionStorage.setItem('sgie_alerta_redirect', JSON.stringify({
                mensagem: 'Você não possui permissão para gerenciar as submissões deste evento.',
                tipo: 'danger'
            }));
            window.location.href = resolveAppUrl('index.html');
            return;
        }

        atualizarCabecalhoETabs(_eventoAtual);

        await carregarSubmissoesDoEvento(id);

    } catch (e) {
        console.error('[gestao_submissoes] Erro ao inicializar evento:', e);
        showAlert('mensagem-alerta', 'Erro de conexão com o servidor.', 'danger');
    }
}

function atualizarCabecalhoETabs(ev) {
    const elTitulo = document.getElementById('titulo-evento');
    const elCrumb = document.getElementById('crumb-evento-nome');
    const elStatus = document.getElementById('badge-status-evento');
    const btnEditar = document.getElementById('btn-editar-evento');

    if (elTitulo) elTitulo.textContent = ev.nome || 'Evento';
    if (elCrumb) elCrumb.textContent = ev.nome || 'Submissões';
    if (elStatus) elStatus.textContent = ev.status_display || ev.status || 'Ativo';
    if (btnEditar) btnEditar.href = `../editar-evento/index.html?id=${ev.id}`;

    // Configura links das tabs
    const tabVisao = document.getElementById('tab-visao-geral');
    const tabPart = document.getElementById('tab-participantes');
    const tabCred = document.getElementById('tab-credenciamento');

    if (tabVisao) tabVisao.href = `../detalhes-do-evento/index.html?id=${ev.id}`;
    if (tabPart) tabPart.href = `../../inscricao/consulta-de-participantes/index.html?evento=${ev.id}`;
    if (tabCred) tabCred.href = `../../inscricao/credenciamento/index.html?evento=${ev.id}`;
}

async function carregarSubmissoesDoEvento(eventoId) {
    const tbody = document.getElementById('lista-gestao-corpo');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px 0;">Carregando submissões...</td></tr>';
    }

    try {
        const resp = await apiFetch(`/submissoes/?evento_id=${encodeURIComponent(eventoId)}`);
        if (!resp.ok) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--danger);padding:32px 0;">Não foi possível carregar as submissões deste evento.</td></tr>';
            return;
        }

        const dados = await resp.json();
        _todasSubmissoes = Array.isArray(dados) ? dados : (dados.results || []);

        atualizarContadoresStats(_todasSubmissoes);
        renderizarTabelaGestao(_todasSubmissoes);

    } catch (e) {
        console.error('[gestao_submissoes] Erro ao listar submissões:', e);
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--danger);padding:32px 0;">Erro ao conectar com o servidor.</td></tr>';
    }
}

function atualizarContadoresStats(lista) {
    const total = lista.length;
    const emAvaliacao = lista.filter(s => s.status === 'Em avaliação').length;
    const correcao = lista.filter(s => s.status === 'Correções solicitadas').length;
    const decididos = lista.filter(s => s.status === 'Aprovada' || s.status === 'Rejeitada').length;

    const elTotal = document.getElementById('stat-total');
    const elAvaliacao = document.getElementById('stat-avaliacao');
    const elCorrecao = document.getElementById('stat-correcao');
    const elDecididos = document.getElementById('stat-decididos');
    const elCountTab = document.getElementById('count-total-tab');

    if (elTotal) elTotal.textContent = total;
    if (elAvaliacao) elAvaliacao.textContent = emAvaliacao;
    if (elCorrecao) elCorrecao.textContent = correcao;
    if (elDecididos) elDecididos.textContent = decididos;
    if (elCountTab) elCountTab.textContent = total;
}

function configurarFiltros() {
    const inputBusca = document.getElementById('gs-busca');
    const selectStatus = document.getElementById('gs-status');
    const btnLimpar = document.getElementById('btn-limpar-filtros');

    const aplicarFiltro = () => {
        const termo = (inputBusca?.value || '').toLowerCase().trim();
        const status = (selectStatus?.value || '').trim();

        const filtradas = _todasSubmissoes.filter(s => {
            const titulo = (s.titulo || '').toLowerCase();
            const autor = (s.autor_nome || '').toLowerCase();
            const bateBusca = !termo || titulo.includes(termo) || autor.includes(termo);
            const bateStatus = !status || s.status === status;
            return bateBusca && bateStatus;
        });

        renderizarTabelaGestao(filtradas);
    };

    if (inputBusca) inputBusca.addEventListener('input', aplicarFiltro);
    if (selectStatus) selectStatus.addEventListener('change', aplicarFiltro);
    if (btnLimpar) {
        btnLimpar.addEventListener('click', () => {
            if (inputBusca) inputBusca.value = '';
            if (selectStatus) selectStatus.value = '';
            aplicarFiltro();
        });
    }
}

function renderizarTabelaGestao(lista) {
    const tbody = document.getElementById('lista-gestao-corpo');
    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--muted); padding: 48px 0;">
                    Nenhuma submissão encontrada com os critérios informados.
                </td>
            </tr>
        `;
        return;
    }

    const fmt = window.SGIE_FORMATTERS;

    tbody.innerHTML = lista.map(sub => {
        const uuid = sub.uuid || sub.id;
        const titulo = escapeHtml(sub.titulo || 'Sem título');
        const autor = escapeHtml(sub.autor_nome || 'Autor');
        const area = escapeHtml(sub.area_nome || (sub.area && sub.area.nome) || 'Área Geral');
        const avaliadorNome = escapeHtml(sub.avaliador_nome || 'Avaliador não atribuído');
        const dataFmt = fmt ? fmt.formatarData(sub.criado_em) : (sub.criado_em || '—');
        const statusBadge = getStatusBadge(sub.status);

        return `
            <tr id="row-sub-${uuid}">
                <td>
                    <b>${titulo}</b>
                    <div class="small muted">${autor}</div>
                </td>
                <td>${area}</td>
                <td>${statusBadge}</td>
                <td>${avaliadorNome}</td>
                <td class="num">${dataFmt}</td>
                <td class="actions">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="selecionarTrabalhoCuradoria('${uuid}')">
                        Curadoria
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.selecionarTrabalhoCuradoria = async function(uuid) {
    clearAlert('mensagem-alerta');
    const painel = document.getElementById('painel-curadoria');
    if (!painel) return;

    // Remove seleção anterior
    document.querySelectorAll('#tabela-gestao-submissoes tr').forEach(r => r.classList.remove('is-selected'));
    const row = document.getElementById(`row-sub-${uuid}`);
    if (row) row.classList.add('is-selected');

    try {
        const resp = await apiFetch(`/submissoes/${encodeURIComponent(uuid)}/`);
        if (!resp.ok) {
            showAlert('mensagem-alerta', 'Não foi possível carregar os detalhes desta submissão.', 'danger');
            return;
        }

        _submissaoSelecionada = await resp.json();
        renderizarPainelCuradoria(_submissaoSelecionada);

        painel.style.display = 'block';
        painel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (e) {
        console.error('[gestao_submissoes] Erro ao carregar curadoria:', e);
        showAlert('mensagem-alerta', 'Erro ao carregar dados do trabalho.', 'danger');
    }
};

function renderizarPainelCuradoria(sub) {
    const elTitulo = document.getElementById('cur-titulo');
    const elMeta = document.getElementById('cur-meta');
    const btnBaixar = document.getElementById('btn-baixar-arquivo-cur');
    const cardParecer = document.getElementById('card-parecer-curadoria');
    const elSemParecer = document.getElementById('cur-sem-parecer');

    if (elTitulo) elTitulo.textContent = sub.titulo || 'Trabalho';

    if (elMeta) {
        const autor = sub.autor_nome || 'Autor';
        const tipo = sub.tipo_display || sub.tipo || 'Artigo';
        const area = sub.area_nome || (sub.area && sub.area.nome) || 'Área';
        const versao = sub.versao_atual ? `versão ${sub.versao_atual}` : 'versão 1';
        elMeta.textContent = `${autor} · ${tipo} · ${area} · ${versao}`;
    }

    if (btnBaixar) {
        if (sub.arquivo) {
            btnBaixar.href = sub.arquivo;
            btnBaixar.style.display = 'inline-flex';
        } else {
            btnBaixar.style.display = 'none';
        }
    }

    // Pareceres
    const avaliacoes = Array.isArray(sub.avaliacoes) ? sub.avaliacoes : [];
    if (cardParecer) {
        if (avaliacoes.length > 0) {
            const av = avaliacoes[0];
            const pontuacao = av.pontuacao !== null && av.pontuacao !== undefined ? `<b class="num">${av.pontuacao} / 100</b>` : '';
            cardParecer.innerHTML = `
                <div class="row between">
                    <b>${escapeHtml(av.avaliador_nome || 'Avaliador')}</b>
                    <span class="row" style="gap:8px;">
                        <span class="badge ${getStatusBadgeClass(av.status_parecer)}">${escapeHtml(av.status_parecer || 'Parecer')}</span>
                        ${pontuacao}
                    </span>
                </div>
                <p class="small" style="color:var(--ink-2);white-space:pre-line;line-height:1.5;">${escapeHtml(av.observacoes || 'Sem observações.')}</p>
            `;
        } else {
            cardParecer.innerHTML = '<p class="small muted">Nenhum parecer emitido ainda por avaliadores.</p>';
        }
    }

    // Configura botão de sortear avaliador
    const btnSortear = document.getElementById('btn-sortear-avaliador');
    if (btnSortear) {
        btnSortear.onclick = () => sortearAvaliador(sub.uuid || sub.id);
    }
}

async function sortearAvaliador(uuid) {
    clearAlert('mensagem-alerta');
    try {
        const resp = await apiFetch(`/submissoes/${encodeURIComponent(uuid)}/sortear_avaliador/`, {
            method: 'POST'
        });

        const dados = await resp.json().catch(() => ({}));

        if (!resp.ok) {
            showAlert('mensagem-alerta', dados.detail || 'Não foi possível sortear avaliador.', 'danger');
            return;
        }

        showAlert('mensagem-alerta', dados.detail || 'Avaliador sorteado e atribuído com sucesso!', 'success');
        await carregarSubmissoesDoEvento(_eventoAtual.id);
        window.selecionarTrabalhoCuradoria(uuid);

    } catch (e) {
        console.error('[gestao_submissoes] Erro ao sortear avaliador:', e);
        showAlert('mensagem-alerta', 'Erro de conexão com o servidor.', 'danger');
    }
}

function configurarFormCuradoria() {
    const radios = document.querySelectorAll('input[name="decisao_tipo"]');
    const campoPrazo = document.getElementById('campo-prazo-correcao');
    const btnRegistrar = document.getElementById('btn-registrar-decisao');

    radios.forEach(r => {
        r.addEventListener('change', () => {
            if (campoPrazo) {
                campoPrazo.style.display = r.value === 'solicitar_correcao' ? 'block' : 'none';
            }
        });
    });

    if (btnRegistrar) {
        btnRegistrar.addEventListener('click', registrarDecisaoCuradoria);
    }
}

async function registrarDecisaoCuradoria() {
    clearAlert('mensagem-alerta');

    if (!_submissaoSelecionada) {
        showAlert('mensagem-alerta', 'Selecione um trabalho antes de registrar a decisão.', 'warning');
        return;
    }

    const decisao = document.querySelector('input[name="decisao_tipo"]:checked')?.value;
    const obs = document.getElementById('cur-obs')?.value?.trim();
    const prazo = parseInt(document.getElementById('cur-prazo')?.value, 10);
    const uuid = _submissaoSelecionada.uuid || _submissaoSelecionada.id;

    if ((decisao === 'solicitar_correcao' || decisao === 'rejeitar') && !obs) {
        showAlert('mensagem-alerta', 'Observações são obrigatórias para rejeitar ou solicitar correções.', 'warning');
        document.getElementById('cur-obs')?.focus();
        return;
    }

    let urlAcao = '';
    let body = {};

    if (decisao === 'aprovar') {
        urlAcao = `/submissoes/${encodeURIComponent(uuid)}/aprovar/`;
        body = { observacoes: obs || 'Trabalho aprovado para o evento.' };
    } else if (decisao === 'solicitar_correcao') {
        urlAcao = `/submissoes/${encodeURIComponent(uuid)}/solicitar_correcao/`;
        body = { observacoes: obs, prazo_dias: prazo || 7 };
    } else if (decisao === 'rejeitar') {
        urlAcao = `/submissoes/${encodeURIComponent(uuid)}/rejeitar/`;
        body = { motivo: obs, observacoes: obs };
    }

    const btnRegistrar = document.getElementById('btn-registrar-decisao');
    if (btnRegistrar) btnRegistrar.disabled = true;

    try {
        const resp = await apiFetch(urlAcao, {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const dados = await resp.json().catch(() => ({}));

        if (!resp.ok) {
            showAlert('mensagem-alerta', dados.detail || 'Não foi possível registrar a decisão.', 'danger');
            return;
        }

        showAlert('mensagem-alerta', dados.detail || 'Decisão editorial registrada com sucesso!', 'success');
        document.getElementById('cur-obs').value = '';

        await carregarSubmissoesDoEvento(_eventoAtual.id);
        window.selecionarTrabalhoCuradoria(uuid);

    } catch (e) {
        console.error('[gestao_submissoes] Erro ao registrar decisão:', e);
        showAlert('mensagem-alerta', 'Erro de comunicação ao registrar decisão.', 'danger');
    } finally {
        if (btnRegistrar) btnRegistrar.disabled = false;
    }
}

function getStatusBadge(status) {
    const s = String(status || '').trim();
    const cls = getStatusBadgeClass(s);
    return `<span class="badge ${cls}">${escapeHtml(s || '—')}</span>`;
}

function getStatusBadgeClass(status) {
    const map = {
        'Rascunho': 'badge-neutral',
        'Submetida': 'badge-info',
        'Em avaliação': 'badge-warning',
        'Correções solicitadas': 'badge-warning',
        'Necessita correção': 'badge-warning',
        'Aprovada': 'badge-success',
        'Aprovado': 'badge-success',
        'Rejeitada': 'badge-danger',
        'Rejeitado': 'badge-danger'
    };
    return map[status] || 'badge-neutral';
}

function escapeHtml(texto) {
    if (window.SGIE_DOM && window.SGIE_DOM.escapeHTML) {
        return window.SGIE_DOM.escapeHTML(texto);
    }
    return String(texto ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
