let todosParticipantes = [];
let eventoSelecionadoId = null;

const STATUS_CONFIG_PARTICIPANTE = {
    confirmada: {
        texto: 'Confirmada',
        badgeClass: 'badge-success',
        icon: 'ic-check'
    },
    pendente_pagamento: {
        texto: 'Pendente de Pagamento',
        badgeClass: 'badge-warning',
        icon: 'ic-clock'
    },
    lista_espera: {
        texto: 'Lista de Espera',
        badgeClass: 'badge-info',
        icon: 'ic-info'
    },
    cancelada: {
        texto: 'Cancelada',
        badgeClass: 'badge-neutral',
        icon: 'ic-x'
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (!isAuthenticated()) {
        window.location.href = resolveAppUrl('usuarios/login/login.html');
        return;
    }

    atualizarCabecalhoUsuario('participantes');

    const selectEvento = document.getElementById('filtro-evento');
    if (selectEvento) {
        selectEvento.addEventListener('change', (e) => {
            eventoSelecionadoId = e.target.value || null;
            carregarParticipantes();
        });
    }

    const btnAplicar = document.getElementById('btn-aplicar-filtros');
    if (btnAplicar) btnAplicar.addEventListener('click', () => carregarParticipantes());

    const btnLimpar = document.getElementById('btn-limpar-filtros');
    if (btnLimpar) {
        btnLimpar.addEventListener('click', () => {
            const inputBusca = document.getElementById('filtro-busca');
            const selectStatus = document.getElementById('filtro-status');
            if (inputBusca) inputBusca.value = '';
            if (selectStatus) selectStatus.value = '';
            carregarParticipantes();
        });
    }

    const inputBusca = document.getElementById('filtro-busca');
    if (inputBusca) {
        inputBusca.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') carregarParticipantes();
        });
    }

    const selectStatus = document.getElementById('filtro-status');
    if (selectStatus) {
        selectStatus.addEventListener('change', () => carregarParticipantes());
    }

    const btnExportarCsv = document.getElementById('btn-exportar-csv');
    if (btnExportarCsv) {
        btnExportarCsv.addEventListener('click', () => exportarParaCsv());
    }

    carregarMeusEventos();
});

async function carregarMeusEventos() {
    const select = document.getElementById('filtro-evento');
    if (!select) return;

    const urlParams = new URLSearchParams(window.location.search);
    const eventoDaUrl = urlParams.get('evento');

    try {
        const response = await apiFetch('/eventos/meus-eventos/');
        if (!response.ok) {
            showAlert('mensagem-alerta', 'Não foi possível carregar a lista dos seus eventos.', 'danger');
            return;
        }

        const eventos = await response.json();
        if (eventos.length === 0) {
            select.innerHTML = '<option value="">Nenhum evento encontrado</option>';
            const semEv = document.getElementById('sem-participantes');
            if (semEv) {
                semEv.style.display = 'block';
                semEv.innerHTML = `
                    <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">Nenhum Evento Encontrado</h3>
                    <p style="font-size: 14px; color: #64748b; margin: 0;">Você ainda não possui eventos cadastrados para visualizar participantes.</p>
                `;
            }
            return;
        }

        select.innerHTML = '<option value="">Selecione um evento...</option>';

        eventos.forEach(ev => {
            const option = document.createElement('option');
            option.value = ev.id;
            option.textContent = `${ev.nome} (${formatarData(ev.data)})`;
            select.appendChild(option);
        });

        if (eventoDaUrl && eventos.some(ev => String(ev.id) === String(eventoDaUrl))) {
            select.value = eventoDaUrl;
            eventoSelecionadoId = eventoDaUrl;
            carregarParticipantes();
        } else if (eventos.length === 1) {
            select.value = eventos[0].id;
            eventoSelecionadoId = eventos[0].id;
            carregarParticipantes();
        } else {
            const semEv = document.getElementById('sem-participantes');
            if (semEv) {
                semEv.style.display = 'block';
                semEv.innerHTML = `
                    <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">Selecione um Evento</h3>
                    <p style="font-size: 14px; color: #64748b; margin: 0;">Selecione um dos seus eventos no filtro acima para visualizar a lista de inscritos.</p>
                `;
            }
        }
    } catch (error) {
        showAlert('mensagem-alerta', 'Erro de conexão com o servidor do SGIE.', 'danger');
    }
}

