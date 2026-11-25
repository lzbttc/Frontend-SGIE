/* SGIE — pagamentos/validar_certificado.js
 * Validação pública de certificado. Endpoint: GET /certificados/validar/{codigo}/ (sem login).
 */
(function () {
    'use strict';
    const D = window.SGIE_DOM;
    const F = window.SGIE_FORMATTERS;
    const esc = D.escapeHTML;

    async function validar(codigo) {
        const box = document.getElementById('resultado-validacao');
        const btn = document.getElementById('btn-validar');
        btn.disabled = true;
        D.renderLoading(box, 'Consultando...');
        const r = await D.chamar(`/certificados/validar/${encodeURIComponent(codigo)}/`);
        btn.disabled = false;
        if (r.ok && r.dados && r.dados.autentico) {
            const d = r.dados;
            box.innerHTML = `
                <section class="card">
                    <div class="alert alert-success" role="status">
                        <i class="ic ic-check"></i>
                        <div class="grow"><b>Certificado autêntico</b>Este certificado foi emitido pelo SGIE.</div>
                    </div>
                    <dl class="dl mt-4">
                        <dt>Participante</dt><dd>${esc(d.participante)}</dd>
                        <dt>Evento</dt><dd>${esc(d.evento)}</dd>
                        <dt>Carga horária</dt><dd>${d.carga_horaria ? esc(d.carga_horaria) + ' h' : '—'}</dd>
                        <dt>Emitido em</dt><dd>${esc(F.formatarData(d.emitido_em))}</dd>
                        <dt>Código</dt><dd><code style="word-break: break-all;">${esc(d.codigo)}</code></dd>
                    </dl>
                </section>`;
        } else if (r.status === 404) {
            box.innerHTML = `<div class="alert alert-danger" role="alert"><i class="ic ic-x"></i><div class="grow"><b>Certificado não encontrado</b>Confira o código digitado. Se o problema persistir, entre em contato com a organização do evento.</div></div>`;
        } else {
            D.renderError(box, { titulo: 'Não foi possível validar agora', mensagem: r.erro, tentarNovamenteFn: () => validar(codigo) });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (window.isAuthenticated()) window.atualizarCabecalhoUsuario('');
        const campo = document.getElementById('campo-codigo');
        const inicial = new URLSearchParams(window.location.search).get('codigo');
        if (inicial) { campo.value = inicial; validar(inicial.trim()); }
        document.getElementById('form-validar').addEventListener('submit', (e) => {
            e.preventDefault();
            const codigo = campo.value.trim();
            if (!codigo) { campo.classList.add('is-error'); campo.focus(); return; }
            campo.classList.remove('is-error');
            validar(codigo);
        });
    });
})();
