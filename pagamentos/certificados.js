/* SGIE — pagamentos/certificados.js
 * Certificados do participante. Endpoint: GET /certificados/
 */
(function () {
    'use strict';
    const D = window.SGIE_DOM;
    const F = window.SGIE_FORMATTERS;
    const esc = D.escapeHTML;

    async function carregar() {
        const box = document.getElementById('lista-certificados');
        D.renderLoading(box, 'Carregando certificados...');
        const [r, ins] = await Promise.all([D.chamar('/certificados/'), D.chamar('/inscricoes/minhas/')]);
        if (!r.ok) {
            D.renderError(box, { titulo: 'Não foi possível carregar os certificados', mensagem: r.erro, tentarNovamenteFn: carregar });
            return;
        }
        const minhas = new Set(D.extrairLista(ins.dados).map((i) => String(i.id)));
        const lista = D.extrairLista(r.dados).filter((c) => c.disponivel !== false && (!ins.ok || minhas.has(String(c.inscricao))));
        if (!lista.length) {
            D.renderEmpty(box, { titulo: 'Nenhum certificado disponível', mensagem: 'Os certificados são liberados após a realização do evento e a confirmação da sua presença.', icone: 'ic-info', acaoTexto: 'Ver minhas inscrições', acaoHref: '../inscricao/minhas-inscricoes/index.html' });
            return;
        }
        box.innerHTML = `<div class="grid cols-2 gap-4">${lista.map((c) => {
            const url = D.urlSegura(c.arquivo);
            return `
            <section class="card">
                <div class="card-head">
                    <div>
                        <h2 class="h3">${esc(c.evento_nome || 'Evento')}</h2>
                        <p class="muted small">Emitido em ${esc(F.formatarData(c.emitido_em))}${c.carga_horaria ? ` · ${esc(c.carga_horaria)} h` : ''}</p>
                    </div>
                    <span class="badge badge-success">Disponível</span>
                </div>
                <div class="stack">
                    <div>
                        <div class="label">Código de autenticação</div>
                        <code class="small" style="word-break: break-all;">${esc(c.codigo_autenticacao)}</code>
                    </div>
                    <div class="row">
                        ${url ? `<a class="btn btn-primary btn-sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><i class="ic ic-download"></i>Baixar certificado</a>` : ''}
                        <button type="button" class="btn btn-secondary btn-sm" data-copiar="${esc(c.codigo_autenticacao)}">Copiar código</button>
                        <a class="btn btn-ghost btn-sm" href="validar-certificado.html?codigo=${encodeURIComponent(c.codigo_autenticacao)}">Validar</a>
                    </div>
                </div>
            </section>`;
        }).join('')}</div>`;
        box.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(b.getAttribute('data-copiar'));
                D.showAlert('mensagem-alerta', 'Código copiado.', 'success');
            } catch {
                D.showAlert('mensagem-alerta', 'Não foi possível copiar automaticamente. Selecione o código e copie manualmente.', 'warning');
            }
        }));
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!window.isAuthenticated()) { window.location.href = window.resolveAppUrl('usuarios/login/login.html'); return; }
        window.atualizarCabecalhoUsuario('');
        carregar();
    });
})();
