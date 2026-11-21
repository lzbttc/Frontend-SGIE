let html5QrCode = null;
let cameraAtiva = false;
let participanteAtual = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!isAuthenticated()) {
        window.location.href = resolveAppUrl('usuarios/login/login.html');
        return;
    }

    atualizarCabecalhoUsuario('credenciamento');

    const formBusca = document.getElementById('form-busca');
    const selectEvento = document.getElementById('select-evento');
    const inputQuery = document.getElementById('input-query');
    const btnToggleCamera = document.getElementById('btn-toggle-camera');

    if (formBusca) {
        formBusca.addEventListener('submit', (e) => {
            e.preventDefault();
            const q = inputQuery ? inputQuery.value.trim() : '';
            if (q) realizarBusca(q);
        });
    }

    if (selectEvento) {
        selectEvento.addEventListener('change', () => {
            clearAlert('mensagem-alerta');
            const divResultado = document.getElementById('resultado-container');
            if (divResultado) divResultado.style.display = 'none';
            const listaSugestoes = document.getElementById('lista-sugestoes');
            if (listaSugestoes) listaSugestoes.innerHTML = '';
        });
    }

    if (btnToggleCamera) {
        btnToggleCamera.addEventListener('click', () => {
            if (!selectEvento || !selectEvento.value) {
                showAlert('mensagem-alerta', 'Por favor, selecione um evento antes de iniciar a câmera.', 'warning');
                return;
            }

            if (cameraAtiva) {
                pararCamera();
            } else {
                iniciarCamera();
            }
        });
    }

    carregarEventos();
});

async function carregarEventos() {
    const selectEvento = document.getElementById('select-evento');
    if (!selectEvento) return;

    const urlParams = new URLSearchParams(window.location.search);
    const eventoUrlId = urlParams.get('evento');

    try {
        const response = await apiFetch('/eventos/meus-eventos/');
        if (!response.ok) {
            showAlert('mensagem-alerta', 'Não foi possível carregar seus eventos para credenciamento.', 'danger');
            return;
        }

        const eventos = await response.json();

        selectEvento.innerHTML = '<option value="">Selecione um evento para credenciar...</option>';

        eventos.forEach(ev => {
            const option = document.createElement('option');
            option.value = ev.id;
            option.textContent = `${ev.nome} (${formatarData(ev.data)})`;
            selectEvento.appendChild(option);
        });

        if (eventoUrlId && eventos.some(ev => String(ev.id) === String(eventoUrlId))) {
            selectEvento.value = eventoUrlId;
        } else if (eventos.length === 1) {
            selectEvento.value = eventos[0].id;
        }
    } catch (error) {
        showAlert('mensagem-alerta', 'Erro de conexão ao carregar eventos.', 'danger');
    }
}

