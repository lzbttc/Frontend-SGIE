/* SGIE — index.js (tela Explorar Eventos) */

let abaAtual = 'todos';

const $ = (id) => document.getElementById(id);

const TEMAS_CATEGORIA = {
    'Congresso': ['amber', 'atom'], 'Feira': ['amber', 'atom'], 'Workshop': ['amber', 'atom'],
    'Oficina': ['amber', 'atom'], 'Competição': ['amber', 'star'], 'Festival': ['amber', 'star'],
    'Lançamento de Produto': ['amber', 'star'],
    'Curso': ['green', 'book'], 'Mini-curso': ['green', 'book'], 'Treinamento': ['green', 'book'],
    'Roda de Conversa': ['green', 'book'],
};

const DECORACOES = {
    globe: '<circle cx="50" cy="50" r="46"/><ellipse cx="50" cy="50" rx="20" ry="46"/><ellipse cx="50" cy="50" rx="46" ry="20"/><path d="M50 4v92M4 50h92"/>',
    atom: '<ellipse cx="50" cy="50" rx="46" ry="17"/><ellipse cx="50" cy="50" rx="46" ry="17" transform="rotate(60 50 50)"/><ellipse cx="50" cy="50" rx="46" ry="17" transform="rotate(120 50 50)"/><circle cx="50" cy="50" r="6" fill="currentColor"/>',
    book: '<path d="M50 24C38 14 20 14 6 20v64c14-6 32-6 44 4 12-10 30-10 44-4V20c-14-6-32-6-44 4zM50 24v64"/>',
    star: '<path d="m50 6 13 28 30 4-22 21 6 30-27-15-27 15 6-30L7 38l30-4z"/>',
};

const ESTADOS_STATUS = {
    'Inscrições abertas': '', 'Publicado': '', 'Em realização': 'st-warn',
    'Finalizado': 'st-neutral', 'Arquivado': 'st-neutral', 'Rascunho': 'st-warn',
    'Configuração': 'st-warn', 'Cancelado': 'st-danger',
};

function esc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

