import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, set, onValue, update, push, get } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

let colecaoAtual = "";
let itemAbertoId = null;
let curtidasDoItem = [];

window.iniciarCartas = function(colecao) {
    colecaoAtual = colecao;
    configurarFormulario();
    carregarCartas();
};

// ==========================================
// 1. SALVAR ITEM (COM TESTE DE FOGO)
// ==========================================
function configurarFormulario() {
    document.getElementById('btn-salvar-form')?.addEventListener('click', () => {
        // 1. Verifica o Login
        if (!idJogadorAtual) { 
            alert("VOCÊ NÃO ESTÁ LOGADO. Faça login com o Google primeiro!"); 
            return; 
        }

        const titulo = document.getElementById('form-titulo')?.value.trim() || "";
        if (titulo.length < 3) { 
            alert("O NOME PRECISA TER PELO MENOS 3 LETRAS."); 
            return; 
        }

        try {
            const texto = document.getElementById('form-texto')?.value.trim() || "";
            const imagem = document.getElementById('form-imagem')?.value.trim() || "";

            let payload = {
                autor: auth.currentUser?.displayName || "Arquivista",
                titulo: titulo,
                texto: texto,
                imagem: imagem,
                data: Date.now()
            };

            // Pega os campos de acordo com a aba
            if (colecaoAtual === "monstros") {
                payload.vida = document.getElementById('form-vida')?.value || 10;
                payload.ta = document.getElementById('form-ta')?.value || 12;
                payload.dominante = document.getElementById('form-dominante')?.value || "Vigor";
                payload.espectro = document.getElementById('form-espectro')?.value || 'padrao';
                
                payload.habilidades = [];
                for(let i=1; i<=3; i++) {
                    let custoEl = document.getElementById(`form-hab${i}-custo`);
                    let descEl = document.getElementById(`form-hab${i}-desc`);
                    let custo = custoEl ? custoEl.value : "";
                    let desc = descEl ? descEl.value : "";
                    if(desc && desc.trim() !== "") {
                        payload.habilidades.push({ custo: custo, desc: desc });
                    }
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

            // Prepara o caminho no banco
            const idGerado = itemAbertoId || `${colecaoAtual}_${Date.now()}`;
            const caminhoDB = `salas/${salaAtual}/${colecaoAtual}/${idGerado}`;
            const itemRef = ref(db, caminhoDB);

            // 2. Tenta salvar no Firebase
            set(itemRef, payload).then(() => {
                const status = document.getElementById('status-form');
                if (status) {
                    status.textContent = "✅ Salvo com sucesso!";
                    status.style.color = "#4caf50";
                    setTimeout(() => { status.textContent = ""; status.style.color = "#888"; }, 3000);
                }
                
                // Limpa os campos
                document.getElementById('form-titulo').value = "";
                if(document.getElementById('form-texto')) document.getElementById('form-texto').value = "";
                if(document.getElementById('form-efeito')) document.getElementById('form-efeito').value = "";
                if(document.getElementById('form-descarte')) document.getElementById('form-descarte').value = "";
                
                itemAbertoId = null;
            }).catch((error) => {
                console.error("Erro do Firebase:", error);
                // 3. Se o Firebase bloquear, avisa na tela!
                alert("ERRO NO FIREBASE: Verifique se as Regras do Realtime Database estão como 'true'.\n\nCódigo do erro: " + error.message);
            });

        } catch (erro) {
            console.error("Erro de JavaScript:", erro);
            alert("ERRO INTERNO NO SITE: " + erro.message);
        }
    });
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
        if (!dados) { lista.innerHTML = '<p>Nenhuma carta criada ainda.</p>'; return; }

        Object.keys(dados).sort((a,b) => dados[b].data - dados[a].data).forEach(id => {
            const item = dados[id];
            const qtdLikes = item.curtidas ? item.curtidas.length : 0;
            const imgFinal = item.imagem && item.imagem.trim() !== '' ? item.imagem : 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';

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
                item.habilidades.forEach(h => {
                    habsHtml += `<li><strong>${h.custo ? h.custo+':' : ''}</strong> ${h.desc}</li>`;
                });
                habsHtml += `</ul></div>`;
            }

            const textoResumo = item.texto ? item.texto.substring(0, 80) + '...' : '';

            card.innerHTML = `
                <div class="carta-img-container">
                    <img src="${imgFinal}" class="carta-img" onerror="this.src='https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80'">
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
            lista.appendChild(card);
        });
    });
}

// ==========================================
// 3. MODAL (LEITURA, LIKES E COMENTÁRIOS)
// ==========================================
function abrirModal(item, id) {
    itemAbertoId = id;
    curtidasDoItem = item.curtidas || [];
    
    let modal = document.getElementById('modal-dinamico');
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-dinamico';
        modal.className = 'modal-leitura';
        document.body.appendChild(modal);
    }

    const imgFinal = item.imagem && item.imagem.trim() !== '' ? item.imagem : 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';
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
                <img src="${imgFinal}">
            </div>
            <div class="modal-carta-body">
                <h2 style="color:var(--gold); font-family:'Bebas Neue'; font-size:2.5rem; margin-bottom:5px; line-height:1;">${item.titulo}</h2>
                <p style="font-size:0.85rem; color:#aaa; margin-bottom:15px;">${sub}</p>
                <p style="white-space:pre-wrap; line-height:1.5; margin-bottom:15px;">${item.texto || ''}</p>
                ${habsModal}
                
                <div style="display:flex; gap:10px; margin-bottom:20px;">
                    <button id="btn-like" class="btn-curtir" onclick="alternarLike()" style="flex:1;">❤️ <span id="qtd-likes">0</span></button>
                    <button id="btn-editar" class="btn-primario" style="display:none; flex:1;" onclick="prepararEdicao()">Editar</button>
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

    modal.style.display = 'block';
    document.getElementById('btn-editar').style.display = (item.autor === auth.currentUser?.displayName) ? 'block' : 'none';
    atualizarBotaoLike();
    carregarComentarios(id);
}

function fecharModalCartas() {
    document.getElementById('modal-dinamico').style.display = 'none';
}

// ==========================================
// 4. CURTIDAS E COMENTÁRIOS
// ==========================================
function atualizarBotaoLike() {
    const btn = document.getElementById('btn-like');
    const qtdSpan = document.getElementById('qtd-likes');
    if(!btn) return;
    qtdSpan.textContent = curtidasDoItem.length;
    btn.className = (idJogadorAtual && curtidasDoItem.includes(idJogadorAtual)) ? 'btn-curtir curtido' : 'btn-curtir';
}

async function alternarLike() {
    if (!idJogadorAtual) { alert("Faça login!"); return; }
    let novas = [...curtidasDoItem];
    if (novas.includes(idJogadorAtual)) novas = novas.filter(id => id !== idJogadorAtual);
    else novas.push(idJogadorAtual);

    const itemRef = ref(db, `salas/${salaAtual}/${colecaoAtual}/${itemAbertoId}`);
    await update(itemRef, { curtidas: novas });
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
            lista.innerHTML += `
                <div class="comentario-item">
                    <div class="comentario-autor">${c.autor}</div>
                    <div class="comentario-texto">${c.texto}</div>
                </div>
            `;
        });
        lista.scrollTop = lista.scrollHeight;
    });
}

async function enviarComentario() {
    if (!idJogadorAtual) { alert("Faça login para comentar!"); return; }
    const input = document.getElementById('input-comentario');
    const texto = input.value.trim();
    if(!texto) return;

    const comentarioRef = ref(db, `salas/${salaAtual}/${colecaoAtual}/${itemAbertoId}/comentarios`);
    await push(comentarioRef, { autor: auth.currentUser.displayName || "Arquivista", texto: texto });
    input.value = '';
}

// ==========================================
// 5. EDIÇÃO
// ==========================================
function prepararEdicao() {
    get(ref(db, `salas/${salaAtual}/${colecaoAtual}/${itemAbertoId}`)).then((snapshot) => {
        const item = snapshot.val();
        if (!item) return;

        document.getElementById('form-titulo').value = item.titulo;
        if(document.getElementById('form-texto')) document.getElementById('form-texto').value = item.texto || "";
        if(document.getElementById('form-imagem')) document.getElementById('form-imagem').value = item.imagem || "";

        if (colecaoAtual === "monstros") {
            document.getElementById('form-vida').value = item.vida;
            document.getElementById('form-ta').value = item.ta;
            document.getElementById('form-dominante').value = item.dominante;
            if(document.getElementById('form-espectro')) {
                document.getElementById('form-espectro').value = item.espectro || "padrao";
            }
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
            
            let efeito = item.efeito === "Nenhum" ? "" : item.efeito;
            let descarte = item.descarte === "Nenhum" ? "" : item.descarte;
            
            if(document.getElementById('form-efeito')) document.getElementById('form-efeito').value = efeito || "";
            if(document.getElementById('form-descarte')) document.getElementById('form-descarte').value = descarte || "";
        } else if (colecaoAtual === "habilidades") {
            document.getElementById('form-tipo').value = item.tipo;
            document.getElementById('form-custo').value = item.custo || "";
            document.getElementById('form-descarte').value = item.descarte || "";
        }

        fecharModalCartas();
        window.scrollTo(0, 0);
    });
}

window.fecharModalCartas = fecharModalCartas;
window.alternarLike = alternarLike;
window.enviarComentario = enviarComentario;
window.prepararEdicao = prepararEdicao;