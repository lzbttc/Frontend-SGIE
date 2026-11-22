/* ==========================================================================
   SGIE — Detalhes do Evento (detalhes_do_evento.js)
   Regras do BLOCO 1 (1.1, 1.2, 1.3, 1.4, 1.7 e Regras Gerais)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    atualizarCabecalhoUsuario('eventos');

    const params = new URLSearchParams(window.location.search);
    const eventoId = params.get('id');

    if (!eventoId) {
        mostrarErro('Nenhum evento especificado na URL.');
        return;
    }

    carregarDetalhesEvento(eventoId);
});

function esc(str) {
    if (typeof window.escapeHTML === 'function') {
        return window.escapeHTML(str);
    }
    return String(str ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

function formatarDataIso(dataIso) {
    if (!dataIso) return '—';
    const partes = String(dataIso).split('T')[0].split('-');
    if (partes.length < 3) return dataIso;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function dataHoraLegivel(dtString) {
    if (!dtString) return 'Data não definida';
    try {
        const d = new Date(dtString);
        if (isNaN(d.getTime())) return dtString;
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return dtString;
    }
}

function obterIniciais(nome) {
    if (!nome) return 'SG';
    const partes = String(nome).trim().split(/\s+/);
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

async function carregarDetalhesEvento(id) {
    clearAlert('mensagem-alerta');
    try {
        const resp = await apiFetch(`/eventos/${id}/`);
        if (!resp.ok) {
            if (resp.status === 404) {
                mostrarErro('O evento solicitado não foi encontrado ou não está mais disponível.');
            } else if (resp.status === 403) {
                mostrarErro('Você não possui autorização para visualizar este evento.');
            } else {
                mostrarErro('Falha ao carregar as informações do evento.');
            }
            return;
        }

        const evento = await resp.json();
        renderizarPaginaEvento(evento);
    } catch (err) {
        console.error('Erro ao buscar detalhes do evento:', err);
        mostrarErro('Erro de conexão com o servidor do SGIE.');
    }
}

function mostrarErro(mensagem) {
    const alerta = document.getElementById('mensagem-alerta');
    if (alerta) {
        alerta.className = 'alert alert-danger';
        alerta.innerHTML = `<strong>Atenção:</strong> ${esc(mensagem)} <br><br><a href="../../index.html" class="btn btn-secondary btn-sm" style="margin-top: 8px;">← Voltar para Explorar Eventos</a>`;
        alerta.style.display = 'block';
    }
    const mainContent = document.querySelector('.detalhes-do-evento__main');
    if (mainContent) {
        const secoes = mainContent.querySelectorAll('section, .with-side');
        secoes.forEach(s => { s.style.display = 'none'; });
    }
}

function renderizarPaginaEvento(ev) {
    // 1.7: Gestão do evento centralizada em SGIE_ROLES
    const ehGestor = window.SGIE_ROLES && typeof window.SGIE_ROLES.podeGerenciarEvento === 'function'
        ? window.SGIE_ROLES.podeGerenciarEvento(ev)
        : false;

    // 1. Título da Página e Breadcrumb (1.3)
    document.title = `${ev.nome || 'Evento'} — SGIE`;
    const elCrumb = document.getElementById('detalhe-crumb-nome');
    if (elCrumb) elCrumb.textContent = ev.nome || 'Detalhes do evento';

    // 2. Hero Badges
    const badgeStatus = document.getElementById('detalhe-status');
    if (badgeStatus) badgeStatus.textContent = (ev.status_display || ev.status || 'Publicado').toUpperCase();

    const badgeCategoria = document.getElementById('detalhe-categoria');
    if (badgeCategoria) badgeCategoria.textContent = ev.categoria_display || ev.categoria || 'Evento';

    const badgeModalidade = document.getElementById('detalhe-modalidade');
    if (badgeModalidade) badgeModalidade.textContent = ev.modalidade_display || ev.modalidade || 'Presencial';

    const badgeVisibilidade = document.getElementById('detalhe-visibilidade');
    if (badgeVisibilidade) badgeVisibilidade.textContent = ev.visibilidade ? `${ev.visibilidade} (Catálogo)` : 'Público';

    // 1.2: Preço (badge)
    const badgePreco = document.getElementById('detalhe-preco');
    const precoFormatado = ev.preco ? (typeof formatarMoeda === 'function' ? formatarMoeda(ev.preco) : `R$ ${Number(ev.preco).toFixed(2).replace('.', ',')}`) : 'R$ 0,00';
    if (badgePreco) {
        badgePreco.textContent = ev.e_gratuito ? 'Gratuito' : precoFormatado;
    }

    // 3. Título e Coordenação (1.3: Não apagar #detalhe-responsavel e #detalhe-email)
    const elNome = document.getElementById('detalhe-nome');
    if (elNome) elNome.textContent = ev.nome;

    const elResponsavel = document.getElementById('detalhe-responsavel');
    if (elResponsavel) {
        elResponsavel.textContent = ev.usuario_representante_nome || 'Coordenação';
    }

    const elEmail = document.getElementById('detalhe-email');
    const elEmailSep = document.getElementById('detalhe-email-sep');
    if (elEmail) {
        if (ev.usuario_representante_email) {
            elEmail.textContent = ev.usuario_representante_email;
            elEmail.href = `mailto:${ev.usuario_representante_email}`;
            elEmail.style.display = 'inline';
            if (elEmailSep) elEmailSep.style.display = 'inline';
        } else {
            elEmail.style.display = 'none';
            if (elEmailSep) elEmailSep.style.display = 'none';
        }
    }

    // 4. Painel de Gestão vs. Card de Inscrição (1.1)
    const painelGestao = document.getElementById('painel-gestao-organizador');
    const cardInscricao = document.getElementById('card-inscricao-sidebar');

    // Dados de vagas (reais ou calculados de forma defensiva)
    const totalVagas = Number(ev.capacidade) || 1;
    let ocupadas = typeof ev.vagas_ocupadas === 'number' ? ev.vagas_ocupadas : 0;
    let disponiveis = typeof ev.vagas_disponiveis === 'number' ? ev.vagas_disponiveis : Math.max(0, totalVagas - ocupadas);

    const taxaOcupacao = Math.min(100, Math.round((ocupadas / totalVagas) * 100));

    if (ehGestor) {
        // Para quem gerencia o evento: mostrar painel de gestão e ocultar card de inscrição
        if (painelGestao) painelGestao.style.display = 'flex';
        if (cardInscricao) cardInscricao.style.display = 'none';

        const txtTaxa = document.getElementById('painel-taxa-ocupacao');
        if (txtTaxa) txtTaxa.textContent = `${taxaOcupacao}% Ocupado`;

        const txtVagas = document.getElementById('painel-vagas-descricao');
        if (txtVagas) {
            txtVagas.textContent = `Inscrições: ${ocupadas} preenchidas de ${totalVagas} vagas (${taxaOcupacao}%).`;
        }

        const btnEditar = document.getElementById('btn-editar-evento');
        if (btnEditar) {
            btnEditar.onclick = () => {
                window.location.href = `../editar-evento/index.html?id=${encodeURIComponent(ev.id)}`;
            };
        }

        const btnCancelar = document.getElementById('btn-cancelar-evento');
        if (btnCancelar) {
            if (ev.status === 'Cancelado' || ev.status === 'Finalizado') {
                btnCancelar.style.display = 'none';
            } else {
                btnCancelar.style.display = 'inline-flex';
                btnCancelar.onclick = () => confirmarCancelamento(ev.id);
            }
        }

        const btnFinalizar = document.getElementById('btn-finalizar-evento');
        const txtBtnFinalizar = document.getElementById('txt-btn-finalizar');
        if (btnFinalizar && txtBtnFinalizar) {
            if (ev.status === 'Configuração' || ev.status === 'Rascunho') {
                txtBtnFinalizar.textContent = 'Publicar Evento';
                btnFinalizar.onclick = () => mudarStatusEvento(ev.id, 'publicar');
                btnFinalizar.style.display = 'inline-flex';
            } else if (ev.status === 'Publicado') {
                txtBtnFinalizar.textContent = 'Abrir Inscrições';
                btnFinalizar.onclick = () => mudarStatusEvento(ev.id, 'abrir-inscricoes');
                btnFinalizar.style.display = 'inline-flex';
            } else if (ev.status === 'Inscrições abertas' || ev.status === 'Em realização') {
                txtBtnFinalizar.textContent = 'Finalizar Evento';
                btnFinalizar.onclick = () => mudarStatusEvento(ev.id, 'finalizar');
                btnFinalizar.style.display = 'inline-flex';
            } else if (ev.status === 'Finalizado') {
                txtBtnFinalizar.textContent = 'Arquivar Evento';
                btnFinalizar.onclick = () => mudarStatusEvento(ev.id, 'arquivar');
                btnFinalizar.style.display = 'inline-flex';
            } else {
                btnFinalizar.style.display = 'none';
            }
        }

        const btnParticipantes = document.getElementById('btn-consultar-participantes');
        if (btnParticipantes) {
            btnParticipantes.onclick = () => {
                window.location.href = `../../inscricao/consulta-de-participantes/index.html?evento=${encodeURIComponent(ev.id)}`;
            };
        }

        const btnCredenciamento = document.getElementById('btn-credenciamento-evento');
        if (btnCredenciamento) {
            btnCredenciamento.onclick = () => {
                window.location.href = `../../inscricao/credenciamento/index.html?evento=${encodeURIComponent(ev.id)}`;
            };
        }

        const btnSubmissoes = document.getElementById('btn-submissoes-evento');
        if (btnSubmissoes) {
            btnSubmissoes.onclick = () => {
                window.location.href = `../../eventos/gestao-submissoes/index.html?evento=${encodeURIComponent(ev.id)}`;
            };
        }

    } else {
        // Participante / Visitante (1.1 e 1.2)
        if (painelGestao) painelGestao.style.display = 'none';
        if (cardInscricao) cardInscricao.style.display = 'flex';

        // 1.2: Preço na sidebar
        const elSidePreco = document.getElementById('sidebar-preco-display');
        const elSideInfo = document.getElementById('sidebar-info-adicional');

        if (elSidePreco) {
            if (ev.e_gratuito) {
                elSidePreco.textContent = 'Gratuito';
                elSidePreco.className = 'price free';
            } else {
                elSidePreco.textContent = precoFormatado;
                elSidePreco.className = 'price';
            }
        }

        // 1.1: Botão de Inscrição <a>
        const btnInscrever = document.getElementById('btn-realizar-inscricao');
        const urlInscricao = `../../inscricao/realizar-inscricao/index.html?evento=${encodeURIComponent(ev.id)}`;

        if (btnInscrever) {
            // Habilitar quando ev.inscricoes_abertas === true
            if (ev.inscricoes_abertas === true) {
                if (disponiveis === 0) {
                    btnInscrever.textContent = 'Entrar na lista de espera';
                    btnInscrever.className = 'btn btn-secondary';
                    btnInscrever.href = urlInscricao;
                    btnInscrever.removeAttribute('disabled');
                    btnInscrever.removeAttribute('aria-disabled');
                    if (elSideInfo) {
                        elSideInfo.textContent = 'Capacidade atingida. Você entrará na fila de espera com prioridade de liberação.';
                    }
                } else {
                    btnInscrever.textContent = 'Realizar Inscrição no Evento';
                    btnInscrever.className = 'btn btn-primary';
                    btnInscrever.href = urlInscricao;
                    btnInscrever.removeAttribute('disabled');
                    btnInscrever.removeAttribute('aria-disabled');
                    if (elSideInfo) {
                        elSideInfo.textContent = ev.e_gratuito
                            ? 'Sem custo. Confirmação imediata enquanto houver vagas.'
                            : 'Pagamento via Pix, Cartão ou Boleto. Confirmação após quitação.';
                    }
                }
            } else {
                // Inscrições fechadas
                let motivo = 'Inscrições encerradas';
                if (ev.status === 'Cancelado') motivo = 'Evento cancelado';
                else if (ev.status === 'Rascunho' || ev.status === 'Configuração') motivo = 'Inscrições em breve';
                else if (ev.status === 'Finalizado' || ev.status === 'Arquivado') motivo = 'Inscrições encerradas';

                btnInscrever.textContent = motivo;
                btnInscrever.className = 'btn btn-disabled';
                btnInscrever.removeAttribute('href');
                btnInscrever.setAttribute('aria-disabled', 'true');
                if (elSideInfo) {
                    elSideInfo.textContent = 'As inscrições para este evento não estão disponíveis no momento.';
                }
            }
        }
    }

    // 5. Descrição do Evento
    const elDescricao = document.getElementById('detalhe-descricao');
    if (elDescricao) {
        elDescricao.textContent = ev.descricao || 'Sem descrição cadastrada.';
    }

    // 6. Submissão de Trabalhos (1.4)
    const secaoSubmissao = document.getElementById('secao-submissao');
    const btnSubmeterLink = document.getElementById('btn-submeter-trabalho-link');
    const txtPrazo = document.getElementById('submissao-prazo-info');
    const regra = ev.regra_submissao;

    if (regra && regra.aceita_submissao) {
        if (secaoSubmissao) secaoSubmissao.style.display = 'block';
        if (regra.periodo_aberto === true) {
            if (btnSubmeterLink) {
                btnSubmeterLink.style.display = 'inline-flex';
                btnSubmeterLink.href = `../../submissao/submeter-trabalho/index.html?evento=${encodeURIComponent(ev.id)}`;
            }
            if (txtPrazo) {
                txtPrazo.textContent = regra.data_hora_fim
                    ? `Período aberto até ${dataHoraLegivel(regra.data_hora_fim)}.`
                    : 'Período de submissões aberto.';
            }
        } else {
            // Aceita submissão mas período encerrado ou ainda não aberto
            if (btnSubmeterLink) btnSubmeterLink.style.display = 'none';
            if (txtPrazo) {
                txtPrazo.textContent = 'O período de submissões para este evento está encerrado ou ainda não foi aberto.';
            }
        }
    } else {
        if (secaoSubmissao) secaoSubmissao.style.display = 'none';
    }

    // 7. Programação Geral (com escape)
    const elProgramacao = document.getElementById('detalhe-programacao-container');
    if (elProgramacao) {
        if (ev.programacao_geral && ev.programacao_geral.trim()) {
            const linhas = ev.programacao_geral.trim().split('\n').filter(Boolean);
            elProgramacao.innerHTML = linhas.map(linha => `
                <div style="margin-bottom: 12px; padding: 12px; background: var(--bg); border-left: 3px solid var(--primary); border-radius: var(--r-sm);">
                    <p style="margin: 0; color: var(--ink); font-size: 14px; font-weight: 500;">${esc(linha)}</p>
                </div>
            `).join('');
        } else {
            elProgramacao.innerHTML = `<p style="color: var(--muted); font-style: italic; margin: 0;">A programação detalhada será divulgada oportunamente pela comissão organizadora.</p>`;
        }
    }

    // 8. Coluna Lateral: Quando e onde (sem fallbacks proibidos)
    const elSideData = document.getElementById('sidebar-data');
    if (elSideData) elSideData.textContent = formatarDataIso(ev.data);

    const elSideHorario = document.getElementById('sidebar-horario');
    if (elSideHorario) {
        const hInicio = ev.hora_inicio ? ev.hora_inicio.slice(0, 5) : '—';
        const hFim = ev.hora_fim ? ev.hora_fim.slice(0, 5) : '—';
        elSideHorario.textContent = `${hInicio} às ${hFim}`;
    }

    const elSideLocal = document.getElementById('sidebar-local-designacao');
    if (elSideLocal) elSideLocal.textContent = ev.local || 'Local não informado';

    const elSideLocalTipo = document.getElementById('sidebar-local-tipo');
    const elSideLocalTipoWrap = document.getElementById('sidebar-local-tipo-wrap');
    if (elSideLocalTipo && elSideLocalTipoWrap) {
        if (ev.local_tipo) {
            elSideLocalTipo.textContent = ev.local_tipo;
            elSideLocalTipoWrap.style.display = 'inline';
        } else {
            elSideLocalTipoWrap.style.display = 'none';
        }
    }

    const elSideModalidade = document.getElementById('sidebar-modalidade-texto');
    if (elSideModalidade) elSideModalidade.textContent = ev.modalidade_display || ev.modalidade || 'Presencial';

    const elSideVagasTexto = document.getElementById('sidebar-vagas-texto');
    if (elSideVagasTexto) {
        elSideVagasTexto.textContent = `${ocupadas} / ${totalVagas} (${taxaOcupacao}%)`;
    }

    const elSideBarra = document.getElementById('sidebar-vagas-barra');
    if (elSideBarra) {
        elSideBarra.style.width = `${taxaOcupacao}%`;
    }

    const elSideRestantes = document.getElementById('sidebar-vagas-restantes');
    if (elSideRestantes) {
        elSideRestantes.textContent = disponiveis > 0
            ? `Restam ${disponiveis} vagas para confirmação imediata.`
            : 'Capacidade máxima de inscrições atingida.';
    }

    // 9. Equipe Organizadora (com escape)
    const elEquipe = document.getElementById('lista-equipe-organizadora');
    if (elEquipe) {
        if (ev.organizadores && ev.organizadores.length > 0) {
            elEquipe.innerHTML = ev.organizadores.map(org => {
                const nomeOrg = org.nome || org.usuario_nome || 'Membro da Equipe';
                const email = org.email_publico || '';
                const inicial = obterIniciais(nomeOrg);
                const papel = org.papel_funcao || 'Organizador(a)';
                return `
                    <div class="row" style="gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line);">
                        <span class="avatar">${esc(inicial)}</span>
                        <div>
                            <b>${esc(nomeOrg)}</b>
                            <p class="small muted">${esc(papel)}${email ? ` · ${esc(email)}` : ''}</p>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            const respNome = ev.usuario_representante_nome || 'Coordenação Geral';
            const inicial = obterIniciais(respNome);
            elEquipe.innerHTML = `
                <div class="row" style="gap: 12px; padding: 8px 0;">
                    <span class="avatar">${esc(inicial)}</span>
                    <div>
                        <b>${esc(respNome)}</b>
                        <p class="small muted">Coordenação Geral do Evento</p>
                    </div>
                </div>
            `;
        }
    }
}

async function mudarStatusEvento(id, acao) {
    clearAlert('mensagem-alerta');
    try {
        const resp = await apiFetch(`/eventos/${id}/${acao}/`, { method: 'POST' });
        const dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            showAlert('mensagem-alerta', dados.detail || 'Não foi possível atualizar a situação do evento.', 'danger');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        showAlert('mensagem-alerta', dados.detail || 'Situação do evento atualizada com sucesso!', 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => carregarDetalhesEvento(id), 1000);
    } catch {
        showAlert('mensagem-alerta', 'Erro de conexão com o servidor do SGIE.', 'danger');
    }
}

async function confirmarCancelamento(id) {
    const motivo = prompt('Informe a justificativa acadêmica para o cancelamento deste evento:');
    if (motivo === null) return;
    if (!motivo.trim()) {
        alert('O motivo do cancelamento é obrigatório.');
        return;
    }

    try {
        const resp = await apiFetch(`/eventos/${id}/cancelar/`, {
            method: 'POST',
            body: JSON.stringify({ motivo: motivo.trim() }),
        });
        const dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            showAlert('mensagem-alerta', dados.detail || 'Não foi possível cancelar o evento.', 'danger');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        showAlert('mensagem-alerta', 'Evento cancelado com sucesso.', 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => carregarDetalhesEvento(id), 1000);
    } catch {
        showAlert('mensagem-alerta', 'Erro de conexão ao cancelar o evento.', 'danger');
    }
}