function dataCurta(dataIso) {
    const [a, m, d] = String(dataIso || '').split('T')[0].split('-').map(Number);
    if (!a) return '—';
    return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function usuarioEhStaff(user) {
    return Boolean(user && (user.acesso_admin || user.superusuario));
}

/* ---------- Inicialização ---------- */

document.addEventListener('DOMContentLoaded', () => {
    atualizarCabecalhoUsuario('eventos');

    if (getUser() && isAuthenticated()) {
        $('tabs-nav').hidden = false;
        atualizarContadorMeusEventos();

        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        if (tabParam === 'meus' || tabParam === 'meus-eventos') {
            alternarAba('meus-eventos');
            return;
        }
    }

    $('tab-todos').addEventListener('click', () => alternarAba('todos'));
    $('tab-meus-eventos').addEventListener('click', () => alternarAba('meus-eventos'));
    $('btn-aplicar-filtros').addEventListener('click', carregarEventos);
    $('btn-limpar-filtros').addEventListener('click', () => {
        ['filtro-busca', 'filtro-categoria', 'filtro-modalidade', 'filtro-preco'].forEach((id) => { $(id).value = ''; });
        carregarEventos();
    });
    $('filtro-busca').addEventListener('keyup', (e) => { if (e.key === 'Enter') carregarEventos(); });
    ['filtro-categoria', 'filtro-modalidade', 'filtro-preco'].forEach((id) => $(id).addEventListener('change', carregarEventos));

    carregarEventos();
});

function alternarAba(aba) {
    abaAtual = aba;
    $('tab-todos').classList.toggle('active', aba === 'todos');
    $('tab-meus-eventos').classList.toggle('active', aba === 'meus-eventos');
    $('toolbar-filtros').hidden = aba !== 'todos';
    carregarEventos();
}

async function atualizarContadorMeusEventos() {
    try {
        const resp = await apiFetch('/eventos/meus-eventos/');
        if (resp.ok) $('badge-total-meus').textContent = (await resp.json()).length;
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
        const filtros = { search: $('filtro-busca').value.trim(), categoria: $('filtro-categoria').value,
            modalidade: $('filtro-modalidade').value, e_gratuito: $('filtro-preco').value };
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
        const eventos = Array.isArray(dados) ? dados : (dados.results || []);
        if (abaAtual === 'meus-eventos') $('badge-total-meus').textContent = eventos.length;

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
    const user = getUser();
    const logado = Boolean(user && isAuthenticated());
    $('grid-eventos').innerHTML = eventos.map((ev) => htmlCard(ev, user, logado)).join('');
}

function htmlCard(ev, user, logado) {
    const temVagas = Number.isFinite(ev.vagas_disponiveis);
    const esgotado = temVagas && ev.vagas_disponiveis <= 0 && ev.status !== 'Finalizado' && ev.status !== 'Cancelado';

    let badgeClasse = 'badge-neutral';
    let rotuloStatus = ev.status_display || ev.status || 'Publicado';

    if (esgotado) {
        badgeClasse = 'badge-warning';
        rotuloStatus = 'Vagas esgotadas';
    } else if (ev.status === 'Inscrições abertas') {
        badgeClasse = 'badge-success';
    } else if (ev.status === 'Publicado') {
        badgeClasse = 'badge-info';
    } else if (ev.status === 'Em andamento') {
        badgeClasse = 'badge-info';
    } else if (ev.status === 'Cancelado') {
        badgeClasse = 'badge-danger';
    } else if (ev.status === 'Finalizado') {
        badgeClasse = 'badge-neutral';
    }

    const categoria = ev.categoria === 'Outro' && ev.categoria_personalizada ? ev.categoria_personalizada : (ev.categoria_display || ev.categoria || 'Evento');
    const detalhes = `eventos/detalhes-do-evento/index.html?id=${encodeURIComponent(ev.id)}`;

    const vagasTexto = !temVagas
        ? `${esc(ev.capacidade || 0)} vagas`
        : esgotado
            ? 'Lista de espera'
            : `${ev.vagas_disponiveis} vagas`;

    const iconeLocal = (ev.modalidade === 'On-line') ? 'ic-link' : (ev.modalidade === 'Híbrido' ? 'ic-repeat' : 'ic-pin');
    const localTexto = ev.modalidade === 'On-line' ? 'On-line' : (ev.local ? `${esc(ev.local)} · ${esc(ev.modalidade || 'Presencial')}` : esc(ev.modalidade || 'Presencial'));

    const tomAmber = (ev.categoria === 'Workshop' || ev.categoria === 'Mini-curso' || ev.categoria === 'Feira');

    return `
    <a class="ev" href="${detalhes}">
        <div aria-hidden="true" class="ev-cover ${tomAmber ? 'tone-amber' : ''}"><i class="ic ic-cap"></i></div>
        <div class="ev-top">
            <span class="eyebrow">${esc(categoria)}</span>
            <span class="badge ${badgeClasse}">${esc(rotuloStatus)}</span>
        </div>
        <h2 class="ev-title">${esc(ev.nome)}</h2>
        <p class="ev-desc">${esc(ev.descricao || 'Sem descrição cadastrada.')}</p>
        <ul class="meta">
            <li><i class="ic ic-cal"></i>${esc(dataCurta(ev.data))}</li>
            <li><i class="ic ic-clock"></i>${esc(formatarHora(ev.hora_inicio))} às ${esc(formatarHora(ev.hora_fim))}</li>
            <li><i class="ic ${iconeLocal}"></i>${localTexto}</li>
        </ul>
        <div class="ev-foot">
            <span class="price ${ev.e_gratuito ? 'free' : ''}">${ev.e_gratuito ? 'Gratuito' : esc(formatarMoeda(ev.preco))}</span>
            <span class="small muted">${vagasTexto}</span>
        </div>
    </a>`;
}
