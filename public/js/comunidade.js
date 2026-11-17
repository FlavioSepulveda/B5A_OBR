import { auth, db, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, push, set, onValue, update, remove, get } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';

let todasCronicasCache = {};
let ameacasCatalogo = {};
let ameacasSelecionadasForm = [];

let cronicaAbertaId = null;
let cronicaAbertaObj = null;
let deepLinkJaProcessado = false;

const IMG_PADRAO = 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80';

// Tipos que NÃO são crônicas quando lidos do feed geral
const TIPOS_NAO_CRONICA = [
    'criatura', 'chefe', 'bestiario', 'monstro',
    'ficha', 'personagem', 'arquivista',
    'item', 'arma', 'artefato', 'caminho', 'vocacao'
];

// =========================================================
// 1. CARREGAR CRIATURAS E CHEFES EXISTENTES NA COMUNIDADE
// =========================================================
function iniciarCatalogoAmeacas() {
    const selectEl = document.getElementById('select-ameaca-comunidade');
    if (!selectEl) return;

    let fontes = { criaturas: {}, bestiario: {}, chefes: {}, feed: {}, publicacoes: {} };

    const atualizarSelect = () => {
        ameacasCatalogo = {};

        const registrar = (chave, item, categoriaPadrao) => {
            if (!item || typeof item !== 'object') return;
            const nome = item.nome || item.titulo || item.name;
            if (!nome) return;

            const ehChefe = categoriaPadrao === 'chefe'
                || String(item.tipo || '').toLowerCase() === 'chefe'
                || item.isChefe === true
                || String(item.categoria || '').toLowerCase().includes('chefe');

            ameacasCatalogo[chave] = {
                id: chave,
                nome: nome.replace(/^\[?(Criatura|Chefe)\]?:\s*/i, ''),
                categoria: ehChefe ? 'chefe' : 'criatura',
                pvMax: Number(item.pvMax ?? item.vidaMax ?? item.pv ?? item.vida ?? (ehChefe ? 80 : 18)),
                ta: Number(item.ta ?? item.dificuldade ?? item.defesa ?? (ehChefe ? 17 : 13)),
                dinamismo: Number(item.dinamismo ?? item.atributos?.dinamismo ?? (ehChefe ? 5 : 3)),
                autor: item.autor || item.autorNome || 'Acervo'
            };
        };

        Object.entries(fontes.criaturas).forEach(([k, v]) => registrar(`criatura_${k}`, v, 'criatura'));
        Object.entries(fontes.bestiario).forEach(([k, v]) => registrar(`bestiario_${k}`, v, 'criatura'));
        Object.entries(fontes.chefes).forEach(([k, v]) => registrar(`chefe_${k}`, v, 'chefe'));

        const filtrarAmeacasDoFeed = (obj, prefixo) => {
            Object.entries(obj).forEach(([k, v]) => {
                if (!v || typeof v !== 'object') return;
                const t = String(v.tipo || v.categoria || '').toLowerCase();
                if (t === 'criatura' || t === 'chefe' || t === 'bestiario' || t === 'monstro') {
                    registrar(`${prefixo}_${k}`, v, t === 'chefe' ? 'chefe' : 'criatura');
                }
            });
        };

        filtrarAmeacasDoFeed(fontes.feed, 'feed');
        filtrarAmeacasDoFeed(fontes.publicacoes, 'pub');

        const listaOrdenada = Object.values(ameacasCatalogo).sort((a, b) => a.nome.localeCompare(b.nome));
        selectEl.innerHTML = '<option value="">-- Selecione uma Criatura ou Chefe --</option>';

        listaOrdenada.forEach((am) => {
            const opt = document.createElement('option');
            opt.value = am.id;
            const icone = am.categoria === 'chefe' ? '👑 [CHEFE]' : '👹 [Criatura]';
            opt.textContent = `${icone} ${am.nome} (PV ${am.pvMax} | TA ${am.ta})`;
            selectEl.appendChild(opt);
        });
    };

    onValue(ref(db, 'criaturas'), (s) => { fontes.criaturas = s.val() || {}; atualizarSelect(); });
    onValue(ref(db, 'bestiario'), (s) => { fontes.bestiario = s.val() || {}; atualizarSelect(); });
    onValue(ref(db, 'chefes'), (s) => { fontes.chefes = s.val() || {}; atualizarSelect(); });
    onValue(ref(db, 'feed'), (s) => { fontes.feed = s.val() || {}; atualizarSelect(); });
    onValue(ref(db, 'publicacoes'), (s) => { fontes.publicacoes = s.val() || {}; atualizarSelect(); });

    document.getElementById('btn-add-ameaca')?.addEventListener('click', () => {
        const idSel = selectEl.value;
        if (!idSel || !ameacasCatalogo[idSel]) return;
        ameacasSelecionadasForm.push({ ...ameacasCatalogo[idSel] });
        selectEl.value = '';
        renderizarChipsAmeacasForm();
    });
}

