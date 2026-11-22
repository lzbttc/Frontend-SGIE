let todasInscricoes = [];
let filtroStatusAtivo = '';

// STATUS_CONFIG removido — usar SGIE_FORMATTERS.formatarStatusInscricao (shared/formatters.js)

document.addEventListener('DOMContentLoaded', () => {
    if (!isAuthenticated()) {
        window.location.href = resolveAppUrl('usuarios/login/login.html');
        return;
    }

    atualizarCabecalhoUsuario('minhas-inscricoes');

    const btnAplicar = document.getElementById('btn-aplicar-filtros');
    if (btnAplicar) btnAplicar.addEventListener('click', () => aplicarFiltrosLocais());

    const btnLimpar = document.getElementById('btn-limpar-filtros');
    if (btnLimpar) btnLimpar.addEventListener('click', () => {
        const inputBusca = document.getElementById('filtro-busca');
        const selectStatus = document.getElementById('filtro-status');
        if (inputBusca) inputBusca.value = '';
        if (selectStatus) selectStatus.value = '';
        filtroStatusAtivo = '';
        renderizarInscricoes(todasInscricoes);
    });

    const inputBusca = document.getElementById('filtro-busca');
    if (inputBusca) {
        inputBusca.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') aplicarFiltrosLocais();
        });
    }

    const selectStatus = document.getElementById('filtro-status');
    if (selectStatus) {
        selectStatus.addEventListener('change', () => aplicarFiltrosLocais());
    }

    const btnFechar = document.getElementById('btn-fechar-ingresso');
    if (btnFechar) btnFechar.addEventListener('click', fecharIngresso);

    const overlay = document.getElementById('overlay-ingresso');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target.id === 'overlay-ingresso') fecharIngresso();
        });
    }

    // Vincula clique nos cards de contadores
    configurarCliquesStats();

    carregarInscricoes();
});

function configurarCliquesStats() {
    const cardConfirmadas = document.getElementById('card-stat-confirmadas');
    if (cardConfirmadas) cardConfirmadas.onclick = () => alternarFiltroPorStat('confirmada');

    const cardPendentes = document.getElementById('card-stat-pendentes');
    if (cardPendentes) cardPendentes.onclick = () => alternarFiltroPorStat('pendente_pagamento');

    const cardEspera = document.getElementById('card-stat-espera');
    if (cardEspera) cardEspera.onclick = () => alternarFiltroPorStat('lista_espera');

    const cardCanceladas = document.getElementById('card-stat-canceladas');
    if (cardCanceladas) cardCanceladas.onclick = () => alternarFiltroPorStat('cancelada');
}

function alternarFiltroPorStat(status) {
    const selectStatus = document.getElementById('filtro-status');
    if (filtroStatusAtivo === status) {
        filtroStatusAtivo = '';
        if (selectStatus) selectStatus.value = '';
    } else {
        filtroStatusAtivo = status;
        if (selectStatus) selectStatus.value = status;
    }
    aplicarFiltrosLocais();
}

async function carregarInscricoes() {
    clearAlert('mensagem-alerta');
    const spinner = document.getElementById('loading-spinner');
    const lista = document.getElementById('lista-inscricoes');
    const vazio = document.getElementById('sem-inscricoes');

    if (spinner) spinner.style.display = 'block';
    if (lista) lista.style.display = 'none';
    if (vazio) vazio.style.display = 'none';

    try {
        const response = await apiFetch('/inscricoes/minhas/');
        if (spinner) spinner.style.display = 'none';

        if (response.ok) {
            todasInscricoes = await response.json();
            atualizarContadores(todasInscricoes);
            renderizarInscricoes(todasInscricoes);
        } else {
            const err = await response.json().catch(() => ({}));
            showAlert('mensagem-alerta', err.detail || 'Não foi possível carregar suas inscrições.', 'danger');
        }
    } catch (error) {
        if (spinner) spinner.style.display = 'none';
        showAlert('mensagem-alerta', 'Erro de conexão com o servidor do SGIE.', 'danger');
    }
}

function atualizarContadores(inscricoes) {
    const counts = {
        confirmada: 0,
        pendente_pagamento: 0,
        lista_espera: 0,
        cancelada: 0
    };

    inscricoes.forEach(i => {
        if (counts[i.status] !== undefined) {
            counts[i.status]++;
        }
    });

    const elConf = document.getElementById('stat-confirmadas');
    if (elConf) elConf.textContent = counts.confirmada;

    const elPend = document.getElementById('stat-pendentes');
    if (elPend) elPend.textContent = counts.pendente_pagamento;

    const elEsp = document.getElementById('stat-lista-espera');
    if (elEsp) elEsp.textContent = counts.lista_espera;

    const elCanc = document.getElementById('stat-canceladas');
    if (elCanc) elCanc.textContent = counts.cancelada;
}

