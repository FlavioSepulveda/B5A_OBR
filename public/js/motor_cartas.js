import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, set, onValue, update, push, get, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

let colecaoAtual = "";
let idItemAbertoNoModal = null;
let curtidasDoItem = [];

window.iniciarCartas = function(colecao) {
    colecaoAtual = colecao;
    configurarFormulario();
    carregarCartas();
};

// ==========================================
// 1. SALVAR ITEM (Salva na sala e espelha na raiz para o Feed Global)
// ==========================================
function configurarFormulario() {
    document.getElementById('btn-salvar-form')?.addEventListener('click', () => {
        if (!idJogadorAtual) { alert("Faça login com o Google para salvar!"); return; }
        
        const titulo = document.getElementById('form-titulo')?.value.trim() || "";
        if (titulo.length < 3) { alert("Dê um nome com pelo menos 3 letras."); return; }

        const editId = document.getElementById('edit-item-id')?.value || "";

        const btnSalvar = document.getElementById('btn-salvar-form');
        btnSalvar.textContent = "Salvando...";
        btnSalvar.disabled = true;

        const salvarNoBanco = (imagemFinal) => {
            try {
                const texto = document.getElementById('form-texto')?.value.trim() || "";
                
                let payload = {
                    autor: auth.currentUser?.displayName || "Arquivista",
                    autorId: idJogadorAtual,
                    titulo: titulo,
                    nome: titulo,
                    texto: texto,
                    descricao: texto,
                    imagem: imagemFinal,
                    data: Date.now(),
                    criadoEm: Date.now()
                };

                if (colecaoAtual === "monstros") {
                    payload.vida = document.getElementById('form-vida')?.value || 10;
                    payload.pv = payload.vida;
                    payload.ta = document.getElementById('form-ta')?.value || 12;
                    payload.nivel = document.getElementById('form-nivel')?.value || "Comum";
                    payload.vigor = document.getElementById('form-vigor')?.value || "0d4";
                    payload.dinamismo = document.getElementById('form-dinamismo')?.value || "0d4";
                    payload.razao = document.getElementById('form-razao')?.value || "0d4";
                    payload.determinacao = document.getElementById('form-determinacao')?.value || "0d4";
                    payload.dominante = document.getElementById('form-dominante')?.value || "Vigor";
                    payload.espectro = document.getElementById('form-espectro')?.value || 'padrao';
                    
                    payload.habilidades = [];
                    for (let i = 1; i <= 3; i++) {
                        let custo = document.getElementById(`form-hab${i}-custo`)?.value || "";
                        let desc = document.getElementById(`form-hab${i}-desc`)?.value || "";
                        if (desc.trim() !== "") payload.habilidades.push({ custo, desc });
                    }
                } else if (colecaoAtual === "armas") {
                    payload.categoria = document.getElementById('form-categoria')?.value || "Média";
                    payload.tipo = payload.categoria;
                    payload.dano = document.getElementById('form-dano')?.value || "1d6";
                    payload.critico = document.getElementById('form-critico')?.value || "+1d6";
                    payload.efeito = document.getElementById('form-efeito')?.value.trim() || "Nenhum";
                    payload.descarte = document.getElementById('form-descarte')?.value.trim() || "Nenhum";
                } else if (colecaoAtual === "habilidades") {
                    payload.tipo = document.getElementById('form-tipo')?.value || "Palavra";
                    payload.custo = document.getElementById('form-custo')?.value || "";
                    payload.descarte = document.getElementById('form-descarte')?.value || "";
                }

                let promessa;
                if (editId) {
                    const itemRef = ref(db, `salas/${salaAtual}/${colecaoAtual}/${editId}`);
                    promessa = update(itemRef, payload).then(() =>
                        update(ref(db, `${colecaoAtual}/${editId}`), payload).catch(() => {})
                    );
                } else {
                    payload.curtidas = [];
                    const novaRef = push(ref(db, `salas/${salaAtual}/${colecaoAtual}`));
                    const novoId = novaRef.key;
                    promessa = set(novaRef, payload).then(() =>
                        set(ref(db, `${colecaoAtual}/${novoId}`), payload).catch(() => {})
                    );
                }

                promessa.then(() => {
                    const status = document.getElementById('status-form');
                    if (status) {
                        status.textContent = editId ? "✅ Item atualizado!" : "✅ Item criado!";
                        status.style.color = "#4caf50";
                        setTimeout(() => { status.textContent = ""; status.style.color = "#888"; }, 3000);
                    }
                    resetarFormulario();
                }).catch((error) => {
                    console.error("Erro Firebase:", error);
                    alert("Erro ao salvar no banco: " + error.message);
                    btnSalvar.textContent = "Salvar";
                    btnSalvar.disabled = false;
                });
            } catch (e) {
                console.error("Erro JS:", e);
                btnSalvar.textContent = "Salvar";
                btnSalvar.disabled = false;
            }
        };

        const arquivoInput = document.getElementById('form-arquivo');
        const urlInput = document.getElementById('form-imagem')?.value.trim() || "";

        if (arquivoInput && arquivoInput.files.length > 0) {
            const arquivo = arquivoInput.files[0];
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 500;
                    const scale = Math.min(1, MAX_WIDTH / img.width);
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const base64 = canvas.toDataURL('image/jpeg', 0.7);
                    salvarNoBanco(base64);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(arquivo);
        } else {
            salvarNoBanco(urlInput);
        }
    });
}

