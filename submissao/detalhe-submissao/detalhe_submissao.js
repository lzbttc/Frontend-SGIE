/* SGIE — submissao/detalhe-submissao/detalhe_submissao.js
 * Visualização completa da submissão, histórico de versões e pareceres.
 * Endpoints:
 *   - GET /submissoes/{uuid}/
 *   - POST /submissoes/{uuid}/submeter/ (envio de nova versão quando permitido)
 */

document.addEventListener('DOMContentLoaded', async () => {
    if (!isAuthenticated()) {
        window.location.href = resolveAppUrl('usuarios/login/login.html');
        return;
    }

    atualizarCabecalhoUsuario('submissoes');

    const params = new URLSearchParams(window.location.search);
    const submissaoId = params.get('id');

    if (!submissaoId) {
        showAlert('mensagem-alerta', 'Nenhuma submissão especificada na URL.', 'danger');
        return;
    }

    await carregarDetalheSubmissao(submissaoId);

    const btnEnviarNova = document.getElementById('btn-enviar-nova-versao');
    if (btnEnviarNova) {
        btnEnviarNova.addEventListener('click', () => enviarNovaVersao(submissaoId));
    }
});

let _submissaoDados = null;

async function carregarDetalheSubmissao(uuid) {
    clearAlert('mensagem-alerta');
    try {
        const resp = await apiFetch(`/submissoes/${encodeURIComponent(uuid)}/`);
        if (!resp.ok) {
            showAlert('mensagem-alerta', 'Submissão não encontrada ou você não tem permissão para visualizá-la.', 'danger');
            return;
        }

        _submissaoDados = await resp.json();
        renderizarDetalhes(_submissaoDados);

    } catch (e) {
        console.error('[detalhe_submissao] Erro:', e);
        showAlert('mensagem-alerta', 'Erro de conexão com o servidor do SGIE.', 'danger');
    }
}

function renderizarDetalhes(sub) {
    const fmt = window.SGIE_FORMATTERS;

    // 1. Título e cabeçalho
    document.title = `${sub.titulo || 'Submissão'} — SGIE`;

    const elCrumb = document.getElementById('crumb-titulo');
    if (elCrumb) elCrumb.textContent = sub.titulo || 'Detalhe';

    const elTitulo = document.getElementById('detalhe-titulo');
    if (elTitulo) elTitulo.textContent = sub.titulo || 'Sem título';

    const elSubtitulo = document.getElementById('detalhe-subtitulo');
    if (elSubtitulo) {
        const evNome = sub.evento_nome || (sub.evento && sub.evento.nome) || 'Evento';
        const dataEnvio = fmt ? fmt.formatarData(sub.criado_em) : (sub.criado_em || '—');
        elSubtitulo.textContent = `${evNome} · enviado em ${dataEnvio}`;
    }

    // 2. Badges do topo
    const containerBadges = document.getElementById('badges-cabecalho');
    if (containerBadges) {
        const tipo = sub.tipo_display || sub.tipo || 'Artigo';
        const area = sub.area_nome || (sub.area && sub.area.nome) || 'Área Temática';
        const statusBadge = getStatusBadge(sub.status);

        containerBadges.innerHTML = `
            ${statusBadge}
            <span class="badge badge-neutral">${escapeHtml(tipo)}</span>
            <span class="badge badge-neutral">${escapeHtml(area)}</span>
        `;
    }

    // 3. Botão de ação de topo (se pode editar ou se é rascunho)
    const elAcaoTopo = document.getElementById('acao-topo');
    if (elAcaoTopo) {
        if (sub.status === 'Rascunho') {
            elAcaoTopo.innerHTML = `<a class="btn btn-primary" href="../submeter-trabalho/index.html?id=${encodeURIComponent(sub.uuid || sub.id)}"><i class="ic ic-pencil"></i>Editar rascunho</a>`;
        } else if (sub.status === 'Correções solicitadas') {
            elAcaoTopo.innerHTML = `<a class="btn btn-primary" href="#nova-versao"><i class="ic ic-upload"></i>Enviar nova versão</a>`;
        } else {
            elAcaoTopo.innerHTML = '';
        }
    }

    // 4. Sobre o trabalho
    const elEvento = document.getElementById('det-evento');
    if (elEvento) elEvento.textContent = sub.evento_nome || (sub.evento && sub.evento.nome) || '—';

    const elTipo = document.getElementById('det-tipo');
    if (elTipo) elTipo.textContent = sub.tipo_display || sub.tipo || '—';

    const elArea = document.getElementById('det-area');
    if (elArea) elArea.textContent = sub.area_nome || (sub.area && sub.area.nome) || '—';

    const elKw = document.getElementById('det-kw');
    if (elKw) {
        const kws = String(sub.palavras_chave || '').split(',').map(s => s.trim()).filter(Boolean);
        elKw.innerHTML = kws.map(k => `<span class="badge badge-neutral" style="margin-right:4px;">${escapeHtml(k)}</span>`).join('') || '—';
    }

    const elAbstract = document.getElementById('det-abstract');
    if (elAbstract) elAbstract.textContent = sub.abstract || 'Sem abstract.';

    if (sub.resumo) {
        const rotulo = document.getElementById('rotulo-resumo');
        const detResumo = document.getElementById('det-resumo');
        if (rotulo) rotulo.style.display = 'block';
        if (detResumo) {
            detResumo.style.display = 'block';
            detResumo.textContent = sub.resumo;
        }
    }

    // 5. Autores
    renderizarAutores(sub);

    // 6. Parecer do avaliador
    renderizarParecer(sub);

    // 7. Andamento (passos)
    atualizarAndamento(sub);

    // 8. Arquivo e Nova versão
    renderizarArquivo(sub);
}

