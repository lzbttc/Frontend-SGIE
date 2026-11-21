/* SGIE — submissao/avaliacoes/avaliacoes.js
 * Fila do avaliador (protótipo com visual integrado ao shell v3).
 * Mantém botões em estado disabled em conformidade com as restrições
 * documentadas na seção 3.5 e Fase 9 do Plano de Implementação.
 */

document.addEventListener('DOMContentLoaded', () => {
    if (!isAuthenticated()) {
        window.location.href = resolveAppUrl('usuarios/login/login.html');
        return;
    }

    atualizarCabecalhoUsuario('avaliacoes');
});