window.resetarFormulario = function() {
    const editInput = document.getElementById('edit-item-id');
    if (editInput) editInput.value = "";
    
    const tituloInput = document.getElementById('form-titulo');
    if (tituloInput) tituloInput.value = "";
    if (document.getElementById('form-texto')) document.getElementById('form-texto').value = "";
    if (document.getElementById('form-arquivo')) document.getElementById('form-arquivo').value = "";
    if (document.getElementById('form-imagem')) document.getElementById('form-imagem').value = "";
    
    const btnSalvar = document.getElementById('btn-salvar-form');
    if (btnSalvar) {
        btnSalvar.textContent = "Salvar";
        btnSalvar.style.background = "var(--gold)";
        btnSalvar.disabled = false;
    }

    const btnCancelar = document.getElementById('btn-cancelar-edicao');
    if (btnCancelar) btnCancelar.style.display = 'none';
};

// ==========================================
// 2. DESENHAR AS CARTAS (Lê da sala e da raiz para não perder nenhum registro)
// ==========================================
function carregarCartas() {
    const lista = document.getElementById('lista-cartas');
    if (!lista) return;

    let dadosSala = {};
    let dadosRaiz = {};

    const renderizar = () => {
        const dados = { ...dadosRaiz, ...dadosSala };
        lista.innerHTML = '';

        const chaves = Object.keys(dados);
        if (chaves.length === 0) {
            lista.innerHTML = '<p style="color:#888; padding:10px;">Nenhum item criado ainda.</p>';
            return;
        }

        chaves
            .sort((a, b) => (dados[b]?.data || dados[b]?.criadoEm || 0) - (dados[a]?.data || dados[a]?.criadoEm || 0))
            .forEach(id => {
                const item = dados[id];
                if (!item || typeof item !== 'object') return;

                const tituloItem = item.titulo || item.nome || "Sem Título";
                const textoItem = item.texto || item.descricao || "";
                const qtdLikes = Array.isArray(item.curtidas) ? item.curtidas.length : 0;
                const imagemPadrao = 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';
                const imgFinal = item.imagem && item.imagem.trim() !== '' ? item.imagem : imagemPadrao;

                const card = document.createElement('div');
                const classeEspectro = item.espectro && item.espectro !== 'padrao' ? `espectro-${item.espectro}` : '';
                card.className = `carta-tcg ${classeEspectro}`;
                card.onclick = () => abrirModal(item, id);

                let statusHtml = "";
                if (colecaoAtual === "monstros") {
                    statusHtml = `
                        <div class="carta-status" style="flex-direction: column; gap: 5px;">
                            <div style="display:flex; justify-content:space-between; width:100%;">
                                <span>PV: ${item.vida ?? item.pv ?? 10}</span><span>TA: ${item.ta ?? 12}</span>
                            </div>
                            <div style="font-size:0.7rem; color:#aaa;">Nível: ${item.nivel || 'Comum'}</div>
                        </div>`;
                } else if (colecaoAtual === "armas") {
                    statusHtml = `<div class="carta-status" style="justify-content: flex-start; gap: 10px;">
                        <span style="color: var(--gold);">Dano: ${item.dano || '1d6'}</span>
                        <span style="color: #888;">Crít: ${item.critico || '+1d6'}</span>
                    </div>`;
                }

                let habsHtml = "";
                if (Array.isArray(item.habilidades) && item.habilidades.length > 0) {
                    habsHtml = `<div class="carta-habilidades"><ul>`;
                    item.habilidades.forEach(h => { habsHtml += `<li><strong>${h.custo ? h.custo + ':' : ''}</strong> ${h.desc}</li>`; });
                    habsHtml += `</ul></div>`;
                }

                const textoResumo = textoItem ? (textoItem.length > 80 ? textoItem.substring(0, 80) + '...' : textoItem) : '';

                card.innerHTML = `
                    <div class="carta-img-container">
                        <img class="carta-img" alt="Capa">
                        <div class="carta-nome">${tituloItem}</div>
                    </div>
                    <div class="carta-corpo">
                        ${statusHtml}
                        <div class="carta-descricao">${textoResumo}</div>
                        ${habsHtml}
                        <div class="carta-rodape">
                            <span>❤️ ${qtdLikes}</span>
                            <span>Por: ${item.autor ? item.autor.split(' ')[0] : 'Anônimo'}</span>
                        </div>
                    </div>
                `;

                const imgElement = card.querySelector('.carta-img');
                imgElement.src = imgFinal;
                imgElement.onerror = () => { imgElement.src = imagemPadrao; };

                lista.appendChild(card);
            });
    };

    onValue(ref(db, `salas/${salaAtual}/${colecaoAtual}`), (snapshot) => {
        dadosSala = snapshot.val() || {};
        renderizar();
    }, (err) => console.error("Erro ao ler sala:", err));

    onValue(ref(db, `${colecaoAtual}`), (snapshot) => {
        dadosRaiz = snapshot.val() || {};
        renderizar();
    }, (err) => console.warn("Leitura raiz opcional:", err));
}

