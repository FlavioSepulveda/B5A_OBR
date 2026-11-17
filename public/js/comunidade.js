import { auth, db, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, push, set, onValue, update, remove, get } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';

let todasCronicasCache = {};
let cronicaAbertaId = null;
let cronicaAbertaObj = null;
let deepLinkJaProcessado = false;

const IMG_PADRAO = 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80';

// =========================================================
// SINCRONIZAÇÃO COM O FEED PRINCIPAL (index.html / home.js)
// =========================================================
async function sincronizarComFeed(cronicaId, payload, compartilharNoFeed) {
    const feedItemRef = ref(db, `feed/cronica_${cronicaId}`);

    if (!compartilharNoFeed) {
        await remove(feedItemRef);
        return;
    }

    const resumoCurto = payload.texto.length > 180
        ? payload.texto.slice(0, 177) + '...'
        : payload.texto;

    await set(feedItemRef, {
        tipo: 'cronica',
        cronicaId: cronicaId,
        titulo: `📜 Crônica: ${payload.titulo}`,
        conteudo: resumoCurto,
        texto: resumoCurto,
        imagem: payload.imagem || '',
        espectro: payload.espectro || 'Índigo',
        volume: payload.volume || 'Volume I',
        genero: payload.genero || 'Mistério Clássico',
        autor: payload.autor,
        autorNome: payload.autor,
        autorId: payload.autorId,
        uid: payload.autorId,
        link: `pages/comunidade.html?id=${cronicaId}`,
        criadoEm: payload.criadoEm,
        timestamp: payload.criadoEm
    });
}

// =========================================================
// CARREGAMENTO E FILTRAGEM DO FEED DE CRÔNICAS
// =========================================================
function renderizarListaCronicas() {
    const lista = document.getElementById('lista-cronicas');
    if (!lista) return;

    const termoBusca = (document.getElementById('busca-cronica')?.value || '').toLowerCase().trim();
    const espectroFiltro = document.getElementById('filtro-espectro')?.value || 'TODOS';

    lista.innerHTML = '';

    const idsFiltrados = Object.keys(todasCronicasCache)
        .filter((id) => {
            const c = todasCronicasCache[id];
            if (!c || typeof c !== 'object') return false;

            const espectroItem = c.espectro || 'Índigo';
            if (espectroFiltro !== 'TODOS' && espectroItem !== espectroFiltro) return false;

            if (termoBusca) {
                const alvoBusca = `${c.titulo || ''} ${c.autor || ''} ${c.genero || ''} ${c.texto || ''}`.toLowerCase();
                if (!alvoBusca.includes(termoBusca)) return false;
            }
            return true;
        })
        .sort((a, b) => (todasCronicasCache[b]?.criadoEm || 0) - (todasCronicasCache[a]?.criadoEm || 0));

    if (idsFiltrados.length === 0) {
        lista.innerHTML = '<p style="color:#888; grid-column:1/-1;">Nenhuma crônica encontrada nos registros da Biblioteca.</p>';
        return;
    }

    idsFiltrados.forEach((id) => {
        const c = todasCronicasCache[id];
        const titulo = c.titulo || 'Crônica sem Título';
        const autor = c.autor || 'Arquivista';
        const texto = c.texto || '';
        const espectro = c.espectro || 'Índigo';
        const volume = c.volume || 'Volume I';
        const genero = c.genero || 'Mistério Clássico';
        const likes = Array.isArray(c.curtidas) ? c.curtidas.length : 0;
        const qtdComentarios = c.comentarios ? Object.keys(c.comentarios).length : 0;
        const imgUrl = c.imagem && c.imagem.trim() !== '' ? c.imagem : IMG_PADRAO;

        const card = document.createElement('article');
        card.className = 'cronica-card';
        card.setAttribute('data-espectro', espectro);
        card.innerHTML = `
            <img src="${imgUrl}" alt="${titulo}" onerror="this.src='${IMG_PADRAO}'">
            <div class="cronica-card-body">
                <div class="card-tags">
                    <span class="tag-badge">${espectro}</span>
                    <span class="tag-badge">${volume}</span>
                    <span class="tag-badge">${genero}</span>
                </div>
                <h3>${titulo}</h3>
                <p>${texto}</p>
                <div class="card-footer">
                    <span>✍️ ${autor} • 👥 ${c.jogadores || 4}</span>
                    <span>💬 ${qtdComentarios} • ❤️ ${likes}</span>
                </div>
            </div>
        `;
        card.addEventListener('click', () => abrirModalCronica(id, c));
        lista.appendChild(card);
    });

    // Abre automaticamente se veio clicado do Feed Geral (?id=...)
    if (!deepLinkJaProcessado) {
        const urlId = new URLSearchParams(window.location.search).get('id');
        if (urlId && todasCronicasCache[urlId]) {
            deepLinkJaProcessado = true;
            abrirModalCronica(urlId, todasCronicasCache[urlId]);
        }
    }
}

