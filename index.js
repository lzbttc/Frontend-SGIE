/* SGIE — index.js (tela Explorar Eventos) */

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

    // Alerta repassado por redirecionamento de tela restrita
    const alertaRedirect = sessionStorage.getItem('sgie_alerta_redirect');
    if (alertaRedirect) {
        sessionStorage.removeItem('sgie_alerta_redirect');
        try {
            const { mensagem, tipo } = JSON.parse(alertaRedirect);
            showAlert('mensagem-alerta', mensagem, tipo || 'danger');
        } catch { /* ignora */ }
    }

    // Registro de ouvintes
    const btnFiltrar = $('btn-aplicar-filtros');
    const btnLimpar = $('btn-limpar-filtros');
    const filtroBusca = $('filtro-busca');

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

    carregarEventos();
});

/* ---------- Carregamento ---------- */

async function carregarEventos() {
    clearAlert('mensagem-alerta');
    $('loading-spinner').hidden = false;
    $('grid-eventos').hidden = true;
    $('sem-eventos').hidden = true;

    const params = new URLSearchParams();
    const filtros = {
        search: $('filtro-busca')?.value?.trim() || '',
        categoria: $('filtro-categoria')?.value || '',
        modalidade: $('filtro-modalidade')?.value || '',
        e_gratuito: $('filtro-preco')?.value || ''
    };
    Object.entries(filtros).forEach(([k, v]) => { if (v) params.append(k, v); });
    const url = `/eventos/${params.toString() ? `?${params}` : ''}`;

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

        // Na aba Explorar, ocultar eventos com status Rascunho ou Configuração
        eventos = eventos.filter((ev) => ev.status !== 'Rascunho' && ev.status !== 'Configuração');

        if (!eventos.length) return mostrarVazio();
        renderizarEventos(eventos);
        $('grid-eventos').hidden = false;
    } catch {
        $('loading-spinner').hidden = true;
        showAlert('mensagem-alerta', 'Erro de conexão com o servidor do SGIE.', 'danger');
    }
}

function mostrarVazio() {
    $('titulo-vazio').textContent = 'Nenhum evento encontrado';
    $('desc-vazio').innerHTML = 'Tente ajustar os filtros aplicados.';
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
}

function htmlCard(ev, user, logado) {
    // A listagem da API não traz vagas_disponiveis (só o detalhe traz):
    // sem o dado real, o card mostra apenas a capacidade, sem simular vagas.
    const vagasDisponiveis = ev.vagas_disponiveis;

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