function aplicarFiltrosLocais() {
    const inputBusca = document.getElementById('filtro-busca');
    const selectStatus = document.getElementById('filtro-status');

    const termo = inputBusca ? inputBusca.value.trim().toLowerCase() : '';
    const status = selectStatus ? selectStatus.value : '';
    filtroStatusAtivo = status;

    const filtradas = todasInscricoes.filter(insc => {
        const matchStatus = !status || insc.status === status;
        const matchTermo = !termo ||
            (insc.evento_nome && insc.evento_nome.toLowerCase().includes(termo)) ||
            (insc.codigo_ingresso && insc.codigo_ingresso.toLowerCase().includes(termo)) ||
            (insc.evento_local && insc.evento_local.toLowerCase().includes(termo));
        return matchStatus && matchTermo;
    });

    renderizarInscricoes(filtradas, termo, status);
}

function renderizarInscricoes(inscricoes, busca = '', statusFiltro = '') {
    const lista = document.getElementById('lista-inscricoes');
    const vazio = document.getElementById('sem-inscricoes');

    if (!lista || !vazio) return;
    lista.innerHTML = '';

    if (!inscricoes || inscricoes.length === 0) {
        vazio.style.display = 'block';
        lista.style.display = 'none';

        const tituloVazio = document.getElementById('titulo-vazio');
        const descVazio = document.getElementById('desc-vazio');

        if (busca || statusFiltro) {
            if (tituloVazio) tituloVazio.textContent = 'Nenhuma inscrição encontrada para estes filtros';
            if (descVazio) descVazio.textContent = 'Tente redefinir a busca ou limpar os filtros aplicados.';
        } else {
            if (tituloVazio) tituloVazio.textContent = 'Você ainda não possui inscrições';
            if (descVazio) descVazio.innerHTML = `Explore os eventos acadêmicos disponíveis no SGIE na <a href="${resolveAppUrl('index.html')}" style="color: #006d41; font-weight: 700; text-decoration: underline;">página inicial</a>.`;
        }
        return;
    }

    vazio.style.display = 'none';
    lista.style.display = 'flex';

    inscricoes.forEach(insc => {
        const cfg = SGIE_FORMATTERS.formatarStatusInscricao(insc.status);

        const card = document.createElement('div');
        card.className = 'item';
        card.style.flexWrap = 'wrap';

        const codigoIngresso = insc.codigo_ingresso || `#SGIE-${insc.id}`;
        const dataFmt = formatarData(insc.evento_data);
        const horaFmt = formatarHora(insc.evento_hora_inicio);
        const local = insc.evento_local || 'Local a confirmar';

        // Extrai dia e mês para o datebox
        let mesAbrev = 'evt';
        let diaNum = '—';
        if (insc.evento_data) {
            try {
                const dataObj = new Date(insc.evento_data);
                if (!isNaN(dataObj.getTime())) {
                    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
                    mesAbrev = meses[dataObj.getUTCMonth()];
                    diaNum = String(dataObj.getUTCDate()).padStart(2, '0');
                }
            } catch {}
        }

        let badgeExtra = '';
        if (insc.status === 'lista_espera' && insc.posicao_lista_espera) {
            badgeExtra = `<p class="small" style="color: var(--primary-ink); font-weight: 700; margin-top: 4px;">Posição na fila: ${insc.posicao_lista_espera}º lugar</p>`;
        }

        let acoesHtml = '';
        if (insc.status === 'confirmada' && insc.codigo_ingresso) {
            acoesHtml += `
                <button type="button" class="btn btn-primary btn-sm" onclick="abrirIngresso(${insc.id})">
                    <i class="ic ic-ticket"></i>Ver Ingresso
                </button>
            `;
        }

        if (insc.pode_cancelar) {
            const rotuloCancelar = insc.status === 'lista_espera' ? 'Desistir da Fila' : 'Cancelar Inscrição';
            acoesHtml += `
                <button type="button" class="btn btn-danger-outline btn-sm" onclick="cancelarInscricao(${insc.id})">
                    <i class="ic ic-x"></i>${rotuloCancelar}
                </button>
            `;
        }

        acoesHtml += `
            <button type="button" class="btn btn-secondary btn-sm" onclick="alternarDetalhes(${insc.id})">
                <span id="rotulo-detalhes-${insc.id}">Detalhes</span>
            </button>
        `;

        card.innerHTML = `
            <div class="datebox"><small>${mesAbrev}</small>${diaNum}</div>
            <div class="grow" style="min-width: 240px;">
                <b class="h3">${insc.evento_nome}</b>
                <p class="small muted" style="margin-top: 2px;">${local} · ${dataFmt} às ${horaFmt} · ${codigoIngresso}</p>
                ${badgeExtra}
                <div id="detalhes-${insc.id}" style="display: none; margin-top: 12px; padding: 12px; background-color: var(--bg); border: 1px solid var(--line); border-radius: var(--r-sm);">
                    <p class="small" style="margin: 0 0 4px 0;"><strong>Data da inscrição:</strong> ${formatarDataHora(insc.data_inscricao)}</p>
                    <p class="small" style="margin: 0 0 4px 0;"><strong>Valor:</strong> ${insc.evento_e_gratuito ? 'Gratuito' : formatarMoeda(insc.evento_preco)}</p>
                    <p class="small" style="margin: 0 0 4px 0;"><strong>Dados adicionais:</strong> ${formatarDadosAdicionais(insc.dados_adicionais)}</p>
                    ${insc.comprovante ? `<p class="small" style="margin: 0;"><a href="${insc.comprovante}" target="_blank" rel="noopener noreferrer">Visualizar comprovante enviado</a></p>` : ''}
                </div>
            </div>
            <div class="row" style="gap: 8px; align-items: center;">
                <span class="badge ${cfg.badgeClass}"><i class="ic ${cfg.icon}"></i>${insc.status_display || cfg.label}</span>
                ${acoesHtml}
            </div>
        `;

        lista.appendChild(card);
    });
}