function iniciarListenersCronicas() {
    let dadosRaiz = {};
    let dadosSala = {};

    const atualizar = () => {
        todasCronicasCache = { ...dadosSala, ...dadosRaiz };
        renderizarListaCronicas();

        // Se o modal estiver aberto, atualiza likes e comentários em tempo real
        if (cronicaAbertaId && todasCronicasCache[cronicaAbertaId]) {
            cronicaAbertaObj = todasCronicasCache[cronicaAbertaId];
            const curtidas = Array.isArray(cronicaAbertaObj.curtidas) ? cronicaAbertaObj.curtidas : [];
            const qtdLikesEl = document.getElementById('qtd-likes');
            if (qtdLikesEl) qtdLikesEl.textContent = curtidas.length;
            renderizarComentarios(cronicaAbertaObj.comentarios || {});
        }
    };

    onValue(ref(db, 'cronicas'), (snap) => {
        dadosRaiz = snap.val() || {};
        atualizar();
    }, (err) => console.error('Erro ao ler crônicas:', err));

    onValue(ref(db, `salas/${salaAtual}/cronicas`), (snap) => {
        dadosSala = snap.val() || {};
        atualizar();
    });

    document.getElementById('busca-cronica')?.addEventListener('input', renderizarListaCronicas);
    document.getElementById('filtro-espectro')?.addEventListener('change', renderizarListaCronicas);
}

// =========================================================
// FORMULÁRIO: CRIAR E EDITAR CRÔNICA
// =========================================================
function configurarFormularioCronica() {
    const btnSalvar = document.getElementById('btn-salvar-cronica');
    const btnCancelar = document.getElementById('btn-cancelar-edicao');
    if (!btnSalvar) return;

    btnCancelar?.addEventListener('click', resetarFormulario);

    btnSalvar.addEventListener('click', () => {
        if (!idJogadorAtual) {
            alert('Faça login com o Google para registrar uma crônica na Biblioteca!');
            return;
        }

        const titulo = document.getElementById('cronica-titulo')?.value.trim() || '';
        const texto = document.getElementById('cronica-texto')?.value.trim() || '';
        const espectro = document.getElementById('cronica-espectro')?.value || 'Índigo';
        const volume = document.getElementById('cronica-volume')?.value || 'Volume I';
        const genero = document.getElementById('cronica-genero')?.value || 'Mistério Clássico';
        const jogadores = Number(document.getElementById('cronica-jogadores')?.value) || 4;
        const compartilharNoFeed = document.getElementById('publicar-no-feed')?.checked ?? true;
        const editId = document.getElementById('edit-cronica-id')?.value || '';
        const status = document.getElementById('status-cronica');

        if (titulo.length < 3 || texto.length < 5) {
            alert('Preencha o título e o prólogo da crônica.');
            return;
        }

        btnSalvar.disabled = true;
        btnSalvar.textContent = editId ? 'Atualizando Registro...' : 'Selando no Arquivo...';

        const gravar = async (imgFinal) => {
            try {
                const timestampAtual = editId && cronicaAbertaObj?.criadoEm
                    ? cronicaAbertaObj.criadoEm
                    : Date.now();

                const payload = {
                    titulo,
                    texto,
                    espectro,
                    volume,
                    genero,
                    jogadores,
                    imagem: imgFinal,
                    autor: auth.currentUser?.displayName || 'Arquivista',
                    autorId: idJogadorAtual,
                    criadoEm: timestampAtual,
                    atualizadoEm: Date.now()
                };

                let idFinal = editId;

                if (editId) {
                    await update(ref(db, `cronicas/${editId}`), payload);
                } else {
                    payload.curtidas = [];
                    const novaRef = push(ref(db, 'cronicas'));
                    idFinal = novaRef.key;
                    await set(novaRef, payload);
                }

                // Sincroniza automaticamente com o Feed Geral
                await sincronizarComFeed(idFinal, payload, compartilharNoFeed);

                resetarFormulario();

                if (status) {
                    status.style.color = '#2ec4b6';
                    status.textContent = editId
                        ? '✅ Crônica atualizada no Acervo e no Feed!'
                        : '✅ Crônica publicada e enviada ao Feed!';
                    setTimeout(() => (status.textContent = ''), 3500);
                }
            } catch (e) {
                console.error('Erro ao salvar crônica:', e);
                alert('Erro ao publicar crônica: ' + e.message);
            } finally {
                btnSalvar.disabled = false;
                btnSalvar.textContent = 'Publicar Crônica';
            }
        };

        const arquivoInput = document.getElementById('cronica-arquivo');
        const urlInput = document.getElementById('cronica-imagem')?.value.trim() || '';

        if (arquivoInput && arquivoInput.files.length > 0) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const scale = Math.min(1, 640 / img.width);
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    gravar(canvas.toDataURL('image/jpeg', 0.75));
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(arquivoInput.files[0]);
        } else {
            // Se estiver editando e o usuário não trocou a imagem base64 anterior, mantém ela
            const imagemMantida = (!urlInput && editId && cronicaAbertaObj?.imagem?.startsWith('data:'))
                ? cronicaAbertaObj.imagem
                : urlInput;
            gravar(imagemMantida);
        }
    });
}