function renderizarChipsAmeacasForm() {
    const container = document.getElementById('lista-ameacas-selecionadas');
    if (!container) return;

    container.innerHTML = '';
    ameacasSelecionadasForm.forEach((am, index) => {
        const chip = document.createElement('span');
        chip.className = `chip-ameaca ${am.categoria === 'chefe' ? 'chefe' : ''}`;
        chip.innerHTML = `
            ${am.categoria === 'chefe' ? '👑' : '👹'} ${am.nome} (PV ${am.pvMax})
            <button type="button" title="Remover">×</button>
        `;
        chip.querySelector('button').addEventListener('click', () => {
            ameacasSelecionadasForm.splice(index, 1);
            renderizarChipsAmeacasForm();
        });
        container.appendChild(chip);
    });
}

// =========================================================
// 2. LEITURA UNIFICADA DE TODAS AS CRÔNICAS JÁ EXISTENTES
// =========================================================
function normalizarCronica(id, raw, origem, caminhoOriginal) {
    if (!raw || typeof raw !== 'object') return null;

    // Ignora registros que claramente são criaturas, itens ou fichas no feed geral
    if (origem !== 'cronicas') {
        const tipo = String(raw.tipo || raw.categoria || '').toLowerCase().trim();
        if (TIPOS_NAO_CRONICA.includes(tipo)) return null;
    }

    const texto = raw.texto || raw.conteudo || raw.descricao || raw.historia || raw.resumo || '';
    const tituloBruto = raw.titulo || raw.nome || 'Crônica sem Título';
    const tituloLimpo = String(tituloBruto).replace(/^📜\s*(Crônica|Missão):\s*/i, '');

    // Ignora objetos vazios sem título nem texto
    if (!raw.titulo && !raw.nome && !texto) return null;

    const idUnificado = raw.cronicaId || String(id).replace(/^cronica_/, '');

    return {
        id: idUnificado,
        chaveNoBanco: id,
        origem, // 'cronicas' | 'feed' | 'publicacoes' | 'posts' | 'sala'
        caminhoOriginal,
        titulo: tituloLimpo,
        texto,
        espectro: raw.espectro || 'Índigo',
        volume: raw.volume || 'Volume I',
        genero: raw.genero || 'Mistério Clássico',
        jogadores: Number(raw.jogadores || 4),
        imagem: raw.imagem || raw.capa || raw.img || '',
        autor: raw.autor || raw.autorNome || raw.nomeAutor || 'Arquivista',
        autorId: raw.autorId || raw.uid || raw.userId || raw.idAutor || '',
        criadoEm: Number(raw.criadoEm || raw.timestamp || raw.data || 0),
        curtidas: Array.isArray(raw.curtidas) ? raw.curtidas : [],
        comentarios: raw.comentarios || {},
        ameacas: Array.isArray(raw.ameacas) ? raw.ameacas : []
    };
}

