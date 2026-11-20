
document.addEventListener('DOMContentLoaded', async () => {

    if (!isAuthenticated()) {
        window.location.href = resolveAppUrl('usuarios/login.html');
        return;
    }

    atualizarCabecalhoUsuario('comprovante');

    const params = new URLSearchParams(window.location.search);
    const inscricaoId = params.get('inscricao');

    const alerta = document.getElementById('comprovante-alerta');
    const documento = document.getElementById('comprovante-documento');
    const acoes = document.getElementById('comprovante-acoes');

    function mensagem(texto, tipo = 'danger') {
        alerta.textContent = texto;
        alerta.style.display = 'block';
        alerta.className = `pay-alert-message pay-alert-${tipo}`;
    }

    function preencher(id, valor) {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = valor || '—';
    }

    function formatarCPF(cpf) {
        const numeros = String(cpf || '').replace(/\D/g, '');

        if (numeros.length !== 11) return 'Não informado';

        return `***.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-**`;
    }

    function formatarData(data) {
        if (!data) return '—';

        const partes = data.split('-');

        if (partes.length !== 3) return data;

        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    function formatarHorario(horario) {
        if (!horario) return '—';
        return horario.substring(0, 5);
    }

    function formatarDataHora(data) {
        if (!data) return '—';

        const dataObj = new Date(data);

        if (Number.isNaN(dataObj.getTime())) return '—';

        return dataObj.toLocaleString('pt-BR');
    }

    async function carregarComprovante() {

        if (!inscricaoId) {
            throw new Error('Identificador da inscrição não informado.');
        }

        const response = await apiFetch('/inscricoes/minhas/');

        if (!response.ok) {
            throw new Error('Não foi possível consultar suas inscrições.');
        }

        const resultado = await response.json();

        const inscricoes = Array.isArray(resultado)
            ? resultado
            : (resultado.results || []);

        const inscricao = inscricoes.find(
            item => String(item.id) === String(inscricaoId)
        );

        if (!inscricao) {
            throw new Error('Inscrição não encontrada.');
        }

        if (inscricao.status !== 'confirmada') {
            throw new Error(
                'Esta inscrição ainda não está confirmada. Não é possível emitir o comprovante.'
            );
        }

        const usuarioResponse = await apiFetch('/usuarios/perfil/');

        if (!usuarioResponse.ok) {
            throw new Error('Não foi possível carregar os dados do participante.');
        }

        const usuario = await usuarioResponse.json();

        preencher('comprovante-codigo', `SGIE-${String(inscricao.id).padStart(6, '0')}`);
        preencher('comprovante-nome', usuario.nome_completo);
        preencher('comprovante-cpf', formatarCPF(usuario.cpf_formatado || usuario.cpf));
        preencher('comprovante-email', usuario.email);

        preencher('comprovante-evento', inscricao.evento_nome);
        preencher('comprovante-data-evento', formatarData(inscricao.evento_data));
        preencher('comprovante-horario', formatarHorario(inscricao.evento_hora_inicio));
        preencher('comprovante-local', inscricao.evento_local);

        preencher(
            'comprovante-valor',
            inscricao.evento_e_gratuito
                ? 'Gratuito'
                : formatarMoeda(inscricao.evento_preco)
        );

        preencher(
            'comprovante-financeiro-status',
            inscricao.evento_e_gratuito
                ? 'Não se aplica'
                : 'Não informado pelo sistema'
        );

        preencher(
            'comprovante-data-emissao',
            `Inscrição registrada em ${formatarDataHora(inscricao.data_inscricao)}`
        );

        documento.style.display = 'block';
        acoes.style.display = 'flex';
    }

    document.getElementById('btn-imprimir').addEventListener('click', () => {
        window.print();
    });

    try {
        await carregarComprovante();

    } catch (error) {
        console.error('Erro ao carregar comprovante:', error);

        documento.style.display = 'none';
        acoes.style.display = 'none';

        mensagem(error.message || 'Não foi possível emitir o comprovante.');
    }

});