async function carregarParticipantes() {
    clearAlert('mensagem-alerta');
    const spinner = document.getElementById('loading-spinner');
    const lista = document.getElementById('lista-participantes');
    const vazio = document.getElementById('sem-participantes');
    const contador = document.getElementById('contador-participantes');

    if (!eventoSelecionadoId) {
        if (vazio) {
            vazio.style.display = 'block';
            const selectEvento = document.getElementById('filtro-evento');
            const semEventosCadastrados = selectEvento && selectEvento.options.length <= 1 && selectEvento.value === '' && selectEvento.options[0]?.text.includes('Nenhum evento');
            if (semEventosCadastrados) {
                vazio.innerHTML = `
                    <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">Nenhum Evento Encontrado</h3>
                    <p style="font-size: 14px; color: #64748b; margin: 0;">Você ainda não possui eventos cadastrados para visualizar participantes.</p>
                `;
            } else {
                vazio.innerHTML = `
                    <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">Selecione um Evento</h3>
                    <p style="font-size: 14px; color: #64748b; margin: 0;">Selecione um dos seus eventos no filtro acima para visualizar a lista de inscritos.</p>
                `;
            }
        }
        if (lista) lista.style.display = 'none';
        if (contador) contador.textContent = '0 participantes encontrados';
        return;
    }

    if (vazio) vazio.style.display = 'none';
    if (spinner) spinner.style.display = 'block';
    if (lista) lista.style.display = 'none';

    const params = new URLSearchParams();
    const busca = document.getElementById('filtro-busca') ? document.getElementById('filtro-busca').value.trim() : '';
    const statusFiltro = document.getElementById('filtro-status') ? document.getElementById('filtro-status').value : '';

    if (busca) params.append('busca', busca);
    if (statusFiltro) params.append('status', statusFiltro);

    const queryString = params.toString();
    const url = `/eventos/${eventoSelecionadoId}/inscritos/${queryString ? `?${queryString}` : ''}`;

    try {
        const response = await apiFetch(url);
        if (spinner) spinner.style.display = 'none';

        if (response.status === 403) {
            showAlert('mensagem-alerta', 'Você não tem permissão para consultar os participantes deste evento.', 'danger');
            return;
        }
        if (response.status === 404) {
            showAlert('mensagem-alerta', 'Evento não encontrado.', 'danger');
            return;
        }

        if (response.ok) {
            todosParticipantes = await response.json();

            // Atualiza contadores globais do evento
            atualizarContadoresParticipantes(todosParticipantes);

            if (contador) {
                contador.textContent = `${todosParticipantes.length} participante(s) encontrado(s)`;
            }

            if (!todosParticipantes || todosParticipantes.length === 0) {
                if (vazio) {
                    vazio.style.display = 'block';
                    vazio.innerHTML = `
                        <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">Nenhum participante encontrado</h3>
                        <p style="font-size: 14px; color: #64748b; margin: 0;">${busca || statusFiltro ? 'Tente ajustar os filtros informados.' : 'Quando alguém se inscrever neste evento, a inscrição aparecerá aqui.'}</p>
                    `;
                }
                if (lista) lista.style.display = 'none';
                return;
            }

            renderizarParticipantes(todosParticipantes);
            if (lista) lista.style.display = 'flex';
        } else {
            const err = await response.json().catch(() => ({}));
            showAlert('mensagem-alerta', err.detail || 'Não foi possível carregar os participantes.', 'danger');
        }
    } catch (error) {
        if (spinner) spinner.style.display = 'none';
        showAlert('mensagem-alerta', 'Erro de conexão com o servidor do SGIE.', 'danger');
    }
}

