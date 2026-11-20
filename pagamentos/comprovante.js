
document.addEventListener('DOMContentLoaded', async () => {

    // =========================================
    // AUTENTICAÇÃO E NAVEGAÇÃO
    // =========================================

    if (!isAuthenticated()) {
        window.location.href = resolveAppUrl('usuarios/login/login.html');
        return;
    }

    atualizarCabecalhoUsuario('comprovante');

    // =========================================
    // ELEMENTOS DA PÁGINA
    // =========================================

    const params = new URLSearchParams(window.location.search);
    const inscricaoId = params.get('inscricao');

    const alerta = document.getElementById('comprovante-alerta');
    const documento = document.getElementById('comprovante-documento');
    const acoes = document.getElementById('comprovante-acoes');
    const botaoImprimir = document.getElementById('btn-imprimir');

    // O documento só será exibido depois da validação.
    if (documento) documento.style.display = 'none';
    if (acoes) acoes.style.display = 'none';

    // =========================================
    // MENSAGENS
    // =========================================

    function mensagem(texto, tipo = 'danger') {

        if (!alerta) return;

        alerta.textContent = texto;
        alerta.style.display = 'block';
        alerta.className = `pay-alert-message pay-alert-${tipo}`;

        alerta.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }

    // =========================================
    // PREENCHIMENTO DOS CAMPOS
    // =========================================

    function preencher(id, valor) {

        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.textContent =
                valor !== null && valor !== undefined && valor !== ''
                    ? valor
                    : '—';
        }
    }

    // =========================================
    // FORMATAÇÃO
    // =========================================

    function formatarCPF(cpf) {

        const numeros = String(cpf || '').replace(/\D/g, '');

        if (numeros.length !== 11) {
            return 'Não informado';
        }

        return `***.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-**`;
    }

    function formatarData(data) {

        if (!data) return '—';

        const valor = String(data);

        // Preserva a data original quando a API envia
        // YYYY-MM-DD ou uma data ISO com horário.
        const correspondencia = valor.match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );

        if (correspondencia) {
            const [, ano, mes, dia] = correspondencia;
            return `${dia}/${mes}/${ano}`;
        }

        const dataObj = new Date(valor);

        if (Number.isNaN(dataObj.getTime())) {
            return '—';
        }

        return dataObj.toLocaleDateString('pt-BR');
    }

    function formatarHorario(horario) {

        if (!horario) return '—';

        return String(horario).substring(0, 5);
    }

    function formatarDataHora(data) {

        if (!data) return '—';

        const dataObj = new Date(data);

        if (Number.isNaN(dataObj.getTime())) {
            return '—';
        }

        return dataObj.toLocaleString('pt-BR');
    }

    // =========================================
    // COBRANÇA DA INSCRIÇÃO
    // =========================================

    // Consulta de apoio: qualquer falha retorna null sem interromper o comprovante.
    async function buscarCobrancaDaInscricao(idInscricao) {

        try {

            const resposta = await apiFetch('/cobrancas/');

            if (!resposta.ok) return null;

            const dados = await resposta.json();

            const lista = Array.isArray(dados)
                ? dados
                : (Array.isArray(dados.results) ? dados.results : []);

            const daInscricao = lista.filter(
                item => String(item.inscricao) === String(idInscricao)
            );

            // Prioriza a cobrança paga, se houver mais de uma.
            return daInscricao.find(item => item.status === 'PAGA')
                || daInscricao[0]
                || null;

        } catch (erro) {

            console.error('Erro ao consultar cobrança da inscrição:', erro);
            return null;
        }
    }

    function descreverSituacaoCobranca(cobranca) {

        if (!cobranca) return 'Não informado pelo sistema';

        const situacoes = {
            PAGA: 'Pago',
            PENDENTE: 'Aguardando pagamento',
            EXPIRADA: 'Cobrança expirada',
            CANCELADA: 'Cobrança cancelada'
        };

        return situacoes[cobranca.status] || 'Não informado pelo sistema';
    }

    // =========================================
    // CARREGAR COMPROVANTE
    // =========================================

    async function carregarComprovante() {

        if (!inscricaoId) {
            throw new Error(
                'Identificador da inscrição não informado.'
            );
        }

        // Consulta somente as inscrições do usuário autenticado.
        const response = await apiFetch('/inscricoes/minhas/');

        if (!response.ok) {
            throw new Error(
                'Não foi possível consultar suas inscrições.'
            );
        }

        const resultado = await response.json();

        const inscricoes = Array.isArray(resultado)
            ? resultado
            : (Array.isArray(resultado.results) ? resultado.results : []);

        const inscricao = inscricoes.find(
            item => String(item.id) === String(inscricaoId)
        );

        if (!inscricao) {
            throw new Error(
                'Inscrição não encontrada entre suas inscrições.'
            );
        }

        // O comprovante só pode ser exibido para inscrições confirmadas.
        if (inscricao.status !== 'confirmada') {
            throw new Error(
                'Esta inscrição ainda não está confirmada. Não é possível emitir o comprovante.'
            );
        }

        // =====================================
        // DADOS DO PARTICIPANTE
        // =====================================

        const usuarioResponse = await apiFetch('/usuarios/perfil/');

        if (!usuarioResponse.ok) {
            throw new Error(
                'Não foi possível carregar os dados do participante.'
            );
        }

        const usuario = await usuarioResponse.json();

        // Mesmo código do ingresso exibido em "Minhas Inscrições"
        // (gerado pelo backend como SGIE-<evento>-<inscrição>).
        const codigoIngresso =
            inscricao.codigo_ingresso ||
            (
                inscricao.evento !== null && inscricao.evento !== undefined
                    ? `SGIE-${String(inscricao.evento).padStart(4, '0')}-${String(inscricao.id).padStart(6, '0')}`
                    : `SGIE-${String(inscricao.id).padStart(6, '0')}`
            );

        preencher('comprovante-codigo', codigoIngresso);

        preencher(
            'comprovante-nome',
            usuario.nome_completo
        );

        preencher(
            'comprovante-cpf',
            formatarCPF(usuario.cpf_formatado || usuario.cpf)
        );

        preencher(
            'comprovante-email',
            usuario.email
        );

        // O backend ainda não possui tipo de credenciamento na inscrição:
        // mantém o valor padrão ("Participante") definido no HTML.

        // =====================================
        // DADOS DO EVENTO
        // =====================================

        preencher(
            'comprovante-evento',
            inscricao.evento_nome
        );

        preencher(
            'comprovante-data-evento',
            formatarData(inscricao.evento_data)
        );

        preencher(
            'comprovante-horario',
            formatarHorario(inscricao.evento_hora_inicio)
        );

        preencher(
            'comprovante-local',
            inscricao.evento_local
        );

        // =====================================
        // RESUMO FINANCEIRO
        // =====================================

        const eventoGratuito = inscricao.evento_e_gratuito === true;

        // Em eventos pagos, a cobrança é a fonte do valor e da situação.
        // Se a consulta falhar, o comprovante continua sendo emitido com
        // os dados do evento.
        const cobranca = eventoGratuito
            ? null
            : await buscarCobrancaDaInscricao(inscricao.id);

        let valorExibido = 'Não informado';

        if (eventoGratuito) {
            valorExibido = 'Gratuito';
        } else if (cobranca && cobranca.valor_final !== null && cobranca.valor_final !== undefined) {
            valorExibido = formatarMoeda(cobranca.valor_final);
        } else if (inscricao.evento_preco !== null && inscricao.evento_preco !== undefined) {
            valorExibido = formatarMoeda(inscricao.evento_preco);
        }

        preencher('comprovante-valor', valorExibido);

        preencher(
            'comprovante-financeiro-status',
            eventoGratuito
                ? 'Não se aplica'
                : descreverSituacaoCobranca(cobranca)
        );

        // =====================================
        // DATA DE EMISSÃO
        // =====================================

        preencher(
            'comprovante-data-emissao',
            `Inscrição registrada em ${formatarDataHora(inscricao.data_inscricao)}`
        );

        // =====================================
        // EXIBIR DOCUMENTO
        // =====================================

        documento.style.display = 'block';
        acoes.style.display = 'flex';

    }

    // =========================================
    // IMPRESSÃO
    // =========================================

    if (botaoImprimir) {

        botaoImprimir.addEventListener('click', () => {
            window.print();
        });

    }

    // =========================================
    // INICIALIZAÇÃO
    // =========================================

    try {

        await carregarComprovante();

    } catch (error) {

        console.error('Erro ao carregar comprovante:', error);

        if (documento) documento.style.display = 'none';
        if (acoes) acoes.style.display = 'none';

        mensagem(
            error.message ||
            'Não foi possível emitir o comprovante.'
        );

    }

});
