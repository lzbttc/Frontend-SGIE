/* SGIE — index.js (tela Explorar Eventos) */

let abaAtual = 'todos';

const $ = (id) => document.getElementById(id);

function esc(valor) {
    if (typeof window.escapeHTML === 'function') {
        return window.escapeHTML(valor);
    }
    return String(valor ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

function dataCurta(dataIso) {
    const [a, m, d] = String(dataIso || '').split('T')[0].split('-').map(Number);
    if (!a) return '—';
    return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ---------- Inicialização ---------- */

document.addEventListener('DOMContentLoaded', () => {
    atualizarCabecalhoUsuario('eventos');

    // Registro de ouvintes primeiro para que parâmetros de URL não impeçam o registro
    const tabTodos = $('tab-todos');
    const tabMeus = $('tab-meus-eventos');
    const btnFiltrar = $('btn-aplicar-filtros');
    const btnLimpar = $('btn-limpar-filtros');
    const filtroBusca = $('filtro-busca');

    if (tabTodos) tabTodos.addEventListener('click', () => alternarAba('todos'));
    if (tabMeus) tabMeus.addEventListener('click', () => alternarAba('meus-eventos'));
    if (btnFiltrar) btnFiltrar.addEventListener('click', carregarEventos);
    if (btnLimpar) {
        btnLimpar.addEventListener('click', () => {
            ['filtro-busca', 'filtro-categoria', 'filtro-modalidade', 'filtro-preco'].forEach((id) => {
                const el = $(id);
                if (el) el.value = '';
            });
            carregarEventos();
        });
    }
    if (filtroBusca) {
        filtroBusca.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') carregarEventos();
        });
    }
    ['filtro-categoria', 'filtro-modalidade', 'filtro-preco'].forEach((id) => {
        const el = $(id);
        if (el) el.addEventListener('change', carregarEventos);
    });

    const isAuth = typeof window.SGIE_ROLES?.isAutenticado === 'function'
        ? window.SGIE_ROLES.isAutenticado()
        : isAuthenticated();

    const user = typeof window.SGIE_ROLES?.getUsuarioLogado === 'function'
        ? window.SGIE_ROLES.getUsuarioLogado()
        : getUser();

    const podeVerMeus = typeof window.SGIE_ROLES?.podeAcessarMeusEventos === 'function'
        ? window.SGIE_ROLES.podeAcessarMeusEventos(user)
        : Boolean(isAuth);

    if (isAuth && podeVerMeus) {
        const tabsNav = $('tabs-nav');
        if (tabsNav) tabsNav.hidden = false;
        atualizarContadorMeusEventos();

        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        if (tabParam === 'meus' || tabParam === 'meus-eventos') {
            alternarAba('meus-eventos');
            return;
        }
    }

    carregarEventos();
});

function alternarAba(aba) {
    abaAtual = aba;
    const tabTodos = $('tab-todos');
    const tabMeus = $('tab-meus-eventos');
    const toolbar = $('toolbar-filtros');

    if (tabTodos) tabTodos.classList.toggle('is-active', aba === 'todos');
    if (tabMeus) tabMeus.classList.toggle('is-active', aba === 'meus-eventos');
    if (toolbar) toolbar.hidden = (aba !== 'todos');

    carregarEventos();
}

async function atualizarContadorMeusEventos() {
    try {
        const resp = await apiFetch('/eventos/meus-eventos/');
        if (resp.ok) {
            const lista = await resp.json();
            const badge = $('badge-total-meus');
            if (badge) badge.textContent = Array.isArray(lista) ? lista.length : (lista.results?.length || 0);
        }
    } catch { /* contador é opcional */ }
}

/* ---------- Carregamento ---------- */

async function carregarEventos() {
    clearAlert('mensagem-alerta');
    $('loading-spinner').hidden = false;
    $('grid-eventos').hidden = true;
    $('sem-eventos').hidden = true;

    let url = '/eventos/meus-eventos/';
    if (abaAtual === 'todos') {
        const params = new URLSearchParams();
        const filtros = {
            search: $('filtro-busca')?.value?.trim() || '',
            categoria: $('filtro-categoria')?.value || '',
            modalidade: $('filtro-modalidade')?.value || '',
            e_gratuito: $('filtro-preco')?.value || ''
        };
        Object.entries(filtros).forEach(([k, v]) => { if (v) params.append(k, v); });
        url = `/eventos/${params.toString() ? `?${params}` : ''}`;
    }

    try {
        const resp = await apiFetch(url);
        $('loading-spinner').hidden = true;

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            showAlert('mensagem-alerta', err.detail || 'Não foi possível carregar os eventos.', 'danger');
            return;
        }

        const dados = await resp.json();
        let eventos = Array.isArray(dados) ? dados : (dados.results || []);

        if (abaAtual === 'meus-eventos') {
            const badge = $('badge-total-meus');
            if (badge) badge.textContent = eventos.length;
        } else {
            // Na aba Explorar, ocultar eventos com status Rascunho ou Configuração
            eventos = eventos.filter((ev) => ev.status !== 'Rascunho' && ev.status !== 'Configuração');
        }

        if (!eventos.length) return mostrarVazio();
        renderizarEventos(eventos);
        $('grid-eventos').hidden = false;
    } catch {
        $('loading-spinner').hidden = true;
        showAlert('mensagem-alerta', 'Erro de conexão com o servidor do SGIE.', 'danger');
    }
}