// ==========================================
// 3. MODAL E EDIÇÃO
// ==========================================
function abrirModal(item, id) {
    idItemAbertoNoModal = id;
    curtidasDoItem = Array.isArray(item.curtidas) ? item.curtidas : [];
    
    let modal = document.getElementById('modal-dinamico');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-dinamico';
        modal.className = 'modal-leitura';
        document.body.appendChild(modal);
    }

    const tituloItem = item.titulo || item.nome || "Sem Título";
    const textoItem = item.texto || item.descricao || "";
    const imagemPadrao = 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';
    const imgFinal = item.imagem && item.imagem.trim() !== '' ? item.imagem : imagemPadrao;
    const classeEspectro = item.espectro && item.espectro !== 'padrao' ? `espectro-${item.espectro}` : '';
    
    let sub = `<strong>${item.autor || 'Arquivista'}</strong>`;
    if (colecaoAtual === "monstros") {
        sub += `<br>PV: ${item.vida ?? item.pv ?? 10} | TA: ${item.ta ?? 12} | Nível: ${item.nivel || 'Comum'} | Dom: ${item.dominante || 'Vigor'}`;
        sub += `<br><span style="font-size:0.75rem; color:#888;">Atributos: VIG ${item.vigor || '0d4'} | DIN ${item.dinamismo || '0d4'} | RAZ ${item.razao || '0d4'} | DET ${item.determinacao || '0d4'}</span>`;
    }
    if (colecaoAtual === "armas") {
        sub += ` | ${item.categoria || 'Média'} | Dano: ${item.dano || '1d6'} | Crítico: ${item.critico || '+1d6'}`;
        if (item.efeito && item.efeito !== "Nenhum") sub += ` | Efeito: ${item.efeito}`;
        if (item.descarte && item.descarte !== "Nenhum") sub += ` | Descarte: ${item.descarte}`;
    }
    if (colecaoAtual === "habilidades") sub += ` | ${item.tipo || 'Palavra'} | Custo: ${item.custo || '-'}`;

    let habsModal = "";
    if (Array.isArray(item.habilidades) && item.habilidades.length > 0) {
        habsModal = `<div style="background:#111; padding:10px; margin:15px 0; border-radius:4px;"><strong>Habilidades:</strong><ul style="margin-left:20px;">`;
        item.habilidades.forEach(h => { habsModal += `<li><strong>${h.custo}:</strong> ${h.desc}</li>`; });
        habsModal += `</ul></div>`;
    }

    const isDono = item.autorId ? item.autorId === idJogadorAtual : item.autor === auth.currentUser?.displayName;
    const displayEditar = isDono ? 'block' : 'none';
    const displayDeletar = isDono ? 'block' : 'none';
    const displayEquipar = (colecaoAtual === "armas" || colecaoAtual === "habilidades") ? 'block' : 'none';

    modal.innerHTML = `
        <div class="modal-carta ${classeEspectro}">
            <span class="close-btn" onclick="fecharModalCartas()" style="z-index:10; font-size:40px; text-shadow:0 0 5px #000;">&times;</span>
            <div class="modal-carta-header">
                <img class="modal-img-element" alt="Capa">
            </div>
            <div class="modal-carta-body">
                <h2 style="color:var(--gold); font-family:'Bebas Neue'; font-size:2.5rem; margin-bottom:5px; line-height:1;">${tituloItem}</h2>
                <p style="font-size:0.85rem; color:#aaa; margin-bottom:15px;">${sub}</p>
                <p style="white-space:pre-wrap; line-height:1.5; margin-bottom:15px;">${textoItem}</p>
                ${habsModal}
                
                <div style="display:flex; gap:10px; margin-bottom:20px; flex-wrap: wrap;">
                    <button id="btn-like" class="btn-curtir" onclick="alternarLike()" style="flex:1; min-width: 100px;">❤️ <span id="qtd-likes">0</span></button>
                    <button id="btn-equipar" class="btn-primario" style="display:${displayEquipar}; flex:1; min-width: 100px; background: #3d5a80; color:#fff;" onclick="equiparNaFicha()">📜 Equipar na Ficha</button>
                    <button id="btn-editar" class="btn-primario" style="display:${displayEditar}; flex:1; min-width: 100px;" onclick="prepararEdicao()">Editar</button>
                    <button id="btn-deletar-modal" style="display:${displayDeletar}; background:#a83232; color:white; border:none; border-radius:4px; cursor:pointer; flex:1; min-width: 100px; font-family: 'Bebas Neue', sans-serif; font-size:1.2rem;" onclick="deletarItem('${id}')">Apagar</button>
                </div>

                <div class="secao-comentarios">
                    <h4 style="color:var(--gold); margin-bottom:10px;">Comentários</h4>
                    <div class="lista-comentarios" id="lista-comentarios"></div>
                    <div class="form-comentario">
                        <input type="text" id="input-comentario" placeholder="Escreva um comentário...">
                        <button class="btn-primario" style="width:auto; padding:0 15px; font-size:1rem;" onclick="enviarComentario()">Enviar</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const modalImg = modal.querySelector('.modal-img-element');
    modalImg.src = imgFinal;
    modalImg.onerror = () => { modalImg.src = imagemPadrao; };

    modal.style.display = 'block';
    atualizarBotaoLike();
    carregarComentarios(id);
}

window.fecharModalCartas = function() {
    const modal = document.getElementById('modal-dinamico');
    if (modal) modal.style.display = 'none';
    idItemAbertoNoModal = null;
};

// ==========================================
// SELETOR DE FICHA DA ESTANTE PARA EQUIPAR
// ==========================================
async function buscarFichasDoUsuario(uid) {
    const fichasEncontradas = [];
    const caminhosVistos = new Set();

    const registrar = (caminho, dados) => {
        if (!dados || typeof dados !== 'object' || caminhosVistos.has(caminho)) return;
        if (!dados.nome && !dados.caminho && !dados.espectro) return;
        caminhosVistos.add(caminho);
        fichasEncontradas.push({ caminho, dados });
    };

    const caminhosPossiveis = [
        `usuarios/${uid}/fichas`,
        `usuarios/${uid}/personagens`,
        `estante/${uid}`,
        `fichas/${uid}`
    ];

    for (const path of caminhosPossiveis) {
        try {
            const snap = await get(ref(db, path));
            const val = snap.val();
            if (val && typeof val === 'object') {
                Object.entries(val).forEach(([fId, fData]) => {
                    registrar(`${path}/${fId}`, fData);
                });
            }
        } catch (e) { /* ignora caminho ausente */ }
    }

    // Ficha ativa na sala padrão / sala atual
    for (const sala of new Set([salaAtual, 'sala-padrao'])) {
        try {
            const snap = await get(ref(db, `salas/${sala}/jogadores/${uid}`));
            if (snap.exists()) {
                registrar(`salas/${sala}/jogadores/${uid}`, snap.val());
            }
        } catch (e) { /* ignora */ }
    }

    // Busca na coleção raiz 'fichas' filtrando por dono
    try {
        const snapRaiz = await get(ref(db, 'fichas'));
        const valRaiz = snapRaiz.val();
        if (valRaiz && typeof valRaiz === 'object') {
            Object.entries(valRaiz).forEach(([fId, fData]) => {
                if (fData && (fData.uid === uid || fData.autorId === uid || fData.donoId === uid || fData.userId === uid)) {
                    registrar(`fichas/${fId}`, fData);
                }
            });
        }
    } catch (e) { /* ignora */ }

    return fichasEncontradas;
}

function abrirModalEscolhaFicha(fichas, item) {
    let seletor = document.getElementById('modal-seletor-ficha-b5a');
    if (!seletor) {
        seletor = document.createElement('div');
        seletor.id = 'modal-seletor-ficha-b5a';
        seletor.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.88); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;';
        document.body.appendChild(seletor);
    }

    const tituloItem = item.titulo || item.nome || "Item";

    seletor.innerHTML = `
        <div style="background:#161318; border:1px solid #d4af37; border-radius:10px; padding:20px; width:100%; max-width:420px; box-shadow:0 10px 35px rgba(0,0,0,0.9);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding-bottom:10px; margin-bottom:12px;">
                <h3 style="font-family:'Bebas Neue',sans-serif; color:#d4af37; font-size:1.5rem; letter-spacing:1px;">Escolher Arquivista</h3>
                <button type="button" id="fechar-seletor-ficha" style="background:none; border:none; color:#aaa; font-size:1.6rem; cursor:pointer; line-height:1;">&times;</button>
            </div>
            <p style="font-size:0.84rem; color:#ccc; margin-bottom:14px;">Para qual ficha você deseja enviar <strong style="color:#d4af37;">${tituloItem}</strong>?</p>
            <div id="opcoes-fichas-lista" style="display:flex; flex-direction:column; gap:8px; max-height:280px; overflow-y:auto;"></div>
        </div>
    `;

    const listaEl = seletor.querySelector('#opcoes-fichas-lista');
    fichas.forEach(({ caminho, dados }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = 'background:#1f1b24; border:1px solid #3d3647; color:#ece6d8; padding:10px 14px; border-radius:6px; text-align:left; cursor:pointer; display:flex; justify-content:space-between; align-items:center;';
        btn.onmouseenter = () => (btn.style.borderColor = '#d4af37');
        btn.onmouseleave = () => (btn.style.borderColor = '#3d3647');

        const nomeChar = dados.nome || 'Arquivista sem nome';
        const infoExtra = `Vol. ${dados.volume || 1}${dados.caminho ? ' • ' + dados.caminho : ''}`;

        btn.innerHTML = `
            <div>
                <strong style="display:block; color:#d4af37; font-size:0.95rem;">${nomeChar}</strong>
                <span style="font-size:0.75rem; color:#9c9283;">${infoExtra}</span>
            </div>
            <span style="font-family:'Bebas Neue',sans-serif; color:#2ec4b6; font-size:1rem;">Equipar →</span>
        `;

        btn.onclick = async () => {
            await gravarItemNaFichaEscolhida(caminho, dados, item);
            seletor.style.display = 'none';
        };
        listaEl.appendChild(btn);
    });

    seletor.querySelector('#fechar-seletor-ficha').onclick = () => (seletor.style.display = 'none');
    seletor.onclick = (e) => { if (e.target === seletor) seletor.style.display = 'none'; };
    seletor.style.display = 'flex';
}

async function gravarItemNaFichaEscolhida(caminhoFicha, ficha, item) {
    const tituloItem = item.titulo || item.nome || "Item";
    const inventario = Array.isArray(ficha.inventario) ? [...ficha.inventario] : [];
    const grimorio = Array.isArray(ficha.grimorio) ? [...ficha.grimorio] : [];

    if (colecaoAtual === "armas") {
        inventario.push({
            nome: tituloItem,
            tipo: "Arma",
            dano: item.dano || "1d6",
            critico: item.critico || "+1d6",
            efeito: item.efeito || "",
            descarte: item.descarte || "",
            idOrigem: idItemAbertoNoModal
        });
        await update(ref(db, caminhoFicha), { inventario });
    } else if (colecaoAtual === "habilidades") {
        grimorio.push({
            nome: tituloItem,
            tipo: item.tipo || "Palavra de Afirmação",
            custo: item.custo || "",
            descarte: item.descarte || "",
            desc: item.texto || item.descricao || "",
            idOrigem: idItemAbertoNoModal
        });
        await update(ref(db, caminhoFicha), { grimorio });
    }

    alert(`✅ "${tituloItem}" adicionado à ficha de ${ficha.nome || 'seu Arquivista'}!`);
}

window.equiparNaFicha = async function() {
    if (!idJogadorAtual) { alert("Faça login para equipar!"); return; }
    if (!idItemAbertoNoModal) return;

    let itemSnap = await get(ref(db, `salas/${salaAtual}/${colecaoAtual}/${idItemAbertoNoModal}`));
    if (!itemSnap.exists()) {
        itemSnap = await get(ref(db, `${colecaoAtual}/${idItemAbertoNoModal}`));
    }
    const item = itemSnap.val();
    if (!item) return;

    const fichas = await buscarFichasDoUsuario(idJogadorAtual);

    if (fichas.length === 0) {
        alert("Você ainda não possui nenhuma ficha na Estante! Crie um Arquivista primeiro.");
        return;
    }

    abrirModalEscolhaFicha(fichas, item);
};

// ==========================================
// 4. PREPARAR EDIÇÃO E DELETAR
// ==========================================
window.prepararEdicao = async function() {
    if (!idItemAbertoNoModal) return;

    let snapshot = await get(ref(db, `salas/${salaAtual}/${colecaoAtual}/${idItemAbertoNoModal}`));
    if (!snapshot.exists()) {
        snapshot = await get(ref(db, `${colecaoAtual}/${idItemAbertoNoModal}`));
    }
    const item = snapshot.val();
    if (!item) return;

    const editInput = document.getElementById('edit-item-id');
    if (editInput) editInput.value = idItemAbertoNoModal;

    document.getElementById('form-titulo').value = item.titulo || item.nome || "";
    if (document.getElementById('form-texto')) document.getElementById('form-texto').value = item.texto || item.descricao || "";
    if (document.getElementById('form-imagem')) document.getElementById('form-imagem').value = item.imagem && item.imagem.startsWith('data:image') ? "" : (item.imagem || "");

    if (colecaoAtual === "monstros") {
        document.getElementById('form-vida').value = item.vida ?? item.pv ?? 10;
        document.getElementById('form-ta').value = item.ta ?? 12;
        document.getElementById('form-nivel').value = item.nivel || "Comum";
        document.getElementById('form-vigor').value = item.vigor || "0d4";
        document.getElementById('form-dinamismo').value = item.dinamismo || "0d4";
        document.getElementById('form-razao').value = item.razao || "0d4";
        document.getElementById('form-determinacao').value = item.determinacao || "0d4";
        document.getElementById('form-dominante').value = item.dominante || "Vigor";
        if (document.getElementById('form-espectro')) document.getElementById('form-espectro').value = item.espectro || "padrao";
        
        if (Array.isArray(item.habilidades)) {
            for (let i = 1; i <= 3; i++) {
                let h = item.habilidades[i - 1] || { custo: "", desc: "" };
                document.getElementById(`form-hab${i}-custo`).value = h.custo || "";
                document.getElementById(`form-hab${i}-desc`).value = h.desc || "";
            }
        }
    } else if (colecaoAtual === "armas") {
        document.getElementById('form-categoria').value = item.categoria || "Média";
        document.getElementById('form-dano').value = item.dano || "";
        document.getElementById('form-critico').value = item.critico || "";
        if (document.getElementById('form-efeito')) document.getElementById('form-efeito').value = item.efeito === "Nenhum" ? "" : (item.efeito || "");
        if (document.getElementById('form-descarte')) document.getElementById('form-descarte').value = item.descarte === "Nenhum" ? "" : (item.descarte || "");
    } else if (colecaoAtual === "habilidades") {
        document.getElementById('form-tipo').value = item.tipo || "Palavra de Afirmação";
        document.getElementById('form-custo').value = item.custo || "";
        document.getElementById('form-descarte').value = item.descarte || "";
    }

    const btnSalvar = document.getElementById('btn-salvar-form');
    btnSalvar.textContent = "Salvar Alterações";
    btnSalvar.style.background = "#4caf50";

    let btnCancelar = document.getElementById('btn-cancelar-edicao');
    if (!btnCancelar) {
        btnCancelar = document.createElement('button');
        btnCancelar.id = 'btn-cancelar-edicao';
        btnCancelar.className = 'btn-primario';
        btnCancelar.style.background = '#a83232';
        btnCancelar.style.marginTop = '5px';
        btnCancelar.textContent = 'Cancelar Edição';
        btnCancelar.onclick = resetarFormulario;
        btnSalvar.parentNode.appendChild(btnCancelar);
    }
    btnCancelar.style.display = 'block';

    fecharModalCartas();
    window.scrollTo(0, 0);
};

window.deletarItem = function(id) {
    if (confirm("Tem certeza que deseja APAGAR este item permanentemente?")) {
        Promise.all([
            remove(ref(db, `salas/${salaAtual}/${colecaoAtual}/${id}`)).catch(() => {}),
            remove(ref(db, `${colecaoAtual}/${id}`)).catch(() => {})
        ]).then(() => {
            fecharModalCartas();
            resetarFormulario();
        });
    }
};

// ==========================================
// 5. LIKES E COMENTÁRIOS
// ==========================================
function atualizarBotaoLike() {
    const btn = document.getElementById('btn-like');
    if (!btn) return;
    document.getElementById('qtd-likes').textContent = curtidasDoItem.length;
    btn.className = (idJogadorAtual && curtidasDoItem.includes(idJogadorAtual)) ? 'btn-curtir curtido' : 'btn-curtir';
}

async function alternarLike() {
    if (!idJogadorAtual) { alert("Faça login!"); return; }
    let novas = [...curtidasDoItem];
    if (novas.includes(idJogadorAtual)) novas = novas.filter(id => id !== idJogadorAtual);
    else novas.push(idJogadorAtual);

    await update(ref(db, `salas/${salaAtual}/${colecaoAtual}/${idItemAbertoNoModal}`), { curtidas: novas }).catch(() => {});
    await update(ref(db, `${colecaoAtual}/${idItemAbertoNoModal}`), { curtidas: novas }).catch(() => {});
    curtidasDoItem = novas;
    atualizarBotaoLike();
}

function carregarComentarios(itemId) {
    const lista = document.getElementById('lista-comentarios');
    if (!lista) return;
    onValue(ref(db, `salas/${salaAtual}/${colecaoAtual}/${itemId}/comentarios`), (snapshot) => {
        lista.innerHTML = '';
        const dados = snapshot.val();
        if (!dados) { lista.innerHTML = '<p style="font-size:0.8rem; color:#666;">Nenhum comentário.</p>'; return; }
        Object.values(dados).forEach(c => {
            lista.innerHTML += `<div class="comentario-item"><div class="comentario-autor">${c.autor}</div><div class="comentario-texto">${c.texto}</div></div>`;
        });
        lista.scrollTop = lista.scrollHeight;
    });
}

async function enviarComentario() {
    if (!idJogadorAtual) { alert("Faça login!"); return; }
    const input = document.getElementById('input-comentario');
    if (!input.value.trim()) return;
    await push(ref(db, `salas/${salaAtual}/${colecaoAtual}/${idItemAbertoNoModal}/comentarios`), {
        autor: auth.currentUser?.displayName || "Arquivista",
        texto: input.value.trim()
    });
    input.value = '';
}

window.alternarLike = alternarLike;
window.enviarComentario = enviarComentario;