function resetarFormulario() {
    document.getElementById('edit-cronica-id').value = '';
    document.getElementById('cronica-titulo').value = '';
    document.getElementById('cronica-texto').value = '';
    document.getElementById('cronica-imagem').value = '';
    document.getElementById('cronica-jogadores').value = 4;
    const arq = document.getElementById('cronica-arquivo');
    if (arq) arq.value = '';

    document.getElementById('form-titulo-cabecalho').textContent = 'Registrar Nova Crônica';
    document.getElementById('btn-salvar-cronica').textContent = 'Publicar Crônica';
    const btnCancelar = document.getElementById('btn-cancelar-edicao');
    if (btnCancelar) btnCancelar.style.display = 'none';
}

// =========================================================
// MODAL DE LEITURA, CURTIDAS E NOTAS À MARGEM
// =========================================================
function abrirModalCronica(id, cronica) {
    cronicaAbertaId = id;
    cronicaAbertaObj = cronica;

    const modal = document.getElementById('modal-cronica');
    if (!modal) return;

    const imgEl = document.getElementById('modal-img');
    imgEl.src = cronica.imagem && cronica.imagem.trim() !== '' ? cronica.imagem : IMG_PADRAO;
    imgEl.onerror = () => (imgEl.src = IMG_PADRAO);

    const badgesEl = document.getElementById('modal-badges');
    if (badgesEl) {
        badgesEl.innerHTML = `
            <span class="tag-badge">Espectro: ${cronica.espectro || 'Índigo'}</span>
            <span class="tag-badge">${cronica.volume || 'Volume I'}</span>
            <span class="tag-badge">${cronica.genero || 'Mistério Clássico'}</span>
        `;
    }

    document.getElementById('modal-titulo').textContent = cronica.titulo || 'Sem Título';
    document.getElementById('modal-autor').textContent =
        `Registrado por ${cronica.autor || 'Arquivista'} • Mesa para ${cronica.jogadores || 4} Arquivistas`;
    document.getElementById('modal-texto').textContent = cronica.texto || '';

    const curtidas = Array.isArray(cronica.curtidas) ? cronica.curtidas : [];
    document.getElementById('qtd-likes').textContent = curtidas.length;

    renderizarComentarios(cronica.comentarios || {});

    const ehDono = cronica.autorId && cronica.autorId === idJogadorAtual;
    const btnEditar = document.getElementById('btn-editar');
    const btnDeletar = document.getElementById('btn-deletar');

    if (btnEditar) btnEditar.style.display = ehDono ? 'inline-block' : 'none';
    if (btnDeletar) {
        btnDeletar.style.display = ehDono ? 'inline-block' : 'none';
        btnDeletar.onclick = async () => {
            if (!confirm('Deseja apagar permanentemente esta crônica do Acervo e do Feed?')) return;
            await remove(ref(db, `cronicas/${id}`));
            await remove(ref(db, `feed/cronica_${id}`));
            window.fecharModalCronica();
        };
    }

    modal.style.display = 'flex';
}

