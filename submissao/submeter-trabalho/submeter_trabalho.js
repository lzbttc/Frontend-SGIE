/* SGIE — submissao/submeter-trabalho/submeter_trabalho.js
 * Formulário de submissão acadêmica (Rascunho e Envio Final).
 * Endpoints:
 *   - GET /areas/
 *   - GET /eventos/
 *   - POST /submissoes/ (cria rascunho JSON)
 *   - PATCH /submissoes/{uuid}/ (atualiza rascunho)
 *   - POST /submissoes/{uuid}/submeter/ (envia arquivo multipart)
 */

document.addEventListener('DOMContentLoaded', async () => {
    if (!isAuthenticated()) {
        window.location.href = resolveAppUrl('usuarios/login/login.html');
        return;
    }

    atualizarCabecalhoUsuario('submissoes');

    const params = new URLSearchParams(window.location.search);
    const submissaoId = params.get('id');
    const eventoPredefinidoId = params.get('evento');

    preencherDadosAutorPrincipal();
    configurarUploadArquivo();

    await carregarAreasTematicas();
    await carregarEventos(eventoPredefinidoId);

    if (submissaoId) {
        await carregarSubmissaoExistente(submissaoId);
    }

    const btnRascunho = document.getElementById('btn-salvar-rascunho');
    const btnSubmeter = document.getElementById('btn-submeter-final');

    if (btnRascunho) {
        btnRascunho.addEventListener('click', () => salvarSubmissao(false));
    }
    if (btnSubmeter) {
        btnSubmeter.addEventListener('click', () => salvarSubmissao(true));
    }

    const selectEvento = document.getElementById('sub-evento');
    if (selectEvento) {
        selectEvento.addEventListener('change', () => atualizarResumoEvento(selectEvento.value));
    }
});

let _arquivoSelecionado = null;
let _submissaoAtualUuid = null;
let _eventosDisponiveis = [];

function preencherDadosAutorPrincipal() {
    const user = getUser();
    if (!user) return;

    const elNome = document.getElementById('a1-nome');
    const elMail = document.getElementById('a1-mail');
    const elAfil = document.getElementById('a1-afil');

    if (elNome) elNome.value = user.nome_completo || user.email || '';
    if (elMail) elMail.value = user.email || '';
    if (elAfil && user.instituicao) elAfil.value = user.instituicao;
}

