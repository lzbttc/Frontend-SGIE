/* SGIE — submissao/perfil-avaliador/perfil_avaliador.js
 * Perfil de avaliador do usuário logado.
 * Endpoints: GET /areas/, GET /avaliadores/ (localiza o perfil do usuário), POST /avaliadores/, PATCH /avaliadores/{uuid}/
 */
(function () {
    'use strict';
    const D = window.SGIE_DOM;
    const esc = D.escapeHTML;
    let perfil = null;
    let usuario = null;

    function badge(texto, classe) {
        const b = document.getElementById('badge-perfil-status');
        b.textContent = texto;
        b.className = `badge ${classe}`;
    }

    function erro(id, msg) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = msg || '';
        el.hidden = !msg;
    }

    function urlValida(v) {
        if (!v) return true;
        return Boolean(D.urlSegura(v));
    }

    async function carregar() {
        const carregando = document.getElementById('carregando-perfil');
        const form = document.getElementById('form-avaliador');
        D.renderLoading(carregando, 'Carregando perfil...');
        const [areas, avs] = await Promise.all([D.chamar('/areas/'), D.chamar('/avaliadores/')]);
        if (!areas.ok || !avs.ok) {
            D.renderError(carregando, { titulo: 'Não foi possível carregar o perfil', mensagem: areas.erro || avs.erro, tentarNovamenteFn: carregar });
            return;
        }
        carregando.innerHTML = '';
        perfil = D.extrairLista(avs.dados).find((a) => String(a.usuario) === String(usuario.id)) || null;
        const selecionadas = new Set((perfil ? perfil.areas || [] : []).map(String));
        const listaAreas = D.extrairLista(areas.dados);
        document.getElementById('lista-areas').innerHTML = listaAreas.length
            ? listaAreas.map((a) => `
                <label class="check" for="area-${esc(a.id)}">
                    <input type="checkbox" id="area-${esc(a.id)}" value="${esc(a.id)}" data-area ${selecionadas.has(String(a.id)) ? 'checked' : ''}>
                    <div><b>${esc(a.nome)}</b>${a.descricao ? `<span>${esc(a.descricao)}</span>` : ''}</div>
                </label>`).join('')
            : '<p class="muted small">Nenhuma área cadastrada pela organização.</p>';
        if (perfil) {
            document.getElementById('campo-afiliacao').value = perfil.afiliacao_institucional || '';
            document.getElementById('campo-titulacao').value = perfil.maior_titulacao || '';
            document.getElementById('campo-lattes').value = perfil.lattes_url || '';
            document.getElementById('campo-linkedin').value = perfil.linkedin_url || '';
            document.getElementById('campo-ativo').checked = perfil.ativo !== false;
            badge(perfil.ativo !== false ? 'Perfil ativo' : 'Perfil inativo', perfil.ativo !== false ? 'badge-success' : 'badge-neutral');
        } else {
            badge('Perfil ainda não criado', 'badge-warning');
        }
        form.hidden = false;
    }

    async function salvar(e) {
        e.preventDefault();
        const areasSel = Array.from(document.querySelectorAll('[data-area]:checked')).map((i) => i.value);
        const lattes = document.getElementById('campo-lattes').value.trim();
        const linkedin = document.getElementById('campo-linkedin').value.trim();
        erro('erro-areas', areasSel.length ? '' : 'Selecione ao menos uma área de atuação.');
        erro('erro-lattes', urlValida(lattes) ? '' : 'Informe uma URL começando com http:// ou https://.');
        erro('erro-linkedin', urlValida(linkedin) ? '' : 'Informe uma URL começando com http:// ou https://.');
        if (!areasSel.length || !urlValida(lattes) || !urlValida(linkedin)) return;

        const corpo = {
            areas: areasSel,
            afiliacao_institucional: document.getElementById('campo-afiliacao').value.trim(),
            maior_titulacao: document.getElementById('campo-titulacao').value,
            lattes_url: lattes,
            linkedin_url: linkedin,
            ativo: document.getElementById('campo-ativo').checked,
        };
        const btn = document.getElementById('btn-salvar-avaliador');
        btn.disabled = true;
        const r = perfil
            ? await D.chamar(`/avaliadores/${encodeURIComponent(perfil.id)}/`, 'PATCH', corpo)
            : await D.chamar('/avaliadores/', 'POST', { ...corpo, usuario: usuario.id });
        btn.disabled = false;
        if (r.ok) {
            D.showAlert('mensagem-alerta', 'Perfil de avaliador salvo.', 'success');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            await carregar();
        } else {
            D.showAlert('mensagem-alerta', r.erro, 'danger');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!window.isAuthenticated()) { window.location.href = window.resolveAppUrl('usuarios/login/login.html'); return; }
        window.atualizarCabecalhoUsuario('');
        usuario = window.SGIE_ROLES.getUsuarioLogado();
        if (!usuario || !usuario.id) {
            D.showAlert('mensagem-alerta', 'Não foi possível identificar o usuário. Entre novamente.', 'danger');
            return;
        }
        document.getElementById('form-avaliador').addEventListener('submit', salvar);
        carregar();
    });
})();
