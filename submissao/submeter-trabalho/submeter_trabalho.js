/* SGIE — submissao/submeter-trabalho/submeter_trabalho.js
 * Formulário de submissão acadêmica (Rascunho e Envio Final).
 * Endpoints:
 *   - GET /areas/
 *   - GET /eventos/
 *   - GET /eventos/{id}/ (para obter regra_submissao e status detalhado)
 *   - POST /submissoes/ (cria rascunho JSON)
 *   - PATCH /submissoes/{uuid}/ (atualiza rascunho)
 *   - POST /submissoes/{uuid}/submeter/ (envia arquivo multipart e altera status para SUBMETIDA)
 */

let _arquivoSelecionado = null;
let _submissaoAtualUuid = null;
let _submissaoExistente = null;
let _eventosDisponiveis = [];

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

function preencherDadosAutorPrincipal() {
    const user = typeof window.SGIE_ROLES?.getUsuarioLogado === 'function'
        ? window.SGIE_ROLES.getUsuarioLogado()
        : getUser();
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
            lista.forEach((a) => {
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
            const listaBasica = Array.isArray(dados) ? dados : (dados.results || []);

            // /eventos/ não inclui regra_submissao. Buscamos detalhes de cada evento para filtrar
            // somente os que aceitam submissão.
            const detalhes = await Promise.all(
                listaBasica.map(async (ev) => {
                    try {
                        const dResp = await apiFetch(`/eventos/${ev.id}/`);
                        if (dResp.ok) return await dResp.json();
                    } catch { /* ignora erro e usa lista básica */ }
                    return ev;
                })
            );

            _eventosDisponiveis = detalhes.filter((ev) => {
                const regra = ev.regra_submissao || (window.SGIE_MOCKS?.ativo && typeof window.SGIE_MOCKS.obterRegraSubmissao === 'function'
                    ? window.SGIE_MOCKS.obterRegraSubmissao(ev.id)
                    : null);
                return Boolean(regra && regra.aceita_submissao);
            });

            // Se um evento específico foi passado por URL e não está na lista, tenta buscá-lo diretamente
            if (eventoPredefinidoId && !_eventosDisponiveis.some((e) => String(e.id) === String(eventoPredefinidoId))) {
                try {
                    const singleResp = await apiFetch(`/eventos/${eventoPredefinidoId}/`);
                    if (singleResp.ok) {
                        const singleEv = await singleResp.json();
                        _eventosDisponiveis.push(singleEv);
                    }
                } catch { /* ignora */ }
            }

            selectEvento.innerHTML = '<option value="">Selecione um evento...</option>';
            _eventosDisponiveis.forEach((ev) => {
                const opt = document.createElement('option');
                opt.value = ev.id;
                const dataFmt = typeof window.formatarData === 'function' ? formatarData(ev.data) : formatarDataSimples(ev.data);
                opt.textContent = `${ev.nome} (${dataFmt})`;
                selectEvento.appendChild(opt);
            });

            if (_eventosDisponiveis.length === 0) {
                selectEvento.innerHTML = '<option value="">Nenhum evento com submissões abertas no momento</option>';
            }

            if (eventoPredefinidoId && _eventosDisponiveis.some((e) => String(e.id) === String(eventoPredefinidoId))) {
                selectEvento.value = eventoPredefinidoId;
                await atualizarResumoEvento(eventoPredefinidoId);
            }
        }
    } catch (e) {
        console.error('[submeter_trabalho] Erro ao carregar eventos:', e);
        selectEvento.innerHTML = '<option value="">Não foi possível carregar eventos</option>';
    }
}