async function carregarAreasTematicas() {
    const selectArea = document.getElementById('t-area');
    if (!selectArea) return;

    try {
        const resp = await apiFetch('/areas/');
        if (resp.ok) {
            const areas = await resp.json();
            const lista = Array.isArray(areas) ? areas : (areas.results || []);

            selectArea.innerHTML = '<option value="">Selecione uma área...</option>';
            lista.forEach(a => {
                const opt = document.createElement('option');
                opt.value = a.id;
                opt.textContent = a.nome;
                selectArea.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('[submeter_trabalho] Erro ao carregar áreas:', e);
        selectArea.innerHTML = '<option value="">Não foi possível carregar áreas</option>';
    }
}

async function carregarEventos(eventoPredefinidoId) {
    const selectEvento = document.getElementById('sub-evento');
    if (!selectEvento) return;

    try {
        const resp = await apiFetch('/eventos/');
        if (resp.ok) {
            const dados = await resp.json();
            _eventosDisponiveis = Array.isArray(dados) ? dados : (dados.results || []);

            selectEvento.innerHTML = '<option value="">Selecione um evento...</option>';
            _eventosDisponiveis.forEach(ev => {
                const opt = document.createElement('option');
                opt.value = ev.id;
                opt.textContent = `${ev.nome} (${formatarDataSimples(ev.data)})`;
                selectEvento.appendChild(opt);
            });

            if (eventoPredefinidoId && _eventosDisponiveis.some(e => String(e.id) === String(eventoPredefinidoId))) {
                selectEvento.value = eventoPredefinidoId;
                atualizarResumoEvento(eventoPredefinidoId);
            }
        }
    } catch (e) {
        console.error('[submeter_trabalho] Erro ao carregar eventos:', e);
        selectEvento.innerHTML = '<option value="">Não foi possível carregar eventos</option>';
    }
}

function atualizarResumoEvento(eventoId) {
    const asideNome = document.getElementById('aside-evento-nome');
    const asideAlerta = document.getElementById('aside-evento-alerta');
    const asidePrazo = document.getElementById('aside-evento-prazo');

    if (!eventoId) {
        if (asideNome) asideNome.textContent = 'Selecione um evento';
        if (asideAlerta) asideAlerta.style.display = 'none';
        return;
    }

    const ev = _eventosDisponiveis.find(e => String(e.id) === String(eventoId));
    if (!ev) return;

    if (asideNome) asideNome.textContent = ev.nome;

    if (ev.regra_submissao && ev.regra_submissao.data_hora_fim) {
        if (asideAlerta) asideAlerta.style.display = 'flex';
        const dataFim = new Date(ev.regra_submissao.data_hora_fim);
        const fimFmt = dataFim.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        if (asidePrazo) asidePrazo.innerHTML = `<b>Prazo de submissão:</b> até ${fimFmt}`;
    } else {
        if (asideAlerta) asideAlerta.style.display = 'none';
    }
}

async function carregarSubmissaoExistente(uuid) {
    _submissaoAtualUuid = uuid;
    try {
        const resp = await apiFetch(`/submissoes/${encodeURIComponent(uuid)}/`);
        if (!resp.ok) {
            showAlert('mensagem-alerta', 'Submissão não encontrada ou indisponível.', 'danger');
            return;
        }

        const sub = await resp.json();

        // Preenche campos
        const elEvento = document.getElementById('sub-evento');
        const elTitulo = document.getElementById('t-titulo');
        const elTipo = document.getElementById('t-tipo');
        const elArea = document.getElementById('t-area');
        const elAbstract = document.getElementById('t-abstract');
        const elResumo = document.getElementById('t-resumo');
        const elKw = document.getElementById('t-kw');
        const elDesc = document.getElementById('t-desc');

        if (elEvento && sub.evento) {
            elEvento.value = sub.evento.id || sub.evento;
            atualizarResumoEvento(elEvento.value);
        }
        if (elTitulo) elTitulo.value = sub.titulo || '';
        if (elTipo && sub.tipo) elTipo.value = sub.tipo;
        if (elArea && sub.area) elArea.value = sub.area.id || sub.area;
        if (elAbstract) elAbstract.value = sub.abstract || '';
        if (elResumo) elResumo.value = sub.resumo || '';
        if (elKw) elKw.value = sub.palavras_chave || '';
        if (elDesc) elDesc.value = sub.descricao || '';

        // Campos do autor
        if (sub.afiliacao_institucional) {
            const elAfil = document.getElementById('a1-afil');
            if (elAfil) elAfil.value = sub.afiliacao_institucional;
        }
        if (sub.maior_titulacao) {
            const elTit = document.getElementById('a1-tit');
            if (elTit) elTit.value = sub.maior_titulacao;
        }
        if (sub.lattes_url) {
            const elLattes = document.getElementById('a1-lattes');
            if (elLattes) elLattes.value = sub.lattes_url;
        }
        if (sub.linkedin_url) {
            const elIn = document.getElementById('a1-in');
            if (elIn) elIn.value = sub.linkedin_url;
        }

        // Se já tem arquivo enviado
        if (sub.arquivo) {
            exibirArquivoSelecionado({
                name: 'Arquivo já vinculado à submissão',
                size: 0
            });
        }

    } catch (e) {
        console.error('[submeter_trabalho] Erro ao carregar:', e);
        showAlert('mensagem-alerta', 'Erro ao carregar os dados da submissão.', 'danger');
    }
}

function configurarUploadArquivo() {
    const dropArea = document.getElementById('drop-area');
    const inputArquivo = document.getElementById('input-arquivo');
    const btnEscolher = document.getElementById('btn-escolher-arquivo');
    const btnRemover = document.getElementById('btn-remover-arquivo');

    if (btnEscolher && inputArquivo) {
        btnEscolher.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            inputArquivo.click();
        });
    }

    if (dropArea && inputArquivo) {
        dropArea.addEventListener('click', () => inputArquivo.click());

        ['dragenter', 'dragover'].forEach(ev => {
            dropArea.addEventListener(ev, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropArea.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(ev => {
            dropArea.addEventListener(ev, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropArea.classList.remove('dragover');
            });
        });

        dropArea.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                validarEGuardarArquivo(e.dataTransfer.files[0]);
            }
        });

        inputArquivo.addEventListener('change', () => {
            if (inputArquivo.files && inputArquivo.files.length > 0) {
                validarEGuardarArquivo(inputArquivo.files[0]);
            }
        });
    }

    if (btnRemover) {
        btnRemover.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            _arquivoSelecionado = null;
            if (inputArquivo) inputArquivo.value = '';
            document.getElementById('preview-arquivo').style.display = 'none';
        });
    }
}

