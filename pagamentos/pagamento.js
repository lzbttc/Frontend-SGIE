
document.addEventListener('DOMContentLoaded', async () => {
    // =========================================
    // AUTENTICAÇÃO E NAVEGAÇÃO
    // =========================================

    if (!isAuthenticated()) {
        window.location.href = resolveAppUrl('usuarios/login.html');
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

        quantidade: document.getElementById('quantidade-ingressos'),
        diminuir: document.getElementById('btn-diminuir'),
        aumentar: document.getElementById('btn-aumentar'),

        forma: document.getElementById('forma-pagamento'),
        detalhes: document.getElementById('area-detalhes-pagamento'),

        evento: document.getElementById('resumo-evento'),
        valor: document.getElementById('resumo-valor'),
        resumoQuantidade: document.getElementById('resumo-quantidade'),
        resumoForma: document.getElementById('resumo-forma'),
        total: document.getElementById('resumo-total'),

        termos: document.getElementById('aceite-termos'),
        botaoPagamento: document.getElementById('btn-ir-pagamento')
    };

    // =========================================
    // ESTADO DA PÁGINA
    // =========================================

    let eventoAtual = null;
    let inscricaoAtual = null;
    let participanteAtual = null;

    let quantidadeIngressos = 1;
    let valorUnitario = 0;

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
            "'": '&#039;'
        })[caractere]);
    }

    // =========================================
    // MENSAGENS
    // =========================================

    function exibirMensagem(mensagem, tipo = 'danger') {
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
            throw new Error('Não foi possível carregar os dados do evento.');
        }

        if (!resParticipante.ok) {
            throw new Error('Não foi possível carregar seus dados cadastrais.');
        }

        if (!resInscricao.ok) {
            throw new Error('Não foi possível localizar sua inscrição.');
        }

        eventoAtual = await resEvento.json();
        participanteAtual = await resParticipante.json();
        inscricaoAtual = await resInscricao.json();

        // Verificar se a inscrição corresponde ao evento informado.

        if (String(inscricaoAtual.evento) !== String(eventoId)) {
            throw new Error('A inscrição não corresponde ao evento informado.');
        }

        if (inscricaoAtual.status !== 'pendente_pagamento') {
            throw new Error(
                'Esta inscrição não está aguardando pagamento.'
            );
        }

        if (eventoAtual.e_gratuito) {
            throw new Error(
                'Este evento é gratuito e não necessita de pagamento.'
            );
        }

        valorUnitario = Number(eventoAtual.preco);

        if (!Number.isFinite(valorUnitario) || valorUnitario <= 0) {
            throw new Error('O valor de inscrição deste evento é inválido.');
        }

        preencherParticipante();
        preencherResumo();

        elementos.botaoPagamento.disabled = true;
    }

    // =========================================
    // DADOS DO PARTICIPANTE
    // =========================================

    function preencherParticipante() {
        const nome = participanteAtual.nome_completo || 'Participante';

        elementos.nome.textContent = nome;
        elementos.email.textContent = participanteAtual.email || '—';

        elementos.avatar.textContent = obterIniciais(nome);

        elementos.cpf.value = formatarCPFMascarado(
            participanteAtual.cpf_formatado ||
            participanteAtual.cpf
        );
    }

    // =========================================
    // RESUMO DO PEDIDO
    // =========================================

    function preencherResumo() {
        elementos.evento.textContent = eventoAtual.nome;

        atualizarResumo();
    }

    function atualizarResumo() {
        const total = valorUnitario * quantidadeIngressos;

        elementos.valor.textContent = formatarMoeda(valorUnitario);

        elementos.quantidade.textContent = quantidadeIngressos;
        elementos.resumoQuantidade.textContent = quantidadeIngressos;

        elementos.total.textContent = formatarMoeda(total);

        const formas = {
            pix: 'PIX',
            cartao: 'Cartão de crédito',
            boleto: 'Boleto bancário'
        };

        elementos.resumoForma.textContent =
            formas[elementos.forma.value] || 'Não selecionado';

        validarFormulario();
    }

    // =========================================
    // QUANTIDADE DE INGRESSOS
    // =========================================

    elementos.diminuir.addEventListener('click', () => {
        if (quantidadeIngressos > 1) {
            quantidadeIngressos--;
            atualizarResumo();
        }
    });

    elementos.aumentar.addEventListener('click', () => {
        quantidadeIngressos++;
        atualizarResumo();
    });

    // =========================================
    // FORMA DE PAGAMENTO
    // =========================================

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
            elementos.detalhes.innerHTML = `
                <div class="pay-method-notice">
                    <strong>${escaparHTML(
                        elementos.forma.options[elementos.forma.selectedIndex].text
                    )}</strong>
                    <p>${escaparHTML(mensagens[metodo])}</p>
                </div>
            `;

            elementos.detalhes.style.display = 'block';
        }

        atualizarResumo();
    });

    // =========================================
    // ACEITE DOS TERMOS
    // =========================================

    elementos.termos.addEventListener('change', validarFormulario);

    function validarFormulario() {
        const formaSelecionada = Boolean(elementos.forma.value);
        const termosAceitos = elementos.termos.checked;

        elementos.botaoPagamento.disabled = !(
            formaSelecionada &&
            termosAceitos &&
            inscricaoAtual &&
            inscricaoAtual.status === 'pendente_pagamento'
        );
    }

    // =========================================
    // AVANÇAR PARA PAGAMENTO
    // =========================================

    elementos.botaoPagamento.addEventListener('click', () => {
        limparMensagem();

        if (!elementos.forma.value) {
            exibirMensagem(
                'Selecione uma forma de pagamento.',
                'danger'
            );
            return;
        }

        if (!elementos.termos.checked) {
            exibirMensagem(
                'É necessário aceitar os termos para continuar.',
                'danger'
            );
            return;
        }

        exibirMensagem(
            'A seleção foi registrada na interface. O processamento financeiro ainda não está disponível no backend do SGIE.',
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
            error.message || 'Não foi possível carregar a página de pagamento.'
        );

        elementos.botaoPagamento.disabled = true;
    }
});
