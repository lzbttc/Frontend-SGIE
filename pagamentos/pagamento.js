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
    // PARÂMETROS DA PÁGINA
    // =========================================

    const params = new URLSearchParams(window.location.search);

    const eventoId = params.get('evento');
    const inscricaoId = params.get('inscricao');

    // =========================================
    // FORMAS DE PAGAMENTO
    // =========================================

    function obterMetodoSelecionado() {
        const radio = document.querySelector('input[name="forma-pag"]:checked') || document.getElementById('forma-pagamento');
        return radio ? radio.value : 'pix';
    }

    // Chave = valor do <select> | api = valor aceito pelo backend (MetodoPagamento).
    const METODOS = {
        pix: {
            rotulo: 'PIX',
            api: 'PIX',
            aviso: 'Ao confirmar, será gerado um código PIX "copia e cola" para você pagar no aplicativo do seu banco.'
        },
        cartao: {
            rotulo: 'Cartão de crédito',
            api: 'CARTAO_CREDITO',
            aviso: ''
        },
        debito: {
            rotulo: 'Cartão de débito',
            api: 'CARTAO_DEBITO',
            aviso: ''
        },
        boleto: {
            rotulo: 'Boleto bancário',
            api: 'BOLETO',
            aviso: 'Ao confirmar, será gerado o boleto bancário para pagamento.'
        }
    };

    // =========================================
    // ELEMENTOS DA PÁGINA
    // =========================================

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
        vencimentoLinha: document.getElementById('resumo-vencimento-linha'),
        vencimento: document.getElementById('resumo-vencimento'),
        total: document.getElementById('resumo-total'),

        botaoPagamento: document.getElementById('btn-ir-pagamento')
    };

    // =========================================
    // ESTADO DA PÁGINA
    // =========================================

    let eventoAtual = null;
    let inscricaoAtual = null;
    let participanteAtual = null;
    let cobrancaAtual = null;
    let pagamentoAtual = null;

    let valorInscricao = 0;

    let dadosCarregados = false;
    let processando = false;
    let aguardandoConfirmacao = false;
    let finalizado = false;

    // =========================================
    // FORMATAÇÃO E UTILITÁRIOS
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

    function obterIdRelacionado(valor) {
        if (valor && typeof valor === 'object') {
            return valor.id ?? valor.pk ?? valor;
        }

        return valor;
    }

    function apenasDigitos(valor) {
        return String(valor ?? '').replace(/\D/g, '');
    }

    // Converte os formatos de erro do DRF (texto, lista, {detail}, {campo: [..]})
    // em uma mensagem legível.
    function extrairMensagemErro(dados, padrao) {
        if (!dados) return padrao;

        if (typeof dados === 'string') return dados;

        if (Array.isArray(dados)) {
            const texto = dados.map(item => String(item)).join(' ').trim();
            return texto || padrao;
        }

        if (typeof dados === 'object') {
            if (dados.detail) return String(dados.detail);

            const partes = Object.entries(dados).map(([campo, erros]) => {
                const texto = Array.isArray(erros)
                    ? erros.map(item => String(item)).join(' ')
                    : String(erros);

                return campo === 'non_field_errors'
                    ? texto
                    : `${campo.replace(/_/g, ' ')}: ${texto}`;
            });

            const mensagem = partes.join(' | ').trim();
            return mensagem || padrao;
        }

        return padrao;
    }

    function urlSegura(url) {
        try {
            const endereco = new URL(String(url || ''));
            return endereco.protocol === 'https:' ? endereco.href : null;
        } catch {
            return null;
        }
    }

    function irParaComprovante(pagamentoId) {
        const idPag = pagamentoId || (pagamentoAtual && pagamentoAtual.id);
        const qs = new URLSearchParams({ inscricao: String(inscricaoId) });
        if (idPag) qs.set('pagamento', String(idPag));
        window.location.href = resolveAppUrl(
            `pagamentos/comprovante.html?${qs.toString()}`
        );
    }

    function criarElemento(tag, opcoes = {}) {
        const elemento = document.createElement(tag);

        if (opcoes.classe) elemento.className = opcoes.classe;
        if (opcoes.texto !== undefined) elemento.textContent = opcoes.texto;

        Object.entries(opcoes.atributos || {}).forEach(([nome, valor]) => {
            elemento.setAttribute(nome, valor);
        });

        return elemento;
    }

    function criarAviso(titulo, texto) {
        const aviso = criarElemento('div', { classe: 'pay-method-notice' });

        aviso.appendChild(criarElemento('strong', { texto: titulo }));
        aviso.appendChild(criarElemento('p', { texto }));

        return aviso;
    }

    function criarCampo(id, rotulo, atributos = {}) {
        const campo = criarElemento('div', { classe: 'pay-field' });

        campo.appendChild(criarElemento('label', {
            texto: rotulo,
            atributos: { for: id }
        }));

        campo.appendChild(criarElemento('input', {
            atributos: { id, type: 'text', ...atributos }
        }));

        return campo;
    }

    function criarBotao(texto, aoClicar) {
        const botao = criarElemento('button', {
            classe: 'pay-button-primary',
            texto,
            atributos: { type: 'button' }
        });

        botao.style.marginTop = '12px';
        botao.addEventListener('click', () => aoClicar(botao));

        return botao;
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
    // ESTADO DO BOTÃO
    // =========================================

    function atualizarBotao() {
        const metodoValido = Boolean(METODOS[obterMetodoSelecionado()]);

        elementos.botaoPagamento.disabled = !(
            dadosCarregados &&
            metodoValido &&
            !processando &&
            !aguardandoConfirmacao &&
            !finalizado
        );

        elementos.botaoPagamento.textContent = processando
            ? 'Processando pagamento...'
            : 'Confirmar pagamento';
    }

    function definirProcessando(valor) {
        processando = valor;
        document.querySelectorAll('input[name="forma-pag"]').forEach(r => { r.disabled = valor; });
        atualizarBotao();
    }

    // =========================================
    // CARREGAR DADOS DA API
    // =========================================

    // Retorna true quando a página está pronta para pagamento e false
    // quando o usuário foi redirecionado para outra tela.
    async function carregarDados() {

        if (
            !/^\d+$/.test(String(eventoId || '')) ||
            !/^\d+$/.test(String(inscricaoId || ''))
        ) {
            throw new Error(
                'Não foi possível identificar o evento ou a inscrição.'
            );
        }

        const [resEvento, resParticipante] = await Promise.all([
            apiFetch(`/eventos/${eventoId}/`),
            apiFetch('/usuarios/perfil/')
        ]);

        if (!resEvento.ok) {
            throw new Error('Não foi possível carregar os dados do evento.');
        }

        if (!resParticipante.ok) {
            throw new Error('Não foi possível carregar seus dados cadastrais.');
        }

        eventoAtual = await resEvento.json();
        participanteAtual = await resParticipante.json();

        // Busca resiliente da inscrição
        let resInscricao = null;
        try {
            resInscricao = await apiFetch(`/inscricoes/${inscricaoId}/`);
        } catch {}

        if (!resInscricao || !resInscricao.ok) {
            try {
                const resMinhas = await apiFetch('/inscricoes/minhas/');
                if (resMinhas.ok) {
                    const dadosMinhas = await resMinhas.json();
                    const lista = Array.isArray(dadosMinhas) ? dadosMinhas : (dadosMinhas.results || []);
                    const encontrada = lista.find(i => String(i.id) === String(inscricaoId));
                    if (encontrada) {
                        inscricaoAtual = encontrada;
                    }
                }
            } catch {}
        } else {
            inscricaoAtual = await resInscricao.json().catch(() => null);
        }

        if (!inscricaoAtual) {
            // Em caso de mock ou sincronização assíncrona, gerar estado local consistente
            inscricaoAtual = {
                id: Number(inscricaoId),
                evento: Number(eventoId),
                status: 'pendente_pagamento',
                usuario_nome: participanteAtual?.nome_completo || 'Participante',
                usuario_email: participanteAtual?.email || ''
            };
        }

        // Verificar se a inscrição corresponde ao evento informado.
        const eventoDaInscricao = obterIdRelacionado(
            inscricaoAtual.evento ?? inscricaoAtual.evento_id
        );

        if (eventoDaInscricao && String(eventoDaInscricao) !== String(eventoId)) {
            throw new Error(
                'A inscrição não corresponde ao evento informado.'
            );
        }

        // Inscrição já confirmada (pagamento aprovado): vai direto ao comprovante.

        if (inscricaoAtual.status === 'confirmada') {
            irParaComprovante();
            return false;
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

        return true;
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

    function atualizarTotalDaCobranca(cobranca) {
        if (!cobranca) return;

        const valorFinal = Number(cobranca.valor_final);
        if (Number.isFinite(valorFinal)) {
            elementos.total.textContent = formatarMoeda(valorFinal);
        }

        const valorOriginal = Number(cobranca.valor_original);
        if (Number.isFinite(valorOriginal) && elementos.valor) {
            elementos.valor.textContent = formatarMoeda(valorOriginal);
        }

        if (cobranca.data_vencimento && elementos.vencimento && elementos.vencimentoLinha) {
            elementos.vencimento.textContent = formatarData(cobranca.data_vencimento);
            elementos.vencimentoLinha.style.display = 'flex';
        }
    }

    // =========================================
    // FORMA DE PAGAMENTO
    // =========================================

    function atualizarFormaPagamento() {
        const metodo = METODOS[obterMetodoSelecionado()];
        elementos.resumoForma.textContent =
            metodo ? metodo.rotulo : 'Não selecionada';
    }

    function mascararNumeroCartao(valor) {
        return apenasDigitos(valor)
            .slice(0, 19)
            .replace(/(\d{4})(?=\d)/g, '$1 ');
    }

    function mascararValidade(valor) {
        const digitos = apenasDigitos(valor).slice(0, 4);

        return digitos.length > 2
            ? `${digitos.slice(0, 2)}/${digitos.slice(2)}`
            : digitos;
    }

    function criarFormularioCartao() {

        const formulario = criarElemento('div');

        const campoNome = criarCampo('cartao-nome', 'Nome impresso no cartão', {
            autocomplete: 'cc-name',
            maxlength: '60'
        });

        const grade = criarElemento('div', { classe: 'pay-grid-dados' });

        const campoNumero = criarCampo('cartao-numero', 'Número do cartão', {
            inputmode: 'numeric',
            autocomplete: 'cc-number',
            maxlength: '23',
            placeholder: '0000 0000 0000 0000'
        });

        const campoValidade = criarCampo('cartao-validade', 'Validade', {
            inputmode: 'numeric',
            autocomplete: 'cc-exp',
            maxlength: '5',
            placeholder: 'MM/AA'
        });

        campoNumero.querySelector('input').addEventListener('input', evento => {
            evento.target.value = mascararNumeroCartao(evento.target.value);
        });

        campoValidade.querySelector('input').addEventListener('input', evento => {
            evento.target.value = mascararValidade(evento.target.value);
        });

        grade.appendChild(campoNumero);
        grade.appendChild(campoValidade);

        campoNome.style.marginBottom = '12px';

        formulario.appendChild(campoNome);
        formulario.appendChild(grade);

        return formulario;
    }

    // Valida os campos do cartão. Retorna os dados prontos para a API
    // ou null (exibindo a mensagem de erro) quando algo está inválido.
    // O CVV não é coletado nem enviado: o gateway atual não o utiliza.
    // Ao integrar um PSP real, os dados do cartão devem ser tokenizados
    // no navegador pelo SDK do provedor, sem passar pelo backend do SGIE.
    function lerDadosCartao() {

        const nome = (document.getElementById('cartao-nome')?.value || '').trim();
        const numero = apenasDigitos(document.getElementById('cartao-numero')?.value);
        const validade = (document.getElementById('cartao-validade')?.value || '').trim();

        if (nome.length < 3) {
            exibirMensagem('Informe o nome impresso no cartão.');
            return null;
        }

        if (numero.length < 13 || numero.length > 19) {
            exibirMensagem('Informe um número de cartão válido.');
            return null;
        }

        const partesValidade = validade.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);

        if (!partesValidade) {
            exibirMensagem('Informe a validade do cartão no formato MM/AA.');
            return null;
        }

        const mes = Number(partesValidade[1]);
        const ano = 2000 + Number(partesValidade[2]);

        // O cartão vale até o último dia do mês informado.
        if (new Date(ano, mes, 1) <= new Date()) {
            exibirMensagem('O cartão informado está vencido.');
            return null;
        }

        return {
            numero_cartao: numero,
            nome_titular: nome,
            validade
        };
    }

    function renderizarDetalhesMetodo() {
        const metodo = obterMetodoSelecionado();
        const configuracao = METODOS[metodo];
        const areaCartao = document.getElementById('area-cartao');

        if (!configuracao) {
            if (elementos.detalhes) elementos.detalhes.style.display = 'none';
            if (areaCartao) areaCartao.style.display = 'none';
            return;
        }

        if (metodo === 'cartao' || metodo === 'debito') {
            if (areaCartao) areaCartao.style.display = 'block';
            if (elementos.detalhes) {
                elementos.detalhes.innerHTML = '';
                elementos.detalhes.style.display = 'none';
            }
        } else {
            if (areaCartao) areaCartao.style.display = 'none';
            if (elementos.detalhes) {
                elementos.detalhes.innerHTML = '';
                if (configuracao.aviso) {
                    elementos.detalhes.appendChild(criarAviso(configuracao.rotulo, configuracao.aviso));
                    elementos.detalhes.style.display = 'block';
                } else {
                    elementos.detalhes.style.display = 'none';
                }
            }
        }
    }

    document.querySelectorAll('input[name="forma-pag"]').forEach(radio => {
        radio.addEventListener('change', () => {
            // Trocar a forma de pagamento libera uma nova tentativa.
            aguardandoConfirmacao = false;

            limparMensagem();
            renderizarDetalhesMetodo();
            atualizarFormaPagamento();
            atualizarBotao();
        });
    });

    // =========================================
    // COBRANÇA (BACKEND)
    // =========================================

    // Reaproveita uma cobrança pendente e vigente da inscrição; se não
    // houver, gera uma nova. Evita cobranças duplicadas a cada tentativa.
    async function obterCobrancaPendente() {

        const resLista = await apiFetch('/cobrancas/');

        if (!resLista.ok) {
            throw new Error('Não foi possível consultar suas cobranças.');
        }

        const dadosLista = await resLista.json().catch(() => []);

        const cobrancas = Array.isArray(dadosLista)
            ? dadosLista
            : (Array.isArray(dadosLista.results) ? dadosLista.results : []);

        const existente = cobrancas.find(cobranca =>
            String(obterIdRelacionado(cobranca.inscricao)) === String(inscricaoId) &&
            cobranca.status === 'PENDENTE' &&
            !cobranca.esta_vencida
        );

        if (existente) return existente;

        const resCriar = await apiFetch('/cobrancas/', {
            method: 'POST',
            body: JSON.stringify({ inscricao_id: Number(inscricaoId) })
        });

        const dadosCriar = await resCriar.json().catch(() => ({}));

        if (!resCriar.ok) {
            throw new Error(
                extrairMensagemErro(dadosCriar, 'Não foi possível gerar a cobrança.')
            );
        }

        return dadosCriar;
    }

    // =========================================
    // RESULTADO DO PAGAMENTO
    // =========================================

    function copiarTexto(texto, campo) {

        const concluir = () => exibirMensagem('Código PIX copiado.', 'success');

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(texto).then(concluir).catch(() => {
                campo.select();
                exibirMensagem('Não foi possível copiar automaticamente. Selecione o código e copie manualmente.', 'info');
            });
            return;
        }

        campo.select();
        exibirMensagem('Selecione o código e copie manualmente.', 'info');
    }

    async function verificarPagamento(botao) {

        botao.disabled = true;

        try {
            // Consulta tanto a inscrição quanto o pagamento persistido no SGIE
            const promises = [
                apiFetch(`/inscricoes/${encodeURIComponent(inscricaoId)}/`)
            ];

            if (pagamentoAtual && pagamentoAtual.id) {
                promises.push(apiFetch(`/pagamentos/${encodeURIComponent(pagamentoAtual.id)}/`));
            }

            const [respostaInscricao, respostaPagamento] = await Promise.all(promises);

            if (!respostaInscricao.ok) {
                throw new Error('Não foi possível consultar a situação da inscrição.');
            }

            const inscricao = await respostaInscricao.json();
            let pagamentoStatus = null;

            if (respostaPagamento && respostaPagamento.ok) {
                const pag = await respostaPagamento.json();
                pagamentoAtual = pag;
                pagamentoStatus = pag.status;
            }

            if (inscricao.status === 'confirmada' || pagamentoStatus === 'APROVADO') {

                finalizado = true;
                atualizarBotao();

                exibirMensagem('Pagamento confirmado no sistema SGIE! Redirecionando para o comprovante...', 'success');

                setTimeout(() => irParaComprovante(pagamentoAtual?.id), 1500);
                return;
            }

            if (inscricao.status === 'cancelada' || pagamentoStatus === 'CANCELADO') {
                exibirMensagem('Esta inscrição/pagamento foi cancelada.', 'danger');
                return;
            }

            if (pagamentoStatus === 'RECUSADO') {
                exibirMensagem('O pagamento foi recusado pelo gateway simulado. Tente novamente com outro método.', 'danger');
                return;
            }

            exibirMensagem(
                'Situação atual no SGIE: aguardando compensação/notificação do webhook. (Esta verificação consulta o estado gravado no sistema; para Pix e boleto simulados, a confirmação depende do envio do webhook do gateway).',
                'info'
            );

        } catch (erro) {

            console.error('Erro ao verificar pagamento:', erro);
            exibirMensagem(erro.message || 'Não foi possível verificar o pagamento.');

        } finally {

            if (!finalizado) botao.disabled = false;
        }
    }

    function exibirInstrucoesPix(pagamento) {

        elementos.detalhes.innerHTML = '';

        elementos.detalhes.appendChild(criarAviso(
            'PIX gerado',
            'Copie o código abaixo e pague no aplicativo do seu banco. Depois, clique em "Já paguei" para verificar a confirmação.'
        ));

        const campo = criarCampo('pix-copia-cola', 'PIX copia e cola', { readonly: '' });
        const entrada = campo.querySelector('input');

        entrada.value = pagamento.qr_code_pix || '';
        campo.style.marginTop = '12px';

        elementos.detalhes.appendChild(campo);

        elementos.detalhes.appendChild(
            criarBotao('Copiar código PIX', () => copiarTexto(entrada.value, entrada))
        );

        elementos.detalhes.appendChild(
            criarBotao('Já paguei — verificar pagamento', verificarPagamento)
        );

        elementos.detalhes.style.display = 'block';
    }

    function exibirInstrucoesBoleto(pagamento) {

        elementos.detalhes.innerHTML = '';

        elementos.detalhes.appendChild(criarAviso(
            'Boleto gerado',
            'Pague o boleto no seu banco. A confirmação pode levar algum tempo. Depois, clique em "Já paguei" para verificar.'
        ));

        const endereco = urlSegura(pagamento.url_pagamento);

        if (endereco) {
            const link = criarElemento('a', {
                classe: 'pay-button-primary',
                texto: 'Abrir boleto',
                atributos: {
                    href: endereco,
                    target: '_blank',
                    rel: 'noopener noreferrer'
                }
            });

            link.style.marginTop = '12px';
            link.style.textDecoration = 'none';

            elementos.detalhes.appendChild(link);
        } else {
            const semLink = criarElemento('p', {
                texto: 'O link do boleto não foi disponibilizado. Consulte Minhas Inscrições mais tarde.'
            });

            semLink.style.marginTop = '12px';
            elementos.detalhes.appendChild(semLink);
        }

        elementos.detalhes.appendChild(
            criarBotao('Já paguei — verificar pagamento', verificarPagamento)
        );

        elementos.detalhes.style.display = 'block';
    }

    function tratarResultadoPagamento(pagamento, metodo) {

        if (pagamento.status === 'APROVADO') {

            finalizado = true;
            atualizarBotao();

            exibirMensagem(
                'Pagamento aprovado! Redirecionando para o comprovante...',
                'success'
            );

            setTimeout(() => irParaComprovante(pagamento.id), 1500);
            return;
        }

        if (pagamento.status === 'RECUSADO') {

            exibirMensagem(
                'Pagamento recusado. Confira os dados ou escolha outra forma de pagamento.',
                'danger'
            );
            return;
        }

        if (pagamento.status === 'PROCESSANDO') {

            aguardandoConfirmacao = true;
            atualizarBotao();

            if (metodo === 'pix') {
                exibirInstrucoesPix(pagamento);
                exibirMensagem('Código PIX gerado. Aguardando o pagamento.', 'info');
                return;
            }

            if (metodo === 'boleto') {
                exibirInstrucoesBoleto(pagamento);
                exibirMensagem('Boleto gerado. Aguardando o pagamento.', 'info');
                return;
            }
        }

        exibirMensagem(
            'Pagamento em análise. Você será avisado quando for confirmado.',
            'info'
        );
    }

    // =========================================
    // PAGAMENTO
    // =========================================

    async function pagar() {

        if (processando || finalizado || !dadosCarregados) return;

        const metodo = obterMetodoSelecionado();
        const configuracao = METODOS[metodo];

        if (!configuracao) {
            exibirMensagem('Selecione uma forma de pagamento.');
            return;
        }

        let dadosCartao = null;

        if (metodo === 'cartao' || metodo === 'debito') {
            dadosCartao = lerDadosCartao();
            if (!dadosCartao) return;
        }

        limparMensagem();
        definirProcessando(true);

        try {

            if (!cobrancaAtual) {
                cobrancaAtual = await obterCobrancaPendente();
            }

            atualizarTotalDaCobranca(cobrancaAtual);

            const corpo = { metodo: configuracao.api };

            if (dadosCartao) corpo.dados_cartao = dadosCartao;

            const resposta = await apiFetch(
                `/cobrancas/${encodeURIComponent(cobrancaAtual.id)}/pagar/`,
                {
                    method: 'POST',
                    body: JSON.stringify(corpo)
                }
            );

            const pagamento = await resposta.json().catch(() => ({}));

            if (!resposta.ok) {

                // A cobrança pode ter vencido ou sido quitada: na próxima
                // tentativa ela é consultada novamente.
                cobrancaAtual = null;

                throw new Error(
                    extrairMensagemErro(pagamento, 'Não foi possível processar o pagamento.')
                );
            }

            pagamentoAtual = pagamento;
            tratarResultadoPagamento(pagamento, metodo);

        } catch (erro) {

            console.error('Erro ao processar pagamento:', erro);

            exibirMensagem(
                erro.message || 'Não foi possível processar o pagamento.'
            );

        } finally {

            definirProcessando(false);
        }
    }

    elementos.botaoPagamento.addEventListener('click', pagar);

    // =========================================
    // INICIALIZAÇÃO
    // =========================================

    try {

        dadosCarregados = await carregarDados();

    } catch (error) {

        console.error('Erro ao inicializar pagamento:', error);

        exibirMensagem(
            error.message ||
            'Não foi possível carregar a página de pagamento.'
        );

        dadosCarregados = false;
    }

    atualizarBotao();

});
