import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, set, onValue, update, push, get, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

let curtidasDaCronicaAtual = [];

// ==========================================
// 1. SALVAR / EDITAR CRÔNICA
// ==========================================
document.getElementById('btn-salvar-cronica')?.addEventListener('click', () => {
    if (!idJogadorAtual) { alert("Faça login com o Google para publicar!"); return; }
    
    const idEdicao = document.getElementById('edit-cronica-id').value;
    const titulo = document.getElementById('cronica-titulo').value.trim();
    const jogadores = parseInt(document.getElementById('cronica-jogadores').value) || 1;
    const imagemUrl = document.getElementById('cronica-imagem').value.trim();
    const texto = document.getElementById('cronica-texto').value.trim();
    const arquivoInput = document.getElementById('cronica-arquivo');
    
    if (titulo.length < 3) { alert("Dê um título para a sua missão!"); return; }
    if (texto.length < 10) { alert("Escreva um pouco mais de resumo!"); return; }

    const nome = auth.currentUser?.displayName || "Arquivista Anônimo";
    const btn = document.getElementById('btn-salvar-cronica');
    const status = document.getElementById('status-cronica');
    
    btn.textContent = "Salvando...";
    btn.disabled = true;
    status.textContent = "";

    // Função que salva no banco após processar a imagem (se houver)
    const salvarNoBanco = (imagemFinal) => {
        const payload = { 
            autor: nome, 
            titulo: titulo,
            jogadores: jogadores,
            imagem: imagemFinal,
            historia: texto, 
            data: Date.now()
        };

        let promessa;

        if (idEdicao) {
            // Se tem ID de edição, atualiza apenas o que mudou
            const cronicaRef = ref(db, `salas/${salaAtual}/cronicas/${idEdicao}`);
            promessa = update(cronicaRef, payload); 
        } else {
            // Se é nova, cria uma ID única e zera curtidas
            payload.curtidas = [];
            const novaRef = push(ref(db, `salas/${salaAtual}/cronicas`));
            promessa = set(novaRef, payload);
        }

        promessa.then(() => {
            status.textContent = idEdicao ? "✅ Crônica atualizada!" : "✅ Crônica publicada!";
            status.style.color = "#4caf50";
            
            resetarFormulario();
            setTimeout(() => { status.textContent = ""; status.style.color = "#888"; }, 3000);
        }).catch(e => {
            console.error(e); 
            status.textContent = "❌ Erro ao salvar.";
            btn.textContent = idEdicao ? "Salvar Alterações" : "Publicar Crônica";
            btn.disabled = false;
        });
    };

    // Verifica se o jogador subiu um arquivo do PC
    if (arquivoInput && arquivoInput.files.length > 0) {
        const arquivo = arquivoInput.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                // Redimensiona a imagem para no máximo 600px (evita erro no Firebase)
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600;
                const scale = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scale;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Converte para Base64 (comprimido)
                const base64 = canvas.toDataURL('image/jpeg', 0.7);
                salvarNoBanco(base64);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(arquivo);
    } else {
        // Se não subiu arquivo, usa o link digitado
        salvarNoBanco(imagemUrl);
    }
});

function resetarFormulario() {
    document.getElementById('edit-cronica-id').value = "";
    document.getElementById('cronica-titulo').value = "";
    document.getElementById('cronica-jogadores').value = 4;
    document.getElementById('cronica-imagem').value = "";
    if(document.getElementById('cronica-arquivo')) document.getElementById('cronica-arquivo').value = "";
    document.getElementById('cronica-texto').value = "";
    
    const btnSalvar = document.getElementById('btn-salvar-cronica');
    btnSalvar.textContent = "Publicar Crônica";
    btnSalvar.style.background = "var(--gold)";
    btnSalvar.disabled = false;
    
    const btnCancelar = document.getElementById('btn-cancelar-edicao');
    if(btnCancelar) btnCancelar.style.display = 'none';
}

// ==========================================
// 2. RENDERIZAR OS CARDS (COM CORREÇÃO DE IMAGEM BASE64)
// ==========================================
function tempoAtras(timestamp) {
    if (!timestamp) return "Recentemente";
    const segundos = Math.floor((Date.now() - timestamp) / 1000);
    if (segundos < 60) return "Agora mesmo";
    const minutos = Math.floor(segundos / 60);
    if (minutos < 60) return `Há ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Há ${horas} horas`;
    return `Há ${Math.floor(horas / 24)} dias`;
}