function mostrarVazio() {
    const meus = abaAtual === 'meus-eventos';
    $('titulo-vazio').textContent = meus ? 'Você ainda não cadastrou eventos' : 'Nenhum evento encontrado';
    $('desc-vazio').innerHTML = meus
        ? 'Crie seu primeiro evento em <a href="eventos/cadastrar-evento/index.html">Cadastrar Evento</a>.'
        : 'Tente ajustar os filtros aplicados.';
    $('sem-eventos').hidden = false;
}

/* ---------- Renderização ---------- */

function renderizarEventos(eventos) {
    const user = typeof window.SGIE_ROLES?.getUsuarioLogado === 'function'
        ? window.SGIE_ROLES.getUsuarioLogado()
        : getUser();
    const logado = typeof window.SGIE_ROLES?.isAutenticado === 'function'
        ? window.SGIE_ROLES.isAutenticado()
        : isAuthenticated();

    const grid = $('grid-eventos');
    grid.innerHTML = eventos.map((ev) => htmlCard(ev, user, logado)).join('');

    if (window.SGIE_MOCKS?.ativo && typeof window.SGIE_MOCKS.exibirSeloDadosExemplo === 'function') {
        const usouMock = eventos.some((ev) => ev.vagas_disponiveis === undefined && window.SGIE_MOCKS.obterVagasDisponiveis(ev.id, ev.capacidade) !== undefined);
        if (usouMock) {
            window.SGIE_MOCKS.exibirSeloDadosExemplo('grid-eventos');
        }
    }
}

function htmlCard(ev, user, logado) {
    let vagasDisponiveis = ev.vagas_disponiveis;
    if (vagasDisponiveis === undefined && window.SGIE_MOCKS?.ativo && typeof window.SGIE_MOCKS.obterVagasDisponiveis === 'function') {
        vagasDisponiveis = window.SGIE_MOCKS.obterVagasDisponiveis(ev.id, ev.capacidade);
    }

    const temVagas = Number.isFinite(vagasDisponiveis);
    const esgotado = temVagas && vagasDisponiveis <= 0 && ev.status !== 'Finalizado' && ev.status !== 'Cancelado';

    let badgeClasse = 'badge-neutral';
    let rotuloStatus = ev.status_display || ev.status || 'Publicado';

    if (esgotado) {
        badgeClasse = 'badge-warning';
        rotuloStatus = 'Vagas esgotadas';
    } else if (typeof window.SGIE_FORMATTERS?.formatarStatusEvento === 'function') {
        const st = window.SGIE_FORMATTERS.formatarStatusEvento(ev.status);
        badgeClasse = st.badgeClass;
        rotuloStatus = st.label;
    }

    const categoria = ev.categoria === 'Outro' && ev.categoria_personalizada
        ? ev.categoria_personalizada
        : (ev.categoria_display || ev.categoria || 'Evento');

    const detalhes = `eventos/detalhes-do-evento/index.html?id=${encodeURIComponent(ev.id)}`;

    const vagasTexto = !temVagas
        ? `Capacidade: ${esc(ev.capacidade || 0)}`
        : esgotado
            ? 'Lista de espera'
            : `${vagasDisponiveis} vagas`;

    const iconeLocal = (ev.modalidade === 'On-line') ? 'ic-link' : (ev.modalidade === 'Híbrido' ? 'ic-repeat' : 'ic-pin');
    const localTexto = ev.modalidade === 'On-line'
        ? 'On-line'
        : (ev.local ? `${esc(ev.local)} · ${esc(ev.modalidade || 'Presencial')}` : esc(ev.modalidade || 'Presencial'));

    const precoFmt = ev.e_gratuito
        ? 'Gratuito'
        : (typeof window.formatarMoeda === 'function' ? formatarMoeda(ev.preco) : `R$ ${Number(ev.preco || 0).toFixed(2).replace('.', ',')}`);

    const horaInicioFmt = typeof window.formatarHora === 'function' ? formatarHora(ev.hora_inicio) : (ev.hora_inicio || '');
    const horaFimFmt = typeof window.formatarHora === 'function' ? formatarHora(ev.hora_fim) : (ev.hora_fim || '');

    return `
    <a class="ev" href="${detalhes}">
        <div aria-hidden="true" class="ev-cover"><i class="ic ic-cap"></i></div>
        <div class="ev-top">
            <span class="eyebrow">${esc(categoria)}</span>
            <span class="badge ${badgeClasse}">${esc(rotuloStatus)}</span>
        </div>
        <h2 class="ev-title">${esc(ev.nome)}</h2>
        <p class="ev-desc">${esc(ev.descricao || 'Sem descrição cadastrada.')}</p>
        <ul class="meta">
            <li><i class="ic ic-cal"></i>${esc(dataCurta(ev.data))}</li>
            <li><i class="ic ic-clock"></i>${esc(horaInicioFmt)} às ${esc(horaFimFmt)}</li>
            <li><i class="ic ${iconeLocal}"></i>${localTexto}</li>
        </ul>
        <div class="ev-foot">
            <span class="price ${ev.e_gratuito ? 'free' : ''}">${esc(precoFmt)}</span>
            <span class="small muted">${vagasTexto}</span>
        </div>
    </a>`;
}