async function realizarBusca(termo) {
    clearAlert('mensagem-alerta');
    const selectEvento = document.getElementById('select-evento');
    const eventoId = selectEvento ? selectEvento.value : '';

    if (!eventoId) {
        showAlert('mensagem-alerta', 'Por favor, selecione um evento primeiro.', 'warning');
        return;
    }

    // Se o termo contém padrão de código de ingresso SGIE-XXXX-YYYYYY, extrai o ID numérico final
    let queryFinal = termo.trim();
    const matchSgie = queryFinal.match(/SGIE-\d+-(\d+)/i);
    if (matchSgie && matchSgie[1]) {
        queryFinal = String(parseInt(matchSgie[1], 10));
    } else if (queryFinal.startsWith('#')) {
        queryFinal = queryFinal.replace(/^#+/, '');
    }

    try {
        const url = `/credenciamento/buscar/?evento_id=${encodeURIComponent(eventoId)}&query=${encodeURIComponent(queryFinal)}`;
        const response = await apiFetch(url);
        const data = await response.json().catch(() => ({}));

        const divResultado = document.getElementById('resultado-container');
        const listaSugestoes = document.getElementById('lista-sugestoes');

        if (response.ok && data.participantes && data.participantes.length > 0) {
            renderizarSugestoes(data.participantes);
            exibirParticipante(data.participantes[0]);
        } else {
            if (divResultado) divResultado.style.display = 'none';
            if (listaSugestoes) listaSugestoes.innerHTML = '';
            showAlert('mensagem-alerta', 'Nenhum participante encontrado com os dados informados.', 'warning');
        }
    } catch (err) {
        showAlert('mensagem-alerta', 'Erro ao conectar com o servidor.', 'danger');
    }
}

function renderizarSugestoes(participantes) {
    const listaSugestoes = document.getElementById('lista-sugestoes');
    if (!listaSugestoes) return;

    if (participantes.length <= 1) {
        listaSugestoes.innerHTML = '';
        return;
    }

    let itensHtml = '';
    participantes.forEach((p, idx) => {
        const nome = p.usuario_nome || 'Participante';
        const partes = nome.trim().split(/\s+/);
        const iniciais = partes.length > 1
            ? (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
            : (partes[0] ? partes[0].slice(0, 2).toUpperCase() : 'SG');

        itensHtml += `
            <div class="credenciamento__suggestion-item-${idx === 0 ? '1-selected' : '2'}" onclick="selecionarParticipante(${idx})" style="cursor: pointer; margin-bottom: 8px;">
                <div class="credenciamento__container-30">
                    <div class="credenciamento__background-4"><p class="credenciamento__text-12">${iniciais}</p></div>
                    <div class="credenciamento__container-31">
                        <div class="credenciamento__container-32">
                            <p class="credenciamento__text-13">${nome}</p>
                        </div>
                        <div class="credenciamento__container-33">
                            <p class="credenciamento__text-14">#${p.id} • ${p.usuario_email}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    listaSugestoes.innerHTML = `
        <div style="margin-top: 16px;">
            <p style="font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 8px;">Resultados encontrados (${participantes.length})</p>
            ${itensHtml}
        </div>
    `;

    window.__participantesCache = participantes;
}

function selecionarParticipante(idx) {
    if (window.__participantesCache && window.__participantesCache[idx]) {
        exibirParticipante(window.__participantesCache[idx]);
    }
}

function exibirParticipante(p) {
    participanteAtual = p;
    const divResultado = document.getElementById('resultado-container');
    if (!divResultado) return;

    const nome = p.usuario_nome || p.usuario_email || 'Participante';
    const partes = nome.trim().split(/\s+/);
    const iniciais = partes.length > 1
        ? (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
        : (partes[0] ? partes[0].slice(0, 2).toUpperCase() : 'SG');

    const statusNorm = String(p.status).toUpperCase();
    const jaCredenciado = Boolean(p.presenca_registrada);

    let statusTexto = 'Inscrição Confirmada';
    let statusBadge = 'badge-success';
    let acaoHtml = '';

    if (jaCredenciado) {
        statusTexto = 'Presença Já Registrada';
        statusBadge = 'badge-info';
        acaoHtml = `
            <div class="alert alert-info" style="width: 100%;">
                <div>
                    <b>Presença Registrada</b>
                    <p style="margin-top: 2px;">Este participante já realizou o credenciamento para este evento.</p>
                </div>
            </div>
        `;
    } else if (statusNorm === 'CONFIRMADA') {
        statusTexto = 'Inscrição Confirmada (Apto)';
        statusBadge = 'badge-success';
        acaoHtml = `
            <button type="button" class="btn btn-primary btn-lg" onclick="confirmarPresenca(${p.id})" style="width: 100%; min-height: 48px;">
                <i class="ic ic-check"></i>Confirmar Presença e Liberar Entrada
            </button>
        `;
    } else {
        statusTexto = `Inscrição ${p.status} (Não Apta)`;
        statusBadge = 'badge-danger';
        acaoHtml = `
            <div class="alert alert-danger" style="width: 100%;">
                <div>
                    <b>Inscrição Não Regular</b>
                    <p style="margin-top: 2px;">Apenas participantes com inscrição confirmada podem ser credenciados.</p>
                </div>
            </div>
        `;
    }

    divResultado.innerHTML = `
        <div class="card-head">
            <div>
                <span class="eyebrow">Participante identificado</span>
                <h2 class="h2" style="margin-top: 4px;">${nome}</h2>
            </div>
            <span class="badge ${statusBadge}"><i class="ic ic-check"></i>${statusTexto}</span>
        </div>
        <div class="row" style="gap: 16px; margin: 16px 0; padding: 16px; background: var(--bg); border-radius: var(--r-md); border: 1px solid var(--line);">
            <span class="avatar lg">${iniciais}</span>
            <div class="grow">
                <b class="h3">${nome}</b>
                <p class="small muted" style="margin-top: 2px;">${p.usuario_email || 'E-mail não informado'}</p>
                <p class="small muted" style="margin-top: 2px;">Código da inscrição: <strong class="num">#${p.id}</strong></p>
            </div>
        </div>
        <div>
            ${acaoHtml}
        </div>
    `;

    divResultado.style.display = 'block';
    divResultado.scrollIntoView({ behavior: 'smooth' });
}

async function confirmarPresenca(inscricaoId) {
    clearAlert('mensagem-alerta');
    try {
        const response = await apiFetch(`/credenciamento/${inscricaoId}/confirmar/`, {
            method: 'POST'
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok) {
            showAlert('mensagem-alerta', data.success || 'Presença confirmada e credenciamento registrado com sucesso!', 'success');
            if (participanteAtual && participanteAtual.id === inscricaoId) {
                participanteAtual.presenca_registrada = true;
                exibirParticipante(participanteAtual);
            }
        } else {
            showAlert('mensagem-alerta', data.error || data.warning || 'Não foi possível confirmar a presença.', 'danger');
        }
    } catch (err) {
        showAlert('mensagem-alerta', 'Erro de conexão com o servidor do SGIE.', 'danger');
    }
}

function iniciarCamera() {
    const statusCamera = document.getElementById('status-camera');
    const btnToggle = document.getElementById('btn-toggle-camera');

    if (typeof Html5Qrcode === 'undefined') {
        showAlert('mensagem-alerta', 'Biblioteca leitora de QR Code indisponível.', 'danger');
        return;
    }

    try {
        html5QrCode = new Html5Qrcode('reader');
        html5QrCode.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            (decodedText) => {
                pararCamera();
                if (statusCamera) statusCamera.textContent = `Código detectado: ${decodedText}`;
                realizarBusca(decodedText);
            },
            () => {
                // Leitura contínua
            }
        ).then(() => {
            cameraAtiva = true;
            if (btnToggle) btnToggle.textContent = 'Parar Câmera';
            if (statusCamera) statusCamera.textContent = 'Câmera ativa • Aponte para o QR Code';
        }).catch(() => {
            cameraAtiva = false;
            showAlert('mensagem-alerta', 'Não foi possível acessar a câmera do dispositivo.', 'warning');
            if (statusCamera) statusCamera.textContent = 'Câmera desativada ou sem permissão';
        });
    } catch (e) {
        showAlert('mensagem-alerta', 'Erro ao inicializar câmera.', 'danger');
    }
}

function pararCamera() {
    const statusCamera = document.getElementById('status-camera');
    const btnToggle = document.getElementById('btn-toggle-camera');

    if (html5QrCode && cameraAtiva) {
        html5QrCode.stop().then(() => {
            cameraAtiva = false;
            if (btnToggle) btnToggle.textContent = 'Abrir Câmera';
            if (statusCamera) statusCamera.textContent = 'Câmera parada';
        }).catch(() => {
            cameraAtiva = false;
        });
    }
}
