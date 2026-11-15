import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, set, onValue, update, push, get, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

let colecaoAtual = "";
let idItemAbertoNoModal = null; // ID do item que está sendo lido no momento
let curtidasDoItem = [];

window.iniciarCartas = function(colecao) {
    colecaoAtual = colecao;
    configurarFormulario();
    carregarCartas();
};

// ==========================================
// 1. SALVAR ITEM (CRIAR OU ATUALIZAR)
// ==========================================
function configurarFormulario() {
    document.getElementById('btn-salvar-form')?.addEventListener('click', () => {
        if (!idJogadorAtual) { alert("Faça login com o Google para salvar!"); return; }
        
        const titulo = document.getElementById('form-titulo')?.value.trim() || "";
        if (titulo.length < 3) { alert("Dê um nome com pelo menos 3 letras."); return; }

        // Verifica o campo oculto de edição
        const editId = document.getElementById('edit-item-id')?.value || "";

        const btnSalvar = document.getElementById('btn-salvar-form');
        btnSalvar.textContent = "Salvando...";
        btnSalvar.disabled = true;

        const salvarNoBanco = (imagemFinal) => {
            try {
                const texto = document.getElementById('form-texto')?.value.trim() || "";
                
                let payload = {
                    autor: auth.currentUser?.displayName || "Arquivista",
                    titulo: titulo,
                    texto: texto,
                    imagem: imagemFinal,
                    data: Date.now()
                };

                if (colecaoAtual === "monstros") {
                    payload.vida = document.getElementById('form-vida')?.value || 10;
                    payload.ta = document.getElementById('form-ta')?.value || 12;
                    payload.dominante = document.getElementById('form-dominante')?.value || "Vigor";
                    payload.espectro = document.getElementById('form-espectro')?.value || 'padrao';
                    payload.habilidades = [];
                    for(let i=1; i<=3; i++) {
                        let custo = document.getElementById(`form-hab${i}-custo`)?.value || "";
                        let desc = document.getElementById(`form-hab${i}-desc`)?.value || "";
                        if(desc.trim() !== "") payload.habilidades.push({ custo, desc });
                    }
                } else if (colecaoAtual === "armas") {
                    payload.categoria = document.getElementById('form-categoria')?.value || "Média";
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
                    // ATUALIZAR EXISTENTE
                    const itemRef = ref(db, `salas/${salaAtual}/${colecaoAtual}/${editId}`);
                    promessa = update(itemRef, payload);
                } else {
                    // CRIAR NOVO
                    payload.curtidas = [];
                    const novaRef = push(ref(db, `salas/${salaAtual}/${colecaoAtual}`));
                    promessa = set(novaRef, payload);
                }

                promessa.then(() => {
                    const status = document.getElementById('status-form');
                    status.textContent = editId ? "✅ Item atualizado!" : "✅ Item criado!";
                    status.style.color = "#4caf50";
                    
                    resetarFormulario();
                    setTimeout(() => { status.textContent = ""; status.style.color = "#888"; }, 3000);
                }).catch((error) => {
                    console.error("Erro Firebase:", error);
                    alert("Erro ao salvar no banco.");
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
                    const scale = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
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
    document.getElementById('edit-item-id').value = ""; // Limpa o ID invisível
    
    document.getElementById('form-titulo').value = "";
    if(document.getElementById('form-texto')) document.getElementById('form-texto').value = "";
    if(document.getElementById('form-arquivo')) document.getElementById('form-arquivo').value = "";
    if(document.getElementById('form-imagem')) document.getElementById('form-imagem').value = "";
    
    const btnSalvar = document.getElementById('btn-salvar-form');
    btnSalvar.textContent = "Salvar";
    btnSalvar.style.background = "var(--gold)";
    btnSalvar.disabled = false;

    const btnCancelar = document.getElementById('btn-cancelar-edicao');
    if(btnCancelar) btnCancelar.style.display = 'none';
}

// ==========================================
// 2. DESENHAR AS CARTAS
// ==========================================
function carregarCartas() {
    const lista = document.getElementById('lista-cartas');
    if (!lista) return;

    onValue(ref(db, `salas/${salaAtual}/${colecaoAtual}`), (snapshot) => {
        lista.innerHTML = '';
        const dados = snapshot.val();
        if (!dados) { lista.innerHTML = '<p>Nenhum item criado ainda.</p>'; return; }

        Object.keys(dados).sort((a,b) => dados[b].data - dados[a].data).forEach(id => {
            const item = dados[id];
            const qtdLikes = item.curtidas ? item.curtidas.length : 0;
            const imagemPadrao = 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';
            const imgFinal = item.imagem && item.imagem.trim() !== '' ? item.imagem : imagemPadrao;

            const card = document.createElement('div');
            const classeEspectro = item.espectro && item.espectro !== 'padrao' ? `espectro-${item.espectro}` : '';
            card.className = `carta-tcg ${classeEspectro}`;
            card.onclick = () => abrirModal(item, id);

            let statusHtml = "";
            if (colecaoAtual === "monstros") {
                statusHtml = `<div class="carta-status"><span>PV: ${item.vida}</span><span>TA: ${item.ta}</span></div>`;
            } else if (colecaoAtual === "armas") {
                statusHtml = `<div class="carta-status" style="justify-content: flex-start; gap: 10px;">
                    <span style="color: var(--gold);">Dano: ${item.dano || '1d6'}</span>
                    <span style="color: #888;">Crít: ${item.critico || '+1d6'}</span>
                </div>`;
            }

            let habsHtml = "";
            if (item.habilidades && item.habilidades.length > 0) {
                habsHtml = `<div class="carta-habilidades"><ul>`;
                item.habilidades.forEach(h => { habsHtml += `<li><strong>${h.custo ? h.custo+':' : ''}</strong> ${h.desc}</li>`; });
                habsHtml += `</ul></div>`;
            }

            const textoResumo = item.texto ? item.texto.substring(0, 80) + '...' : '';

            card.innerHTML = `
                <div class="carta-img-container">
                    <img class="carta-img" alt="Capa">
                    <div class="carta-nome">${item.titulo}</div>
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
    });
}

// ==========================================
// 3. MODAL E EDIÇÃO
// ==========================================
function abrirModal(item, id) {
    idItemAbertoNoModal = id; 
    curtidasDoItem = item.curtidas || [];
    
    let modal = document.getElementById('modal-dinamico');
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-dinamico';
        modal.className = 'modal-leitura';
        document.body.appendChild(modal);
    }

    const imagemPadrao = 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';
    const imgFinal = item.imagem && item.imagem.trim() !== '' ? item.imagem : imagemPadrao;
    const classeEspectro = item.espectro && item.espectro !== 'padrao' ? `espectro-${item.espectro}` : '';
    
    let sub = `<strong>${item.autor}</strong>`;
    if(colecaoAtual === "monstros") sub += ` | PV: ${item.vida} | TA: ${item.ta} | Dom: ${item.dominante}`;
    if(colecaoAtual === "armas") {
        sub += ` | ${item.categoria} | Dano: ${item.dano} | Crítico: ${item.critico}`;
        if (item.efeito && item.efeito !== "Nenhum") sub += ` | Efeito: ${item.efeito}`;
        if (item.descarte && item.descarte !== "Nenhum") sub += ` | Descarte: ${item.descarte}`;
    }
    if(colecaoAtual === "habilidades") sub += ` | ${item.tipo} | Custo: ${item.custo}`;

    let habsModal = "";
    if (item.habilidades && item.habilidades.length > 0) {
        habsModal = `<div style="background:#111; padding:10px; margin:15px 0; border-radius:4px;"><strong>Habilidades:</strong><ul style="margin-left:20px;">`;
        item.habilidades.forEach(h => { habsModal += `<li><strong>${h.custo}:</strong> ${h.desc}</li>`; });
        habsModal += `</ul></div>`;
    }

    modal.innerHTML = `
        <div class="modal-carta ${classeEspectro}">
            <span class="close-btn" onclick="fecharModalCartas()" style="z-index:10; font-size:40px; text-shadow:0 0 5px #000;">&times;</span>
            <div class="modal-carta-header">
                <img class="modal-img-element" alt="Capa">
            </div>
            <div class="modal-carta-body">
                <h2 style="color:var(--gold); font-family:'Bebas Neue'; font-size:2.5rem; margin-bottom:5px; line-height:1;">${item.titulo}</h2>
                <p style="font-size:0.85rem; color:#aaa; margin-bottom:15px;">${sub}</p>
                <p style="white-space:pre-wrap; line-height:1.5; margin-bottom:15px;">${item.texto || ''}</p>
                ${habsModal}
                
                <div style="display:flex; gap:10px; margin-bottom:20px;">
                    <button id="btn-like" class="btn-curtir" onclick="alternarLike()" style="flex:1;">❤️ <span id="qtd-likes">0</span></button>
                    <button id="btn-editar" class="btn-primario" style="display:none; flex:1;" onclick="prepararEdicao()">Editar</button>
                    <button id="btn-deletar-modal" style="display:none; background:#a83232; color:white; border:none; border-radius:4px; cursor:pointer; flex:1; font-family: 'Bebas Neue', sans-serif; font-size:1.2rem;" onclick="deletarItem('${id}')">Apagar</button>
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
    
    if (item.autor === auth.currentUser?.displayName) {
        document.getElementById('btn-editar').style.display = 'block';
        document.getElementById('btn-deletar-modal').style.display = 'block';
    }

    atualizarBotaoLike();
    carregarComentarios(id);
}

window.fecharModalCartas = function() { 
    document.getElementById('modal-dinamico').style.display = 'none'; 
    idItemAbertoNoModal = null; 
}

// ==========================================
// 4. PREPARAR EDIÇÃO E DELETAR
// ==========================================
window.prepararEdicao = function() {
    if(!idItemAbertoNoModal) return;

    get(ref(db, `salas/${salaAtual}/${colecaoAtual}/${idItemAbertoNoModal}`)).then((snapshot) => {
        const item = snapshot.val();
        if (!item) return;

        // A MÁGICA ESTÁ AQUI: Joga o ID para o input invisível do formulário
        document.getElementById('edit-item-id').value = idItemAbertoNoModal;

        document.getElementById('form-titulo').value = item.titulo;
        if(document.getElementById('form-texto')) document.getElementById('form-texto').value = item.texto || "";
        if(document.getElementById('form-imagem')) document.getElementById('form-imagem').value = item.imagem && item.imagem.startsWith('data:image') ? "" : (item.imagem || "");

        if (colecaoAtual === "monstros") {
            document.getElementById('form-vida').value = item.vida;
            document.getElementById('form-ta').value = item.ta;
            document.getElementById('form-dominante').value = item.dominante;
            if(document.getElementById('form-espectro')) document.getElementById('form-espectro').value = item.espectro || "padrao";
            if(item.habilidades) {
                for(let i=1; i<=3; i++) {
                    let h = item.habilidades[i-1] || { custo: "", desc: "" };
                    document.getElementById(`form-hab${i}-custo`).value = h.custo;
                    document.getElementById(`form-hab${i}-desc`).value = h.desc;
                }
            }
        } else if (colecaoAtual === "armas") {
            document.getElementById('form-categoria').value = item.categoria;
            document.getElementById('form-dano').value = item.dano || "";
            document.getElementById('form-critico').value = item.critico || "";
            if(document.getElementById('form-efeito')) document.getElementById('form-efeito').value = item.efeito === "Nenhum" ? "" : item.efeito;
            if(document.getElementById('form-descarte')) document.getElementById('form-descarte').value = item.descarte === "Nenhum" ? "" : item.descarte;
        } else if (colecaoAtual === "habilidades") {
            document.getElementById('form-tipo').value = item.tipo;
            document.getElementById('form-custo').value = item.custo || "";
            document.getElementById('form-descarte').value = item.descarte || "";
        }

        const btnSalvar = document.getElementById('btn-salvar-form');
        btnSalvar.textContent = "Salvar Alterações";
        btnSalvar.style.background = "#4caf50";

        let btnCancelar = document.getElementById('btn-cancelar-edicao');
        if(!btnCancelar) {
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
    });
}

window.deletarItem = function(id) {
    if(confirm("Tem certeza que deseja APAGAR este item permanentemente?")) {
        remove(ref(db, `salas/${salaAtual}/${colecaoAtual}/${id}`)).then(() => {
            fecharModalCartas();
            resetarFormulario();
        });
    }
}

// ==========================================
// 5. LIKES E COMENTÁRIOS
// ==========================================
function atualizarBotaoLike() {
    const btn = document.getElementById('btn-like');
    if(!btn) return;
    document.getElementById('qtd-likes').textContent = curtidasDoItem.length;
    btn.className = (idJogadorAtual && curtidasDoItem.includes(idJogadorAtual)) ? 'btn-curtir curtido' : 'btn-curtir';
}

async function alternarLike() {
    if (!idJogadorAtual) { alert("Faça login!"); return; }
    let novas = [...curtidasDoItem];
    if (novas.includes(idJogadorAtual)) novas = novas.filter(id => id !== idJogadorAtual);
    else novas.push(idJogadorAtual);

    await update(ref(db, `salas/${salaAtual}/${colecaoAtual}/${idItemAbertoNoModal}`), { curtidas: novas });
    curtidasDoItem = novas;
    atualizarBotaoLike();
}

function carregarComentarios(itemId) {
    const lista = document.getElementById('lista-comentarios');
    if(!lista) return;
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
    if(!input.value.trim()) return;
    await push(ref(db, `salas/${salaAtual}/${colecaoAtual}/${idItemAbertoNoModal}/comentarios`), { autor: auth.currentUser.displayName || "Arquivista", texto: input.value.trim() });
    input.value = '';
}

window.alternarLike = alternarLike;
window.enviarComentario = enviarComentario;