function iniciarListenersCronicas() {
    let fontes = {
        cronicas: {},
        feed: {},
        publicacoes: {},
        posts: {},
        salas: {}
    };

    const mesclarERenderizar = () => {
        const mapaUnificado = {};

        const processarFonte = (dados, origem, basePath) => {
            Object.entries(dados || {}).forEach(([k, v]) => {
                const norm = normalizarCronica(k, v, origem, `${basePath}/${k}`);
                if (!norm) return;

                const existente = mapaUnificado[norm.id];
                if (!existente) {
                    mapaUnificado[norm.id] = norm;
                } else {
                    // Mescla sem perder o texto completo nem o vínculo com o feed original
                    mapaUnificado[norm.id] = {
                        ...existente,
                        ...norm,
                        texto: norm.texto.length >= existente.texto.length ? norm.texto : existente.texto,
                        ameacas: norm.ameacas.length > 0 ? norm.ameacas : existente.ameacas,
                        curtidas: norm.curtidas.length >= existente.curtidas.length ? norm.curtidas : existente.curtidas,
                        comentarios: Object.keys(norm.comentarios).length >= Object.keys(existente.comentarios).length
                            ? norm.comentarios
                            : existente.comentarios,
                        // Preserva o caminho no feed caso o item tenha nascido lá
                        caminhoFeedLegado: existente.caminhoFeedLegado || (origem !== 'cronicas' ? `${basePath}/${k}` : null)
                    };
                }
            });
        };

        // 1. Varre posts antigos do feed / publicações / posts
        processarFonte(fontes.feed, 'feed', 'feed');
        processarFonte(fontes.publicacoes, 'publicacoes', 'publicacoes');
        processarFonte(fontes.posts, 'posts', 'posts');

        // 2. Varre crônicas salvas dentro das salas
        Object.entries(fontes.salas || {}).forEach(([salaKey, salaObj]) => {
            if (salaObj && salaObj.cronicas) {
                processarFonte(salaObj.cronicas, 'sala', `salas/${salaKey}/cronicas`);
            }
        });

        // 3. Por último, sobrepõe com o nó oficial cronicas/
        processarFonte(fontes.cronicas, 'cronicas', 'cronicas');

        todasCronicasCache = mapaUnificado;
        renderizarListaCronicas();

        if (cronicaAbertaId && todasCronicasCache[cronicaAbertaId]) {
            cronicaAbertaObj = todasCronicasCache[cronicaAbertaId];
            document.getElementById('qtd-likes').textContent = cronicaAbertaObj.curtidas.length;
            renderizarComentarios(cronicaAbertaObj.comentarios);
        }
    };

    onValue(ref(db, 'cronicas'), (s) => { fontes.cronicas = s.val() || {}; mesclarERenderizar(); });
    onValue(ref(db, 'feed'), (s) => { fontes.feed = s.val() || {}; mesclarERenderizar(); });
    onValue(ref(db, 'publicacoes'), (s) => { fontes.publicacoes = s.val() || {}; mesclarERenderizar(); });
    onValue(ref(db, 'posts'), (s) => { fontes.posts = s.val() || {}; mesclarERenderizar(); });
    onValue(ref(db, 'salas'), (s) => { fontes.salas = s.val() || {}; mesclarERenderizar(); });

    document.getElementById('busca-cronica')?.addEventListener('input', renderizarListaCronicas);
    document.getElementById('filtro-espectro')?.addEventListener('change', renderizarListaCronicas);
}