function renderizarComentarios(comentariosObj) {
    const listaEl = document.getElementById('lista-comentarios');
    const qtdEl = document.getElementById('qtd-comentarios');
    if (!listaEl) return;

    const chaves = Object.keys(comentariosObj || {});
    if (qtdEl) qtdEl.textContent = chaves.length;

    if (chaves.length === 0) {
        listaEl.innerHTML = '<p style="color:#777; font-size:0.8rem;">Nenhuma nota registrada à margem ainda.</p>';
        return;
    }

    listaEl.innerHTML = chaves
        .sort((a, b) => (comentariosObj[a]?.criadoEm || 0) - (comentariosObj[b]?.criadoEm || 0))
        .map((k) => {
            const com = comentariosObj[k];
            return `
                <div class="comentario-item">
                    <strong>✍️ ${com.autor || 'Arquivista'}:</strong>
                    <p style="margin-top:3px; color:#ddd;">${com.texto}</p>
                </div>
            `;
        })
        .join('');
}

function configurarComentarios() {
    const btnEnviar = document.getElementById('btn-enviar-comentario');
    const input = document.getElementById('input-comentario');
    if (!btnEnviar || !input) return;

    const enviar = async () => {
        if (!idJogadorAtual) {
            alert('Faça login para deixar uma nota à margem.');
            return;
        }
        if (!cronicaAbertaId) return;

        const texto = input.value.trim();
        if (!texto) return;

        btnEnviar.disabled = true;
        try {
            const novoComRef = push(ref(db, `cronicas/${cronicaAbertaId}/comentarios`));
            await set(novoComRef, {
                autor: auth.currentUser?.displayName || 'Arquivista',
                autorId: idJogadorAtual,
                texto,
                criadoEm: Date.now()
            });
            input.value = '';
        } catch (err) {
            console.error('Erro ao comentar:', err);
        } finally {
            btnEnviar.disabled = false;
        }
    };

    btnEnviar.addEventListener('click', enviar);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') enviar();
    });
}

window.fecharModalCronica = function () {
    const modal = document.getElementById('modal-cronica');
    if (modal) modal.style.display = 'none';
    cronicaAbertaId = null;

    // Limpa o ?id= da URL sem recarregar a página
    const url = new URL(window.location);
    url.searchParams.delete('id');
    window.history.replaceState({}, '', url);
};

window.alternarLike = async function () {
    if (!idJogadorAtual) {
        alert('Faça login para registrar apoio!');
        return;
    }
    if (!cronicaAbertaId) return;

    const snap = await get(ref(db, `cronicas/${cronicaAbertaId}/curtidas`));
    let lista = Array.isArray(snap.val()) ? snap.val() : [];
    if (lista.includes(idJogadorAtual)) {
        lista = lista.filter((uid) => uid !== idJogadorAtual);
    } else {
        lista.push(idJogadorAtual);
    }

    await update(ref(db, `cronicas/${cronicaAbertaId}`), { curtidas: lista });
    document.getElementById('qtd-likes').textContent = lista.length;
};

window.copiarLinkCronica = function () {
    if (!cronicaAbertaId) return;
    const link = `${window.location.origin}${window.location.pathname}?id=${cronicaAbertaId}`;
    navigator.clipboard.writeText(link).then(() => {
        alert('🔗 Link da Crônica copiado para a área de transferência!');
    });
};

window.prepararEdicao = function () {
    if (!cronicaAbertaId || !cronicaAbertaObj) return;
    const idParaEditar = cronicaAbertaId;

    document.getElementById('edit-cronica-id').value = idParaEditar;
    document.getElementById('cronica-titulo').value = cronicaAbertaObj.titulo || '';
    document.getElementById('cronica-espectro').value = cronicaAbertaObj.espectro || 'Índigo';
    document.getElementById('cronica-volume').value = cronicaAbertaObj.volume || 'Volume I';
    document.getElementById('cronica-genero').value = cronicaAbertaObj.genero || 'Mistério Clássico';
    document.getElementById('cronica-jogadores').value = cronicaAbertaObj.jogadores || 4;
    document.getElementById('cronica-imagem').value = (cronicaAbertaObj.imagem || '').startsWith('data:')
        ? ''
        : (cronicaAbertaObj.imagem || '');
    document.getElementById('cronica-texto').value = cronicaAbertaObj.texto || '';

    document.getElementById('form-titulo-cabecalho').textContent = 'Editando Crônica';
    document.getElementById('btn-salvar-cronica').textContent = 'Salvar Alterações';
    document.getElementById('btn-cancelar-edicao').style.display = 'block';

    const modal = document.getElementById('modal-cronica');
    if (modal) modal.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.addEventListener('DOMContentLoaded', () => {
    configurarFormularioCronica();
    configurarComentarios();
    iniciarListenersCronicas();
});