function atualizarContadoresParticipantes(participantes) {
    const counts = {
        confirmada: 0,
        pendente_pagamento: 0,
        lista_espera: 0,
        cancelada: 0
    };

    participantes.forEach(p => {
        if (counts[p.status] !== undefined) {
            counts[p.status]++;
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

function verificarPresencaRegistrada(p) {
    if (p.presenca_registrada) return true;
    if (p.dados_adicionais) {
        let dados = p.dados_adicionais;
        if (typeof dados === 'string') {
            try { dados = JSON.parse(dados); } catch {}
        }
        if (typeof dados === 'object' && dados !== null) {
            return Boolean(dados.presenca_registrada || dados.credenciado);
        }
    }
    return false;
}

function renderizarParticipantes(participantes) {
    const lista = document.getElementById('lista-participantes');
    if (!lista) return;

    lista.innerHTML = '';

    participantes.forEach(p => {
        const presencaConfirmada = verificarPresencaRegistrada(p);
        const cfg = STATUS_CONFIG_PARTICIPANTE[p.status] || {
            texto: p.status_display || p.status,
            badgeClass: 'badge-neutral',
            icon: 'ic-info'
        };

        const card = document.createElement('div');
        card.className = 'item';
        card.style.flexWrap = 'wrap';

        const nome = p.participante_nome || p.participante_email || 'Participante';
        const partes = nome.trim().split(/\s+/);
        const iniciais = partes.length > 1
            ? (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
            : (partes[0] ? partes[0].slice(0, 2).toUpperCase() : 'SG');

        const email = p.participante_email || 'E-mail não informado';
        const dataFmt = formatarDataHora(p.data_inscricao);
        const comprovanteUrl = p.comprovante ? obterUrlComprovanteSegura(p.comprovante) : null;

        const badgePresenca = presencaConfirmada
            ? `<span class="badge badge-success" style="font-size: 11px;"><i class="ic ic-check"></i>Credenciado</span>`
            : '';

        card.innerHTML = `
            <span class="avatar">${iniciais}</span>
            <div class="grow" style="min-width: 240px;">
                <div class="row" style="gap: 8px;">
                    <b class="h3">${nome}</b>
                    <span class="small muted num">#${p.id}</span>
                    ${badgePresenca}
                </div>
                <p class="small muted" style="margin-top: 2px;">${email} · Inscrito em ${dataFmt}</p>
                <div id="detalhes-participante-${p.id}" style="display: none; margin-top: 12px; padding: 12px; background-color: var(--bg); border: 1px solid var(--line); border-radius: var(--r-sm);">
                    <p class="small" style="margin: 0 0 4px 0;"><strong>Presença / Credenciamento:</strong> ${presencaConfirmada ? 'Presença confirmada' : 'Pendente de credenciamento'}</p>
                    <p class="small" style="margin: 0 0 4px 0;"><strong>Dados adicionais:</strong> ${formatarDadosAdicionais(p.dados_adicionais)}</p>
                    ${comprovanteUrl ? `<p class="small" style="margin: 0;"><a href="${comprovanteUrl}" target="_blank" rel="noopener noreferrer">Visualizar comprovante de vínculo</a></p>` : '<p class="small muted" style="margin: 0;">Nenhum comprovante anexado.</p>'}
                </div>
            </div>

            <div class="row" style="gap: 8px; align-items: center;">
                <span class="badge ${cfg.badgeClass}"><i class="ic ${cfg.icon}"></i>${p.status_display || cfg.texto}</span>
                <button type="button" class="btn btn-secondary btn-sm" onclick="alternarDetalhesParticipante(${p.id})">
                    <span id="rotulo-detalhes-p-${p.id}">Detalhes</span>
                </button>
            </div>
        `;

        lista.appendChild(card);
    });
}

function alternarDetalhesParticipante(id) {
    const el = document.getElementById(`detalhes-participante-${id}`);
    const rotulo = document.getElementById(`rotulo-detalhes-p-${id}`);
    if (!el) return;
    const visivel = el.style.display !== 'none';
    el.style.display = visivel ? 'none' : 'block';
    if (rotulo) rotulo.textContent = visivel ? 'Ver Detalhes' : 'Ocultar Detalhes';
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

function obterUrlComprovanteSegura(comprovante) {
    if (!comprovante) return null;
    try {
        const baseUrl = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : window.location.origin;
        const url = new URL(String(comprovante), `${baseUrl}/`);
        return url.href;
    } catch {
        return null;
    }
}

function exportarParaCsv() {
    if (!todosParticipantes || todosParticipantes.length === 0) {
        showAlert('mensagem-alerta', 'Não há participantes para exportar neste momento.', 'warning');
        return;
    }

    const cabecalhos = ['ID', 'Nome', 'E-mail', 'Status', 'Presença Registrada', 'Data Inscrição', 'Dados Adicionais'];
    const linhas = todosParticipantes.map(p => {
        const id = p.id;
        const nome = `"${(p.participante_nome || '').replace(/"/g, '""')}"`;
        const email = `"${(p.participante_email || '').replace(/"/g, '""')}"`;
        const status = `"${(p.status_display || p.status || '').replace(/"/g, '""')}"`;
        const presenca = `"${verificarPresencaRegistrada(p) ? 'Sim' : 'Não'}"`;
        const data = `"${(formatarDataHora(p.data_inscricao) || '').replace(/"/g, '""')}"`;
        const adicionais = `"${(formatarDadosAdicionais(p.dados_adicionais) || '').replace(/"/g, '""')}"`;
        return [id, nome, email, status, presenca, data, adicionais].join(';');
    });

    const conteudoCsv = [cabecalhos.join(';'), ...linhas].join('\r\n');
    const blob = new Blob(['\ufeff' + conteudoCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `participantes_evento_${eventoSelecionadoId || 'sgie'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
