/* SGIE — eventos/meus-eventos/meus_eventos.js
 *
 * Tela "Meus Eventos": lista os eventos sob gestão do usuário autenticado.
 * Endpoint: GET /eventos/meus-eventos/
 *
 * Depende de: config.js, api.js, shared/dom.js, shared/formatters.js,
 *             shared/roles.js, shared/layout.js
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Autenticação obrigatória
    if (!isAuthenticated()) {
        window.location.href = resolveAppUrl('usuarios/login/login.html');
        return;
    }

    // 2. Montar cabeçalho compartilhado
    atualizarCabecalhoUsuario('meus-eventos');

    // 3. Verificar permissão para criar evento
    const user = getUser();
    const podeCriar = window.SGIE_ROLES
        ? window.SGIE_ROLES.podeCriarEvento(user)
        : Boolean(user && (user.eh_organizador || user.is_organizador || user.acesso_admin || user.superusuario));

    const btnNovo = document.getElementById('btn-novo-evento');
    if (btnNovo && !podeCriar) {
        btnNovo.style.display = 'none';
    }

    // 4. Carregar lista
    await carregarMeusEventos();

    // 5. Filtros em tempo real (client-side após carregamento)
    const filtroBusca  = document.getElementById('filtro-busca');
    const filtroStatus = document.getElementById('filtro-status');
    if (filtroBusca)  filtroBusca.addEventListener('input',  aplicarFiltros);
    if (filtroStatus) filtroStatus.addEventListener('change', aplicarFiltros);
});

// Eventos carregados (cache para filtragem local)
let _todosEventos = [];

async function carregarMeusEventos() {
    const container = document.getElementById('lista-meus-eventos');
    if (!container) return;

    // Estado: carregando
    if (window.SGIE_DOM) {
        container.innerHTML = '';
        container.appendChild(window.SGIE_DOM.renderLoading('Carregando seus eventos...'));
    } else {
        container.innerHTML = '<p style="color:#64748b;padding:32px 0;">Carregando seus eventos...</p>';
    }

    try {
        const resp = await apiFetch('/eventos/meus-eventos/');

        if (!resp.ok) {
            const dados = await resp.json().catch(() => ({}));
            renderErro(dados.detail || 'Não foi possível carregar seus eventos.');
            return;
        }

        const dados = await resp.json();
        // Suporte a paginação DRF (results) ou array direto
        _todosEventos = Array.isArray(dados) ? dados : (dados.results || []);

        if (_todosEventos.length === 0 && !podeCriar) {
            sessionStorage.setItem('sgie_alerta_redirect', JSON.stringify({
                mensagem: 'Você não possui permissão para acessar o painel de gestão de eventos.',
                tipo: 'warning'
            }));
            window.location.href = resolveAppUrl('index.html');
            return;
        }

        renderLista(_todosEventos);

        // Mostrar filtros só se houver eventos
        const filterBar = document.getElementById('filter-bar');
        if (filterBar && _todosEventos.length > 1) {
            filterBar.style.display = 'flex';
        }

    } catch (err) {
        console.error('[meus_eventos] erro:', err);
        renderErro('Erro de conexão com o servidor do SGIE.');
    }
}

function aplicarFiltros() {
    const busca  = (document.getElementById('filtro-busca')?.value  || '').toLowerCase().trim();
    const status = (document.getElementById('filtro-status')?.value || '').toLowerCase().trim();

    const filtrados = _todosEventos.filter(ev => {
        const nomeBate   = !busca  || (ev.nome || '').toLowerCase().includes(busca);
        const statusBate = !status || (ev.status || '').toLowerCase() === status;
        return nomeBate && statusBate;
    });

    renderLista(filtrados);
}

function renderLista(eventos) {
    const container = document.getElementById('lista-meus-eventos');
    if (!container) return;

    if (!eventos || eventos.length === 0) {
        container.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'meus-eventos-empty';
        empty.innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5"
                 stroke-linecap="round" stroke-linejoin="round"
                 aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8"  y1="2" x2="8"  y2="6"/>
                <line x1="3"  y1="10" x2="21" y2="10"/>
            </svg>
            <p>Nenhum evento encontrado.</p>
            <a href="../cadastrar-evento/index.html" class="btn btn-primary btn-sm">Cadastrar meu primeiro evento</a>
        `;
        container.appendChild(empty);
        return;
    }

    const esc = window.SGIE_DOM ? window.SGIE_DOM.escapeHTML : (s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
    const fmt = window.SGIE_FORMATTERS;

    container.innerHTML = eventos.map(ev => {
        const statusClass = statusBadgeClass(ev.status);
        const dataTexto   = fmt ? fmt.formatarData(ev.data) : (ev.data || '—');
        const modalidade  = ev.modalidade_display || ev.modalidade || '—';
        const vagas       = (ev.vagas_ocupadas !== undefined && ev.capacidade)
            ? `${ev.vagas_ocupadas}/${ev.capacidade} vagas`
            : (ev.capacidade ? `${ev.capacidade} vagas` : '—');

        return `
        <div class="evento-card">
            <div class="evento-card__info">
                <div class="evento-card__header">
                    <a href="../detalhes-do-evento/index.html?id=${esc(ev.id)}"
                       class="evento-card__nome">${esc(ev.nome || 'Sem título')}</a>
                    <span class="badge ${statusClass}">${esc(ev.status_display || ev.status || '—')}</span>
                </div>

                <div class="evento-card__meta">
                    <span class="evento-card__meta-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2"
                             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        ${esc(dataTexto)}
                    </span>

                    <span class="evento-card__meta-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2"
                             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        ${esc(modalidade)}
                    </span>

                    <span class="evento-card__meta-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2"
                             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        ${esc(vagas)}
                    </span>
                </div>
            </div>

            <div class="evento-card__actions">
                <a href="../detalhes-do-evento/index.html?id=${esc(ev.id)}"
                   class="btn btn-outline btn-sm">Ver detalhes</a>
                <a href="../editar-evento/index.html?id=${esc(ev.id)}"
                   class="btn btn-ghost btn-sm">Editar</a>
                <a href="../../inscricao/consulta-de-participantes/index.html?evento=${esc(ev.id)}"
                   class="btn btn-ghost btn-sm">Participantes</a>
                <a href="../../inscricao/credenciamento/index.html?evento=${esc(ev.id)}"
                   class="btn btn-ghost btn-sm">Credenciamento</a>
            </div>
        </div>
        `;
    }).join('');
}

function statusBadgeClass(status) {
    const map = {
        'Rascunho':          'badge-neutral',
        'Configuração':      'badge-warning',
        'Publicado':         'badge-info',
        'Inscrições abertas':'badge-success',
        'Em realização':     'badge-success',
        'Finalizado':        'badge-neutral',
        'Arquivado':         'badge-neutral',
        'Cancelado':         'badge-danger',
    };
    return 'badge ' + (map[status] || 'badge-neutral');
}

function renderErro(msg) {
    const container = document.getElementById('lista-meus-eventos');
    if (!container) return;

    if (window.SGIE_DOM) {
        container.innerHTML = '';
        container.appendChild(window.SGIE_DOM.renderError(msg));
    } else {
        container.innerHTML = `<p style="color:#be123c;padding:32px 0;">${msg}</p>`;
    }
}