function carregarCronicas() {
    const lista = document.getElementById('lista-cronicas');
    if (!lista) return;

    onValue(ref(db, `salas/${salaAtual}/cronicas`), (snapshot) => {
        lista.innerHTML = '';
        const dados = snapshot.val();
        
        if (!dados) {
            lista.innerHTML = '<p style="color: #888; font-style: italic; grid-column: 1/-1;">Nenhuma crônica registrada ainda.</p>';
            return;
        }

        const cronicasArray = Object.keys(dados).map(id => ({ id, ...dados[id] }));
        cronicasArray.sort((a, b) => b.data - a.data);

        cronicasArray.forEach(c => {
            const qtdLikes = c.curtidas ? c.curtidas.length : 0;
            
            const imagemPadrao = 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';
            const imgFinal = c.imagem && c.imagem.trim() !== '' ? c.imagem : imagemPadrao;

            const div = document.createElement('div');
            div.className = 'card-cronica';
            div.onclick = () => abrirModalCronica(c, c.id);

            // O SRC da imagem é injetado via JS depois para não quebrar com Base64 longo
            div.innerHTML = `
                <img class="card-cronica-img" alt="Capa da crônica">
                <div class="card-cronica-body">
                    <div class="card-cronica-titulo">${c.titulo || 'Crônica sem Título'}</div>
                    <div class="card-cronica-info">
                        <span>Por: <strong>${c.autor}</strong></span>
                        <span>${tempoAtras(c.data)}</span>
                    </div>
                    <div class="card-cronica-resumo">${c.historia}</div>
                    <div class="card-cronica-footer">
                        <span>👥 ${c.jogadores || 1} Jogadores</span>
                        <span>❤️ ${qtdLikes}</span>
                    </div>
                </div>
            `;

            const imgElement = div.querySelector('.card-cronica-img');
            imgElement.src = imgFinal;
            imgElement.onerror = () => { imgElement.src = imagemPadrao; };

            lista.appendChild(div);
        });
    });
}

// ==========================================
// 3. MODAL E LÓGICA DE EDIÇÃO/DELETAR
// ==========================================
function abrirModalCronica(c, idCronica) {
    curtidasDaCronicaAtual = c.curtidas || [];
    document.getElementById('modal-cronica').setAttribute('data-id', idCronica);
    
    const modal = document.getElementById('modal-cronica');
    document.getElementById('modal-titulo').textContent = c.titulo || 'Crônica sem Título';
    document.getElementById('modal-autor').textContent = `Escrito por: ${c.autor}`;
    document.getElementById('modal-texto').textContent = c.historia;
    
    const imagemPadrao = 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';
    const imgFinal = c.imagem && c.imagem.trim() !== '' ? c.imagem : imagemPadrao;
    
    const modalImg = document.getElementById('modal-img');
    modalImg.src = imgFinal;
    modalImg.onerror = () => { modalImg.src = imagemPadrao; };
    
    modal.style.display = 'block';

    atualizarBotaoLike();

    const btnEditar = document.getElementById('btn-editar');
    const btnDeletar = document.getElementById('btn-deletar');

    if (c.autor === auth.currentUser?.displayName) {
        if(btnEditar) {
            btnEditar.style.display = 'block';
            btnEditar.onclick = () => {
                document.getElementById('edit-cronica-id').value = idCronica;
                document.getElementById('cronica-titulo').value = c.titulo;
                document.getElementById('cronica-jogadores').value = c.jogadores || 1;
                document.getElementById('cronica-texto').value = c.historia;
                
                if (c.imagem && c.imagem.startsWith('http')) {
                    document.getElementById('cronica-imagem').value = c.imagem;
                } else {
                    document.getElementById('cronica-imagem').value = "";
                }
                
                const btnSalvar = document.getElementById('btn-salvar-cronica');
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

                fecharModalCronica();
                window.scrollTo(0, 0);
            };
        }
        
        if(btnDeletar) {
            btnDeletar.style.display = 'block';
            btnDeletar.onclick = () => {
                if(confirm("Tem certeza que deseja APAGAR essa crônica?")) {
                    remove(ref(db, `salas/${salaAtual}/cronicas/${idCronica}`)).then(() => {
                        fecharModalCronica();
                    });
                }
            };
        }
    } else {
        if(btnEditar) btnEditar.style.display = 'none';
        if(btnDeletar) btnDeletar.style.display = 'none';
    }
}

window.fecharModalCronica = function() {
    document.getElementById('modal-cronica').style.display = 'none';
}

// ==========================================
// 4. LIKES
// ==========================================
function atualizarBotaoLike() {
    const btn = document.getElementById('btn-like');
    const qtdSpan = document.getElementById('qtd-likes');
    if(!btn) return;
    qtdSpan.textContent = curtidasDaCronicaAtual.length;
    btn.className = (idJogadorAtual && curtidasDaCronicaAtual.includes(idJogadorAtual)) ? 'btn-curtir curtido' : 'btn-curtir';
}

window.alternarLike = async function() {
    if (!idJogadorAtual) { alert("Faça login para curtir!"); return; }
    
    const idCronica = document.getElementById('modal-cronica').getAttribute('data-id');
    let novasCurtidas = [...curtidasDaCronicaAtual];
    
    if (novasCurtidas.includes(idJogadorAtual)) {
        novasCurtidas = novasCurtidas.filter(id => id !== idJogadorAtual);
    } else {
        novasCurtidas.push(idJogadorAtual);
    }

    const cronicaRef = ref(db, `salas/${salaAtual}/cronicas/${idCronica}`);
    await update(cronicaRef, { curtidas: novasCurtidas });
    
    curtidasDaCronicaAtual = novasCurtidas;
    atualizarBotaoLike();
}

carregarCronicas();