function renderizarListaCronicas() {
    const lista = document.getElementById('lista-cronicas');
    if (!lista) return;

    const termoBusca = (document.getElementById('busca-cronica')?.value || '').toLowerCase().trim();
    const espectroFiltro = document.getElementById('filtro-espectro')?.value || 'TODOS';

    lista.innerHTML = '';

    const idsFiltrados = Object.keys(todasCronicasCache)
        .filter((id) => {
            const c = todasCronicasCache[id];
            if (!c) return false;
            if (espectroFiltro !== 'TODOS' && c.espectro !== espectroFiltro) return false;

            if (termoBusca) {
                const nomesAmeacas = (c.ameacas || []).map((a) => a.nome).join(' ');
                const alvo = `${c.titulo} ${c.autor} ${c.genero} ${c.texto} ${nomesAmeacas}`.toLowerCase();
                if (!alvo.includes(termoBusca)) return false;
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
        const likes = c.curtidas.length;
        const qtdComentarios = Object.keys(c.comentarios || {}).length;
        const qtdAmeacas = (c.ameacas || []).length;
        const imgUrl = c.imagem && c.imagem.trim() !== '' ? c.imagem : IMG_PADRAO;

        const card = document.createElement('article');
        card.className = 'cronica-card';
        card.setAttribute('data-espectro', c.espectro);
        card.innerHTML = `
            <img src="${imgUrl}" alt="${c.titulo}" onerror="this.src='${IMG_PADRAO}'">
            <div class="cronica-card-body">
                <div class="card-tags">
                    <span class="tag-badge">${c.espectro}</span>
                    <span class="tag-badge">${c.volume}</span>
                    ${qtdAmeacas > 0 ? `<span class="tag-badge" style="border-color:#a8324a; color:#ffb3c1;">👹 ${qtdAmeacas} Ameaça(s)</span>` : ''}
                </div>
                <h3>${c.titulo}</h3>
                <p>${c.texto}</p>
                <div class="card-footer">
                    <span>✍️ ${c.autor}</span>
                    <span>💬 ${qtdComentarios} • ❤️ ${likes}</span>
                </div>
            </div>
        `;
        card.addEventListener('click', () => abrirModalCronica(id, c));
        lista.appendChild(card);
    });

    if (!deepLinkJaProcessado) {
        const urlId = new URLSearchParams(window.location.search).get('id');
        if (urlId && todasCronicasCache[urlId]) {
            deepLinkJaProcessado = true;
            abrirModalCronica(urlId, todasCronicasCache[urlId]);
        }
    }
}

// =========================================================
// 3. SINCRONIZAÇÃO COM O FEED PRINCIPAL
// =========================================================
async function sincronizarComFeed(cronicaId, payload, compartilharNoFeed, caminhoFeedExistente = null) {
    const caminhoAlvo = caminhoFeedExistente || `feed/cronica_${cronicaId}`;
    const feedItemRef = ref(db, caminhoAlvo);

    if (!compartilharNoFeed) {
        await remove(feedItemRef);
        return;
    }

    const resumoCurto = payload.texto.length > 180 ? payload.texto.slice(0, 177) + '...' : payload.texto;

    await update(feedItemRef, {
        tipo: 'cronica',
        cronicaId: cronicaId,
        titulo: `📜 Crônica: ${payload.titulo}`,
        conteudo: resumoCurto,
        texto: payload.texto,
        imagem: payload.imagem || '',
        espectro: payload.espectro,
        volume: payload.volume,
        genero: payload.genero,
        ameacas: payload.ameacas || [],
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
// 4. FORMULÁRIO: CRIAR E EDITAR QUALQUER CRÔNICA EXISTENTE
// =========================================================
function configurarFormularioCronica() {
    const btnSalvar = document.getElementById('btn-salvar-cronica');
    const btnCancelar = document.getElementById('btn-cancelar-edicao');
    if (!btnSalvar) return;

    btnCancelar?.addEventListener('click', resetarFormulario);

    btnSalvar.addEventListener('click', () => {
        if (!idJogadorAtual) {
            alert('Faça login com o Google para registrar ou editar uma crônica!');
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
                const registroAnterior = editId ? todasCronicasCache[editId] : null;
                const timestampAtual = registroAnterior?.criadoEm || Date.now();

                const payload = {
                    titulo,
                    texto,
                    espectro,
                    volume,
                    genero,
                    jogadores,
                    imagem: imgFinal,
                    ameacas: ameacasSelecionadasForm,
                    autor: registroAnterior?.autor || auth.currentUser?.displayName || 'Arquivista',
                    autorId: registroAnterior?.autorId || idJogadorAtual,
                    criadoEm: timestampAtual,
                    atualizadoEm: Date.now()
                };

                let idFinal = editId;

                if (editId) {
                    // Salva/atualiza no nó oficial cronicas/
                    await update(ref(db, `cronicas/${editId}`), payload);

                    // Se ela nasceu em outro nó (ex: feed/-Oxyz ou publicacoes/-Oxyz), atualiza lá também!
                    const caminhoLegado = registroAnterior?.caminhoFeedLegado
                        || (registroAnterior?.origem !== 'cronicas' ? registroAnterior?.caminhoOriginal : null);

                    if (caminhoLegado && caminhoLegado.startsWith('salas/')) {
                        await update(ref(db, caminhoLegado), payload);
                        await sincronizarComFeed(editId, payload, compartilharNoFeed);
                    } else {
                        await sincronizarComFeed(editId, payload, compartilharNoFeed, caminhoLegado);
                    }
                } else {
                    payload.curtidas = [];
                    const novaRef = push(ref(db, 'cronicas'));
                    idFinal = novaRef.key;
                    await set(novaRef, payload);
                    await sincronizarComFeed(idFinal, payload, compartilharNoFeed);
                }

                resetarFormulario();

                if (status) {
                    status.style.color = '#2ec4b6';
                    status.textContent = editId ? '✅ Crônica atualizada!' : '✅ Crônica publicada!';
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
            const imagemMantida = (!urlInput && editId && todasCronicasCache[editId]?.imagem?.startsWith('data:'))
                ? todasCronicasCache[editId].imagem
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
    ameacasSelecionadasForm = [];
    renderizarChipsAmeacasForm();

    const arq = document.getElementById('cronica-arquivo');
    if (arq) arq.value = '';

    document.getElementById('form-titulo-cabecalho').textContent = 'Registrar Nova Crônica';
    document.getElementById('btn-salvar-cronica').textContent = 'Publicar Crônica';
    const btnCancelar = document.getElementById('btn-cancelar-edicao');
    if (btnCancelar) btnCancelar.style.display = 'none';
}

// =========================================================
// 5. MODAL DE LEITURA, EDIÇÃO E ENVIO PARA O ESCUDO DO MESTRE
// =========================================================
function abrirModalCronica(id, cronica) {
    cronicaAbertaId = id;
    cronicaAbertaObj = cronica;

    const modal = document.getElementById('modal-cronica');
    if (!modal) return;

    const imgEl = document.getElementById('modal-img');
    imgEl.src = cronica.imagem && cronica.imagem.trim() !== '' ? cronica.imagem : IMG_PADRAO;
    imgEl.onerror = () => (imgEl.src = IMG_PADRAO);

    document.getElementById('modal-badges').innerHTML = `
        <span class="tag-badge">Espectro: ${cronica.espectro}</span>
        <span class="tag-badge">${cronica.volume}</span>
        <span class="tag-badge">${cronica.genero}</span>
    `;

    document.getElementById('modal-titulo').textContent = cronica.titulo;
    document.getElementById('modal-autor').textContent =
        `Registrado por ${cronica.autor} • Mesa para ${cronica.jogadores} Arquivistas`;
    document.getElementById('modal-texto').textContent = cronica.texto;

    const ameacasBox = document.getElementById('modal-ameacas-box');
    const ameacasLista = document.getElementById('modal-ameacas-lista');
    const ameacas = cronica.ameacas || [];

    if (ameacas.length > 0) {
        ameacasBox.style.display = 'block';
        ameacasLista.innerHTML = ameacas.map((am) => `
            <span class="chip-ameaca ${am.categoria === 'chefe' ? 'chefe' : ''}">
                ${am.categoria === 'chefe' ? '👑' : '👹'} ${am.nome} (PV ${am.pvMax} | TA ${am.ta})
            </span>
        `).join('');
    } else {
        ameacasBox.style.display = 'none';
    }

    document.getElementById('qtd-likes').textContent = cronica.curtidas.length;
    renderizarComentarios(cronica.comentarios);

    // Libera edição se o usuário estiver logado e for o autor (ou se o registro antigo não tiver autorId)
    const nomeUsuarioAtual = (auth.currentUser?.displayName || '').toLowerCase().trim();
    const ehDono = Boolean(idJogadorAtual) && (
        !cronica.autorId
        || cronica.autorId === idJogadorAtual
        || (nomeUsuarioAtual && cronica.autor.toLowerCase().trim() === nomeUsuarioAtual)
    );

    const btnEditar = document.getElementById('btn-editar');
    const btnDeletar = document.getElementById('btn-deletar');

    if (btnEditar) btnEditar.style.display = ehDono ? 'inline-block' : 'none';
    if (btnDeletar) {
        btnDeletar.style.display = ehDono ? 'inline-block' : 'none';
        btnDeletar.onclick = async () => {
            if (!confirm('Deseja apagar permanentemente esta crônica?')) return;
            await remove(ref(db, `cronicas/${id}`));
            await remove(ref(db, `feed/cronica_${id}`));
            if (cronica.caminhoOriginal) await remove(ref(db, cronica.caminhoOriginal));
            if (cronica.caminhoFeedLegado) await remove(ref(db, cronica.caminhoFeedLegado));
            window.fecharModalCronica();
        };
    }

    modal.style.display = 'flex';
}

window.carregarNoEscudoMestre = async function () {
    if (!cronicaAbertaObj) return;

    const salaId = salaAtual || 'mesa-principal';
    const combateRef = ref(db, `salas/${salaId}/mestre/combate`);
    const notasRef = ref(db, `salas/${salaId}/mestre/notas`);

    try {
        const snap = await get(combateRef);
        const atual = snap.val() || { turno: 1, indiceAtivo: 0, combatentes: [] };
        const listaExistente = Array.isArray(atual.combatentes) ? atual.combatentes : [];

        const novosCombatentes = (cronicaAbertaObj.ameacas || []).map((am) => {
            const d12 = Math.floor(Math.random() * 12) + 1;
            const din = Number(am.dinamismo || 3);
            return {
                nome: am.categoria === 'chefe' ? `👑 ${am.nome}` : am.nome,
                pvAtual: Number(am.pvMax || 20),
                pvMax: Number(am.pvMax || 20),
                iniciativa: d12 + din,
                detalhe: `TA ${am.ta || 12} • d12(${d12})+${din}`,
                tipo: 'inimigo'
            };
        });

        const listaFinal = [...listaExistente, ...novosCombatentes].sort((a, b) => b.iniciativa - a.iniciativa);

        await set(combateRef, {
            turno: atual.turno || 1,
            indiceAtivo: 0,
            combatentes: listaFinal
        });

        const snapNotas = await get(notasRef);
        const notasAnteriores = snapNotas.val() || '';
        const cabecalhoCronica = `=== CRÔNICA ATIVA: ${cronicaAbertaObj.titulo.toUpperCase()} (${cronicaAbertaObj.espectro} | ${cronicaAbertaObj.volume}) ===\n${cronicaAbertaObj.texto}\n\n`;
        if (!notasAnteriores.includes(cronicaAbertaObj.titulo.toUpperCase())) {
            await set(notasRef, cabecalhoCronica + notasAnteriores);
        }

        const irParaEscudo = confirm(
            `✅ Crônica "${cronicaAbertaObj.titulo}" e ${novosCombatentes.length} criatura(s)/chefe(s) carregados no Escudo do Guardião!\n\nDeseja abrir o Escudo do Mestre agora?`
        );
        if (irParaEscudo) {
            window.location.href = 'mestre.html';
        }
    } catch (err) {
        console.error('Erro ao carregar no escudo:', err);
        alert('Não foi possível enviar para o Escudo do Mestre: ' + err.message);
    }
};

window.prepararEdicao = function () {
    if (!cronicaAbertaId || !cronicaAbertaObj) return;

    document.getElementById('edit-cronica-id').value = cronicaAbertaId;
    document.getElementById('cronica-titulo').value = cronicaAbertaObj.titulo || '';
    document.getElementById('cronica-espectro').value = cronicaAbertaObj.espectro || 'Índigo';
    document.getElementById('cronica-volume').value = cronicaAbertaObj.volume || 'Volume I';
    document.getElementById('cronica-genero').value = cronicaAbertaObj.genero || 'Mistério Clássico';
    document.getElementById('cronica-jogadores').value = cronicaAbertaObj.jogadores || 4;
    document.getElementById('cronica-imagem').value = (cronicaAbertaObj.imagem || '').startsWith('data:')
        ? ''
        : (cronicaAbertaObj.imagem || '');
    document.getElementById('cronica-texto').value = cronicaAbertaObj.texto || '';

    ameacasSelecionadasForm = Array.isArray(cronicaAbertaObj.ameacas)
        ? cronicaAbertaObj.ameacas.map((a) => ({ ...a }))
        : [];
    renderizarChipsAmeacasForm();

    document.getElementById('form-titulo-cabecalho').textContent = 'Editando Crônica';
    document.getElementById('btn-salvar-cronica').textContent = 'Salvar Alterações';
    const btnCancelar = document.getElementById('btn-cancelar-edicao');
    if (btnCancelar) btnCancelar.style.display = 'block';

    document.getElementById('modal-cronica').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

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
        if (!idJogadorAtual) return alert('Faça login para deixar uma nota à margem.');
        if (!cronicaAbertaId) return;
        const texto = input.value.trim();
        if (!texto) return;

        btnEnviar.disabled = true;
        try {
            await set(push(ref(db, `cronicas/${cronicaAbertaId}/comentarios`)), {
                autor: auth.currentUser?.displayName || 'Arquivista',
                autorId: idJogadorAtual,
                texto,
                criadoEm: Date.now()
            });
            input.value = '';
        } finally {
            btnEnviar.disabled = false;
        }
    };

    btnEnviar.addEventListener('click', enviar);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviar(); });
}

window.fecharModalCronica = function () {
    const modal = document.getElementById('modal-cronica');
    if (modal) modal.style.display = 'none';
    cronicaAbertaId = null;

    const url = new URL(window.location);
    url.searchParams.delete('id');
    window.history.replaceState({}, '', url);
};

window.alternarLike = async function () {
    if (!idJogadorAtual) return alert('Faça login para registrar apoio!');
    if (!cronicaAbertaId) return;

    const snap = await get(ref(db, `cronicas/${cronicaAbertaId}/curtidas`));
    let lista = Array.isArray(snap.val()) ? snap.val() : [];
    lista = lista.includes(idJogadorAtual)
        ? lista.filter((uid) => uid !== idJogadorAtual)
        : [...lista, idJogadorAtual];

    await update(ref(db, `cronicas/${cronicaAbertaId}`), { curtidas: lista });
    document.getElementById('qtd-likes').textContent = lista.length;
};

window.copiarLinkCronica = function () {
    if (!cronicaAbertaId) return;
    const link = `${window.location.origin}${window.location.pathname}?id=${cronicaAbertaId}`;
    navigator.clipboard.writeText(link).then(() => alert('🔗 Link da Crônica copiado!'));
};

document.addEventListener('DOMContentLoaded', () => {
    iniciarCatalogoAmeacas();
    configurarFormularioCronica();
    configurarComentarios();
    iniciarListenersCronicas();
});