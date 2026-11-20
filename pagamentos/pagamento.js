
document.addEventListener('DOMContentLoaded', async () => {

    // =========================================
    // AUTENTICAÇÃO E NAVEGAÇÃO
    // =========================================

    if (!isAuthenticated()) {
        window.location.href = resolveAppUrl('usuarios/login/login.html');
        return;
    }

    atualizarCabecalhoUsuario('pagamento');

    // =========================================
    // ELEMENTOS DA PÁGINA
    // =========================================

    const params = new URLSearchParams(window.location.search);

    const eventoId = params.get('evento');
    const inscricaoId = params.get('inscricao');

    const elementos = {
        alerta: document.getElementById('mensagem-alerta'),

        avatar: document.getElementById('participante-avatar'),
        nome: document.getElementById('participante-nome'),
        email: document.getElementById('participante-email'),
        cpf: document.getElementById('participante-cpf'),

        forma: document.getElementById('forma-pagamento'),
        detalhes: document.getElementById('area-detalhes-pagamento'),

        evento: document.getElementById('resumo-evento'),
        valor: document.getElementById('resumo-valor'),
        resumoForma: document.getElementById('resumo-forma'),
        total: document.getElementById('resumo-total'),

        botaoPagamento: document.getElementById('btn-ir-pagamento')
    };

    // =========================================
    // ESTADO DA PÁGINA
    // =========================================

    let eventoAtual = null;
    let inscricaoAtual = null;
    let participanteAtual = null;

    let valorInscricao = 0;

    // =========================================
    // FORMATAÇÃO
    // =========================================

    function formatarCPFMascarado(cpf) {
        const numeros = String(cpf || '').replace(/\D/g, '');

        if (numeros.length !== 11) {
            return 'Não informado';
        }

        return `***.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-**`;
    }

    function obterIniciais(nome) {
        if (!nome) return '--';

        return nome
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(parte => parte.charAt(0))
            .join('')
            .toUpperCase();
    }

    function escaparHTML(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[caractere]);
    }

    function obterIdRelacionado(valor) {
        if (valor && typeof valor === 'object') {
            return valor.id ?? valor.pk ?? valor;
        }

        return valor;
    }

    // =========================================
    // MENSAGENS
    // =========================================

    function exibirMensagem(mensagem, tipo = 'danger') {
        if (!elementos.alerta) return;

        elementos.alerta.innerHTML = '';

        const alerta = document.createElement('div');
        alerta.className = `pay-alert-message pay-alert-${tipo}`;
        alerta.textContent = mensagem;

        elementos.alerta.appendChild(alerta);
        elementos.alerta.style.display = 'block';

        elementos.alerta.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }

    function limparMensagem() {
        if (!elementos.alerta) return;

        elementos.alerta.innerHTML = '';
        elementos.alerta.style.display = 'none';
    }

    // =========================================
    // CARREGAR DADOS DA API
    // =========================================

    async function carregarDados() {

        if (!eventoId || !inscricaoId) {
            throw new Error(
                'Não foi possível identificar o evento ou a inscrição.'
            );
        }

        const [resEvento, resParticipante, resInscricao] =
            await Promise.all([
                apiFetch(`/eventos/${eventoId}/`),
                apiFetch('/usuarios/perfil/'),
                apiFetch(`/inscricoes/${inscricaoId}/`)
            ]);

        if (!resEvento.ok) {
            throw new Error(
                'Não foi possível carregar os dados do evento.'
            );
        }

        if (!resParticipante.ok) {
            throw new Error(
                'Não foi possível carregar seus dados cadastrais.'
            );
        }

        if (!resInscricao.ok) {
            throw new Error(
                'Não foi possível localizar sua inscrição.'
            );
        }

        eventoAtual = await resEvento.json();
        participanteAtual = await resParticipante.json();
        inscricaoAtual = await resInscricao.json();

        // Verificar se a inscrição corresponde ao evento informado.

        const eventoDaInscricao = obterIdRelacionado(
            inscricaoAtual.evento ?? inscricaoAtual.evento_id
        );

        if (String(eventoDaInscricao) !== String(eventoId)) {
            throw new Error(
                'A inscrição não corresponde ao evento informado.'
            );
        }

        // Verificar situação da inscrição.

        if (inscricaoAtual.status !== 'pendente_pagamento') {
            throw new Error(
                'Esta inscrição não está aguardando pagamento.'
            );
        }

        // Verificar se o evento é gratuito.

        if (eventoAtual.e_gratuito) {
            throw new Error(
                'Este evento é gratuito e não necessita de pagamento.'
            );
        }

        valorInscricao = Number(eventoAtual.preco);

        if (
            !Number.isFinite(valorInscricao) ||
            valorInscricao <= 0
        ) {
            throw new Error(
                'O valor de inscrição deste evento é inválido.'
            );
        }

        preencherParticipante();
        preencherResumo();
    }

    // =========================================
    // DADOS DO PARTICIPANTE
    // =========================================

    function preencherParticipante() {

        const nome = participanteAtual.nome_completo || 'Participante';

        elementos.nome.textContent = nome;

        elementos.email.textContent =
            participanteAtual.email || '—';

        elementos.avatar.textContent = obterIniciais(nome);

        elementos.cpf.value = formatarCPFMascarado(
            participanteAtual.cpf_formatado ||
            participanteAtual.cpf
        );
    }

    // =========================================
    // RESUMO DA INSCRIÇÃO
    // =========================================

    function preencherResumo() {

        elementos.evento.textContent =
            eventoAtual.nome || 'Evento';

        const valorFormatado = formatarMoeda(valorInscricao);

        elementos.valor.textContent = valorFormatado;
        elementos.total.textContent = valorFormatado;

        atualizarFormaPagamento();
    }

    // =========================================
    // FORMA DE PAGAMENTO
    // =========================================

    function atualizarFormaPagamento() {

        const formas = {
            pix: 'PIX',
            cartao: 'Cartão de crédito',
            boleto: 'Boleto bancário'
        };

        const metodo = elementos.forma.value;

        elementos.resumoForma.textContent =
            formas[metodo] || 'Não selecionada';
    }

    elementos.forma.addEventListener('change', () => {

        const metodo = elementos.forma.value;

        elementos.detalhes.innerHTML = '';
        elementos.detalhes.style.display = 'none';

        const mensagens = {
            pix: 'O pagamento via PIX estará disponível após a integração com o serviço financeiro.',
            cartao: 'O pagamento via cartão estará disponível após a integração com o serviço financeiro.',
            boleto: 'A emissão de boletos estará disponível após a integração com o serviço financeiro.'
        };

        if (mensagens[metodo]) {

            const nomeMetodo =
                elementos.forma.options[
                    elementos.forma.selectedIndex
                ].text;

            elementos.detalhes.innerHTML = `
                <div class="pay-method-notice">
                    <strong>${escaparHTML(nomeMetodo)}</strong>
                    <p>${escaparHTML(mensagens[metodo])}</p>
                </div>
            `;

            elementos.detalhes.style.display = 'block';
        }

        atualizarFormaPagamento();
    });

    // =========================================
    // PAGAMENTO
    // =========================================

    // O botão permanece desabilitado porque ainda não existe
    // integração financeira para processar a transação.

    elementos.botaoPagamento.disabled = true;

    elementos.botaoPagamento.addEventListener('click', () => {

        exibirMensagem(
            'O processamento financeiro ainda não está disponível no SGIE. Nenhum pagamento foi realizado.',
            'info'
        );

    });

    // =========================================
    // INICIALIZAÇÃO
    // =========================================

    try {

        await carregarDados();

    } catch (error) {

        console.error('Erro ao inicializar pagamento:', error);

        exibirMensagem(
            error.message ||
            'Não foi possível carregar a página de pagamento.'
        );

        elementos.botaoPagamento.disabled = true;
    }

});