function validarEGuardarArquivo(file) {
    if (!file) return;

    const maxBytes = 20 * 1024 * 1024; // 20 MB
    if (file.size > maxBytes) {
        showAlert('mensagem-alerta', 'O arquivo selecionado excede o limite máximo permitido de 20 MB.', 'danger');
        return;
    }

    const extensoesValidas = ['.pdf', '.doc', '.docx'];
    const nome = file.name.toLowerCase();
    const valida = extensoesValidas.some(ext => nome.endsWith(ext));

    if (!valida) {
        showAlert('mensagem-alerta', 'Formato de arquivo inválido. Por favor, envie arquivos nos formatos PDF, DOC ou DOCX.', 'danger');
        return;
    }

    clearAlert('mensagem-alerta');
    _arquivoSelecionado = file;
    exibirArquivoSelecionado(file);
}

function exibirArquivoSelecionado(file) {
    const preview = document.getElementById('preview-arquivo');
    const elNome = document.getElementById('arquivo-nome');
    const elTamanho = document.getElementById('arquivo-tamanho');

    if (preview && elNome && elTamanho) {
        elNome.textContent = file.name;
        elTamanho.textContent = file.size > 0 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'Arquivo anexado';
        preview.style.display = 'flex';
    }
}

async function salvarSubmissao(submeterDefinitivo) {
    clearAlert('mensagem-alerta');

    const eventoId = document.getElementById('sub-evento')?.value;
    const titulo = document.getElementById('t-titulo')?.value?.trim();
    const tipo = document.getElementById('t-tipo')?.value;
    const areaId = document.getElementById('t-area')?.value;
    const abstract = document.getElementById('t-abstract')?.value?.trim();
    const resumo = document.getElementById('t-resumo')?.value?.trim();
    const palavrasChave = document.getElementById('t-kw')?.value?.trim();
    const descricao = document.getElementById('t-desc')?.value?.trim();

    const afiliacao = document.getElementById('a1-afil')?.value?.trim();
    const titulacao = document.getElementById('a1-tit')?.value;
    const lattes = document.getElementById('a1-lattes')?.value?.trim();
    const linkedin = document.getElementById('a1-in')?.value?.trim();

    if (!eventoId) {
        showAlert('mensagem-alerta', 'Por favor, selecione o evento acadêmico.', 'warning');
        document.getElementById('sub-evento')?.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    if (!titulo) {
        showAlert('mensagem-alerta', 'O título do trabalho é obrigatório.', 'warning');
        document.getElementById('t-titulo')?.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    if (!areaId) {
        showAlert('mensagem-alerta', 'Por favor, selecione a área temática do trabalho.', 'warning');
        document.getElementById('t-area')?.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    if (!abstract) {
        showAlert('mensagem-alerta', 'O abstract do trabalho é obrigatório.', 'warning');
        document.getElementById('t-abstract')?.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    if (!palavrasChave) {
        showAlert('mensagem-alerta', 'Informe ao menos uma palavra-chave para o trabalho.', 'warning');
        document.getElementById('t-kw')?.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    if (submeterDefinitivo && !_arquivoSelecionado && !_submissaoAtualUuid) {
        showAlert('mensagem-alerta', 'Para submeter definitivamente, é necessário anexar o arquivo do trabalho (PDF, DOC ou DOCX).', 'warning');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    const payload = {
        evento: Number(eventoId),
        titulo,
        tipo, // Artigo, Palestra, Minicurso, Poster
        area: Number(areaId),
        abstract,
        palavras_chave: palavrasChave
    };

    if (resumo) payload.resumo = resumo;
    if (descricao) payload.descricao = descricao;
    if (afiliacao) payload.afiliacao_institucional = afiliacao;
    if (titulacao) payload.maior_titulacao = titulacao;
    if (lattes) payload.lattes_url = lattes;
    if (linkedin) payload.linkedin_url = linkedin;

    desabilitarBotoes(true);

    try {
        let uuid = _submissaoAtualUuid;
        let responseJson = null;

        // ETAPA 1: Criar ou atualizar rascunho JSON
        if (uuid) {
            const respPatch = await apiFetch(`/submissoes/${encodeURIComponent(uuid)}/`, {
                method: 'PATCH',
                body: JSON.stringify(payload)
            });
            if (!respPatch.ok) {
                const err = await respPatch.json().catch(() => ({}));
                throw new Error(extrairErro(err, 'Erro ao atualizar dados do trabalho.'));
            }
            responseJson = await respPatch.json();
        } else {
            const respPost = await apiFetch('/submissoes/', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!respPost.ok) {
                const err = await respPost.json().catch(() => ({}));
                throw new Error(extrairErro(err, 'Erro ao criar submissão.'));
            }
            responseJson = await respPost.json();
            uuid = responseJson.uuid || responseJson.id;
            _submissaoAtualUuid = uuid;
        }

        // ETAPA 2: Upload do arquivo se houver
        if (_arquivoSelecionado && uuid) {
            const formData = new FormData();
            formData.append('arquivo', _arquivoSelecionado);

            const respArquivo = await apiFetch(`/submissoes/${encodeURIComponent(uuid)}/submeter/`, {
                method: 'POST',
                body: formData
            });

            if (!respArquivo.ok) {
                const err = await respArquivo.json().catch(() => ({}));
                throw new Error(extrairErro(err, 'Os dados foram salvos, mas o envio do arquivo não pôde ser concluído.'));
            }
        }

        const msgSucesso = submeterDefinitivo
            ? 'Trabalho submetido com sucesso para avaliação!'
            : 'Rascunho salvo com sucesso!';

        showAlert('mensagem-alerta', msgSucesso, 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        setTimeout(() => {
            window.location.href = `../detalhe-submissao/index.html?id=${encodeURIComponent(uuid)}`;
        }, 1200);

    } catch (e) {
        console.error('[submeter_trabalho] Erro ao salvar:', e);
        showAlert('mensagem-alerta', e.message || 'Erro ao processar a submissão.', 'danger');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
        desabilitarBotoes(false);
    }
}

function desabilitarBotoes(desabilitado) {
    const btnRascunho = document.getElementById('btn-salvar-rascunho');
    const btnSubmeter = document.getElementById('btn-submeter-final');
    if (btnRascunho) btnRascunho.disabled = desabilitado;
    if (btnSubmeter) btnSubmeter.disabled = desabilitado;
}

function extrairErro(dados, padrao) {
    if (!dados) return padrao;
    if (typeof dados === 'string') return dados;
    if (dados.detail) return dados.detail;
    if (typeof dados === 'object') {
        const erros = Object.entries(dados).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        if (erros.length > 0) return erros.join(' | ');
    }
    return padrao;
}

function formatarDataSimples(dataStr) {
    if (!dataStr) return '';
    try {
        const [ano, mes, dia] = dataStr.split('-');
        return `${dia}/${mes}/${ano}`;
    } catch {
        return dataStr;
    }
}