function renderizarAutores(sub) {
    const container = document.getElementById('lista-autores');
    if (!container) return;

    let html = '';

    // Autor principal
    const autorNome = sub.autor_nome || (sub.autor && (sub.autor.nome_completo || sub.autor.email)) || 'Autor Principal';
    const afil = sub.afiliacao_institucional || 'Instituição não informada';
    const tit = sub.maior_titulacao ? ` · ${sub.maior_titulacao}` : '';
    const lattesLink = sub.lattes_url ? `<a href="${escapeHtml(sub.lattes_url)}" target="_blank" rel="noopener noreferrer"><i class="ic ic-link"></i> Currículo Lattes</a>` : '';
    const inLink = sub.linkedin_url ? `<a href="${escapeHtml(sub.linkedin_url)}" target="_blank" rel="noopener noreferrer"><i class="ic ic-link"></i> LinkedIn</a>` : '';

    html += `
        <div class="row" style="flex-wrap:nowrap;align-items:flex-start">
            <span class="avatar">1</span>
            <div class="grow">
                <div class="row between">
                    <b>${escapeHtml(autorNome)}</b>
                    <span class="badge badge-success">Autor principal</span>
                </div>
                <p class="small muted">${escapeHtml(afil)}${escapeHtml(tit)}</p>
                ${(lattesLink || inLink) ? `<p class="small row" style="gap:16px;margin-top:6px">${lattesLink} ${inLink}</p>` : ''}
            </div>
        </div>
    `;

    // Coautores se houver
    if (Array.isArray(sub.autores) && sub.autores.length > 0) {
        sub.autores.forEach((c, idx) => {
            const cNome = c.nome || c.usuario_nome || 'Coautor';
            const cAfil = c.afiliacao || 'Instituição não informada';
            html += `
                <hr class="sep" />
                <div class="row" style="flex-wrap:nowrap;align-items:flex-start">
                    <span class="avatar">${idx + 2}</span>
                    <div class="grow">
                        <div class="row between">
                            <b>${escapeHtml(cNome)}</b>
                            <span class="badge badge-neutral">Coautor</span>
                        </div>
                        <p class="small muted">${escapeHtml(cAfil)}</p>
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = html;
}

function renderizarParecer(sub) {
    const container = document.getElementById('card-parecer-container');
    if (!container) return;

    // Avaliações existentes
    const avaliacoes = Array.isArray(sub.avaliacoes) ? sub.avaliacoes : [];
    if (avaliacoes.length === 0 && sub.status !== 'Correções solicitadas') {
        container.style.display = 'none';
        return;
    }

    const fmt = window.SGIE_FORMATTERS;
    let cardHtml = '';

    if (sub.status === 'Correções solicitadas') {
        cardHtml += `
            <div class="alert alert-warning" style="margin-bottom:16px;">
                <i class="ic ic-alert"></i>
                <div>
                    <b>O avaliador solicitou correções neste trabalho.</b>
                    Substitua o arquivo anexando a nova versão corrigida no painel lateral.
                </div>
            </div>
        `;
    }

    if (avaliacoes.length > 0) {
        avaliacoes.forEach(av => {
            const dataAv = fmt ? fmt.formatarData(av.data_avaliacao || av.criado_em) : (av.data_avaliacao || '—');
            const pontuacao = av.pontuacao !== undefined && av.pontuacao !== null
                ? `<div class="card flat stat" style="padding:16px;min-width:140px"><div class="stat-n num">${av.pontuacao}<span class="muted" style="font-size:16px;font-weight:600"> / 100</span></div><div class="stat-l">Pontuação</div></div>`
                : '';

            cardHtml += `
                <section class="card" style="margin-bottom:16px;">
                    <div class="card-head">
                        <div>
                            <h2 class="h2">Parecer da Comissão Avaliadora</h2>
                            <p>Registrado em ${dataAv}</p>
                        </div>
                        <span class="badge ${getStatusBadgeClass(av.status_parecer)}">${escapeHtml(av.status_parecer || 'Parecer')}</span>
                    </div>

                    <div class="grid" style="grid-template-columns:auto minmax(0,1fr);gap:20px;align-items:start">
                        ${pontuacao}
                        <div class="stack" style="gap:10px">
                            <p style="white-space:pre-line;line-height:1.6;">${escapeHtml(av.observacoes || 'Sem observações adicionais registradas.')}</p>
                        </div>
                    </div>
                </section>
            `;
        });
    }

    container.innerHTML = cardHtml;
    container.style.display = 'block';
}

function atualizarAndamento(sub) {
    const pRascunho = document.getElementById('passo-rascunho');
    const pSubmetida = document.getElementById('passo-submetida');
    const pAvaliacao = document.getElementById('passo-avaliacao');
    const pCorrecao = document.getElementById('passo-correcao');
    const pDecisao = document.getElementById('passo-decisao');

    // Reset classes
    [pRascunho, pSubmetida, pAvaliacao, pCorrecao, pDecisao].forEach(p => {
        if (p) p.className = 'step';
    });

    const status = sub.status;

    if (status === 'Rascunho') {
        if (pRascunho) pRascunho.className = 'step is-current';
    } else if (status === 'Submetida') {
        if (pRascunho) pRascunho.className = 'step is-done';
        if (pSubmetida) pSubmetida.className = 'step is-current';
    } else if (status === 'Em avaliação') {
        if (pRascunho) pRascunho.className = 'step is-done';
        if (pSubmetida) pSubmetida.className = 'step is-done';
        if (pAvaliacao) pAvaliacao.className = 'step is-current';
    } else if (status === 'Correções solicitadas') {
        if (pRascunho) pRascunho.className = 'step is-done';
        if (pSubmetida) pSubmetida.className = 'step is-done';
        if (pAvaliacao) pAvaliacao.className = 'step is-done';
        if (pCorrecao) pCorrecao.className = 'step is-current';
    } else if (status === 'Aprovada' || status === 'Rejeitada') {
        if (pRascunho) pRascunho.className = 'step is-done';
        if (pSubmetida) pSubmetida.className = 'step is-done';
        if (pAvaliacao) pAvaliacao.className = 'step is-done';
        if (pCorrecao) pCorrecao.className = 'step is-done';
        if (pDecisao) {
            pDecisao.className = status === 'Aprovada' ? 'step is-done' : 'step is-current';
            const elTexto = document.getElementById('data-decisao');
            if (elTexto) elTexto.textContent = status;
        }
    }
}

function renderizarArquivo(sub) {
    const secaoAtual = document.getElementById('secao-arquivo-atual');
    const secaoNova = document.getElementById('secao-nova-versao');

    if (secaoAtual) {
        const versaoAtual = obterVersaoAtualSubmissao(sub);
        if (versaoAtual && versaoAtual.arquivo) {
            const urlArquivo = versaoAtual.arquivo;
            const nomeArquivo = decodeURIComponent(urlArquivo.split('?')[0].split('/').pop() || 'trabalho.pdf');
            const versao = `v${versaoAtual.numero}`;
            secaoAtual.innerHTML = `
                <div class="file-item" style="padding:12px 14px;background:var(--bg)">
                    <i class="ic ic-file" style="color:var(--primary-ink);font-size:22px;"></i>
                    <div class="grow">
                        <b>${escapeHtml(nomeArquivo)}</b>
                        <p class="small muted">Versão ativa: ${versao}</p>
                    </div>
                    <a href="${escapeHtml(urlArquivo)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" aria-label="Baixar arquivo">
                        <i class="ic ic-download"></i>Baixar
                    </a>
                </div>
            `;
        } else {
            secaoAtual.innerHTML = '<p class="small muted">Nenhum arquivo enviado para esta submissão.</p>';
        }
    }

    // Se pode enviar nova versão (ex.: Correções solicitadas e pode_submeter)
    if (secaoNova) {
        if (sub.pode_submeter && sub.status === 'Correções solicitadas') {
            secaoNova.style.display = 'block';
        } else {
            secaoNova.style.display = 'none';
        }
    }
}

async function enviarNovaVersao(uuid) {
    clearAlert('mensagem-alerta');
    const input = document.getElementById('input-nova-versao');
    if (!input || !input.files || input.files.length === 0) {
        showAlert('mensagem-alerta', 'Por favor, selecione o arquivo com a nova versão corrigida.', 'warning');
        return;
    }

    const file = input.files[0];
    const formData = new FormData();
    formData.append('arquivo', file);

    const btn = document.getElementById('btn-enviar-nova-versao');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Enviando nova versão...';
    }

    try {
        const resp = await apiFetch(`/submissoes/${encodeURIComponent(uuid)}/submeter/`, {
            method: 'POST',
            body: formData
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            showAlert('mensagem-alerta', err.detail || 'Não foi possível enviar a nova versão.', 'danger');
            return;
        }

        showAlert('mensagem-alerta', 'Nova versão do trabalho enviada com sucesso! O trabalho retornou para avaliação.', 'success');
        input.value = '';
        setTimeout(() => carregarDetalheSubmissao(uuid), 1200);

    } catch (e) {
        console.error('[detalhe_submissao] Erro no envio:', e);
        showAlert('mensagem-alerta', 'Erro de comunicação ao enviar o arquivo.', 'danger');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Enviar arquivo atualizado';
        }
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

const escapeHtml = (texto) => window.SGIE_DOM.escapeHTML(texto);