function formatarDadosAdicionais(dados) {
    if (!dados) return 'Nenhum';
    if (typeof dados === 'string') {
        try {
            const parsed = JSON.parse(dados);
            return formatarDadosAdicionais(parsed);
        } catch {
            return dados.trim() || 'Nenhum';
        }
    }
    if (typeof dados === 'object') {
        const entradas = Object.entries(dados).filter(([, v]) => v !== null && v !== undefined && v !== '');
        if (entradas.length === 0) return 'Nenhum';
        return entradas.map(([campo, valor]) => `${campo}: ${valor}`).join(' · ');
    }
    return String(dados);
}

function alternarDetalhes(id) {
    const el = document.getElementById(`detalhes-${id}`);
    const rotulo = document.getElementById(`rotulo-detalhes-${id}`);
    if (!el) return;
    const estaVisivel = el.style.display !== 'none';
    el.style.display = estaVisivel ? 'none' : 'block';
    if (rotulo) rotulo.textContent = estaVisivel ? 'Ver Detalhes' : 'Ocultar Detalhes';
}

async function cancelarInscricao(id) {
    const insc = todasInscricoes.find(i => i.id === id);
    const mensagem = insc && insc.status === 'lista_espera'
        ? 'Deseja realmente desistir da lista de espera deste evento?'
        : 'Deseja realmente cancelar esta inscrição? Esta ação liberará a vaga para outros participantes.';

    if (!window.confirm(mensagem)) return;

    try {
        const res = await apiFetch(`/inscricoes/${id}/`, { method: 'DELETE' });

        if (res.ok || res.status === 204) {
            showAlert('mensagem-alerta', 'Inscrição cancelada com sucesso.', 'success');
            carregarInscricoes();
        } else {
            const err = await res.json().catch(() => ({}));
            showAlert('mensagem-alerta', err.detail || 'Não foi possível cancelar a inscrição.', 'danger');
        }
    } catch (error) {
        showAlert('mensagem-alerta', 'Erro de comunicação ao cancelar inscrição.', 'danger');
    }
}

function abrirIngresso(id) {
    const insc = todasInscricoes.find(i => i.id === id);
    if (!insc || !insc.codigo_ingresso) return;

    const user = getUser();
    const nomeParticipante = user ? (user.nome_completo || user.email) : 'Participante';
    const qrData = encodeURIComponent(insc.codigo_ingresso);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`;

    const conteudo = document.getElementById('conteudo-ingresso');
    if (!conteudo) return;

    conteudo.innerHTML = `
        <div class="ticket-top">
            <p class="eyebrow" style="color: var(--primary-ink);">Ingresso digital oficial</p>
            <h2 class="h3" style="margin-top: 6px;">${insc.evento_nome}</h2>
            <ul class="meta" style="margin-top: 12px;">
                <li><i class="ic ic-cal"></i>${formatarData(insc.evento_data)}, ${formatarHora(insc.evento_hora_inicio)}</li>
                <li><i class="ic ic-pin"></i>${insc.evento_local || 'Local a confirmar'}</li>
            </ul>
        </div>
        <div class="ticket-body">
            <div aria-label="QR Code da inscrição ${insc.codigo_ingresso}" class="qr" role="img" style="margin: 0 auto; text-align: center;">
                <img src="${qrUrl}" alt="QR Code do ingresso" style="width: 160px; height: 160px; display: block; margin: 0 auto; border-radius: 8px; border: 1px solid var(--line);">
            </div>
            <b class="num" style="font-size: 18px;">${insc.codigo_ingresso}</b>
            <p class="small muted" style="text-align: center;">${nomeParticipante} · apresente na entrada do evento</p>
            <span class="badge badge-success"><i class="ic ic-check"></i>Confirmada</span>
            <div class="row" style="gap: 12px; margin-top: 8px;">
                <button type="button" class="btn btn-primary btn-sm" onclick="window.print()"><i class="ic ic-download"></i>Imprimir</button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="fecharIngresso()">Fechar</button>
            </div>
        </div>
    `;

    const overlay = document.getElementById('overlay-ingresso');
    if (overlay) overlay.style.display = 'flex';
}

function fecharIngresso() {
    const overlay = document.getElementById('overlay-ingresso');
    if (overlay) overlay.style.display = 'none';
}