async function atualizarResumoEvento(eventoId) {
    const asideNome = document.getElementById('aside-evento-nome');
    const asideAlerta = document.getElementById('aside-evento-alerta');
    const asidePrazo = document.getElementById('aside-evento-prazo');
    const btnSubmeter = document.getElementById('btn-submeter-final');

    if (!eventoId) {
        if (asideNome) asideNome.textContent = 'Selecione um evento';
        if (asideAlerta) asideAlerta.style.display = 'none';
        return;
    }

    let ev = _eventosDisponiveis.find((e) => String(e.id) === String(eventoId));
    if (!ev || !ev.regra_submissao) {
        try {
            const resp = await apiFetch(`/eventos/${eventoId}/`);
            if (resp.ok) {
                const dados = await resp.json();
                ev = dados;
                const idx = _eventosDisponiveis.findIndex((e) => String(e.id) === String(eventoId));
                if (idx >= 0) _eventosDisponiveis[idx] = dados;
                else _eventosDisponiveis.push(dados);
            }
        } catch { /* continua com o que tiver */ }
    }

    if (!ev) return;

    if (asideNome) asideNome.textContent = ev.nome;

    const regra = ev.regra_submissao || (window.SGIE_MOCKS?.ativo && typeof window.SGIE_MOCKS.obterRegraSubmissao === 'function'
        ? window.SGIE_MOCKS.obterRegraSubmissao(ev.id)
        : null);

    if (!regra || !regra.aceita_submissao) {
        if (asideAlerta) {
            asideAlerta.style.display = 'flex';
            asideAlerta.className = 'alert alert-warning';
        }
        if (asidePrazo) asidePrazo.textContent = 'Este evento não aceita submissão de trabalhos acadêmicos.';
        if (btnSubmeter) btnSubmeter.disabled = true;
        return;
    }

    if (regra.data_hora_fim) {
        if (asideAlerta) asideAlerta.style.display = 'flex';
        const dataFim = new Date(regra.data_hora_fim);
        const fimFmt = isNaN(dataFim.getTime())
            ? regra.data_hora_fim
            : dataFim.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

        if (regra.periodo_aberto === false) {
            if (asidePrazo) asidePrazo.innerHTML = `<b>Período encerrado:</b> encerrou-se em ${fimFmt}`;
            if (btnSubmeter) btnSubmeter.disabled = true;
        } else {
            if (asidePrazo) asidePrazo.innerHTML = `<b>Prazo de submissão:</b> até ${fimFmt}`;
            if (btnSubmeter) btnSubmeter.disabled = false;
        }
    } else {
        if (asideAlerta) asideAlerta.style.display = 'none';
        if (btnSubmeter) btnSubmeter.disabled = false;
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
        _submissaoExistente = sub;

        // Preenche campos
        const elEvento = document.getElementById('sub-evento');
        const elTitulo = document.getElementById('t-titulo');
        const elTipo = document.getElementById('t-tipo');
        const elArea = document.getElementById('t-area');
        const elAbstract = document.getElementById('t-abstract');
        const elResumo = document.getElementById('t-resumo');
        const elKw = document.getElementById('t-kw');
        const elDesc = document.getElementById('t-desc');

        const evId = sub.evento?.id || sub.evento;
        if (elEvento && evId) {
            elEvento.value = evId;
            await atualizarResumoEvento(evId);
        }
        if (elTitulo) elTitulo.value = sub.titulo || '';
        if (elTipo && sub.tipo) elTipo.value = sub.tipo;
        if (elArea && sub.area) elArea.value = sub.area?.id || sub.area;
        if (elAbstract) elAbstract.value = sub.abstract || '';
        if (elResumo) elResumo.value = sub.resumo || '';
        if (elKw) elKw.value = sub.palavras_chave || '';
        if (elDesc) elDesc.value = sub.descricao || '';

        // Campos do autor
        if (Array.isArray(sub.autores) && sub.autores.length > 0) {
            const user = typeof window.SGIE_ROLES?.getUsuarioLogado === 'function'
                ? window.SGIE_ROLES.getUsuarioLogado()
                : getUser();
            const autor = sub.autores.find((a) => String(a.usuario) === String(user?.id)) || sub.autores[0];
            if (autor) {
                const elAfil = document.getElementById('a1-afil');
                const elTit = document.getElementById('a1-tit');
                const elLattes = document.getElementById('a1-lattes');
                const elIn = document.getElementById('a1-in');

                if (elAfil && autor.afiliacao_institucional) elAfil.value = autor.afiliacao_institucional;
                if (elTit && (autor.maior_titulacao || autor.maiór_titulacao)) elTit.value = autor.maior_titulacao || autor.maiór_titulacao;
                if (elLattes && autor.lattes_url) elLattes.value = autor.lattes_url;
                if (elIn && autor.linkedin_url) elIn.value = autor.linkedin_url;
            }
        }

        // Se já tem arquivo enviado nas versões anteriores
        if (Array.isArray(sub.versoes) && sub.versoes.length > 0) {
            const ultimaVersao = sub.versoes[sub.versoes.length - 1];
            exibirArquivoSelecionado({
                name: `Versão ${ultimaVersao.numero_versao} já anexada ao sistema`,
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

        ['dragenter', 'dragover'].forEach((ev) => {
            dropArea.addEventListener(ev, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropArea.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach((ev) => {
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
            const preview = document.getElementById('preview-arquivo');
            if (preview) preview.style.display = 'none';
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
    const valida = extensoesValidas.some((ext) => nome.endsWith(ext));

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

    // Validação explícita de arquivo no envio definitivo
    if (submeterDefinitivo) {
        const jaPossuiVersao = Boolean(_submissaoExistente?.versoes && _submissaoExistente.versoes.length > 0);
        if (!_arquivoSelecionado) {
            if (jaPossuiVersao) {
                showAlert('mensagem-alerta', 'O envio definitivo requer um arquivo atualizado (PDF, DOC ou DOCX). Por favor, anexe o arquivo do trabalho.', 'warning');
            } else {
                showAlert('mensagem-alerta', 'Para submeter definitivamente, é necessário anexar o arquivo do trabalho (PDF, DOC ou DOCX).', 'warning');
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
    }

    // Área usa UUID no backend: enviamos como String
    const payload = {
        evento: Number(eventoId),
        titulo,
        tipo,
        area: String(areaId).trim(),
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

        // ETAPA 1: Criar ou atualizar rascunho via JSON (sempre como rascunho)
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

        // ETAPA 2: Upload do arquivo e submissão definitiva
        // ATENÇÃO: SubmissaoService.submeter_trabalho altera o status para SUBMETIDA.
        // Portanto, a chamada para /submeter/ só ocorre quando o usuário clicou em Submeter Definitivamente.
        if (submeterDefinitivo && _arquivoSelecionado && uuid) {
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
            : (_arquivoSelecionado
                ? 'Rascunho salvo com sucesso! O arquivo selecionado será enviado quando você clicar em Submeter Trabalho.'
                : 'Rascunho salvo com sucesso!');

        showAlert('mensagem-alerta', msgSucesso, 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        setTimeout(() => {
            if (submeterDefinitivo) {
                window.location.href = `../detalhe-submissao/index.html?id=${encodeURIComponent(uuid)}`;
            } else {
                // Ao salvar rascunho de nova submissão, atualiza a URL para permitir edições subsequentes
                if (!window.location.search.includes('id=')) {
                    history.replaceState(null, '', `?id=${encodeURIComponent(uuid)}`);
                }
            }
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
