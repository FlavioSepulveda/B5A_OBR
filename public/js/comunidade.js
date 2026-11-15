import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, set, onValue, update, push, get } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

let cronicaAbertaId = null; // Guarda o ID da crônica que está sendo editada
let curtidasDaCronicaAtual = [];

// ==========================================
// 1. SALVAR / EDITAR CRÔNICA
// ==========================================
document.getElementById('btn-salvar-cronica')?.addEventListener('click', () => {
    if (!idJogadorAtual) { alert("Faça login com o Google para publicar!"); return; }
    
    const titulo = document.getElementById('cronica-titulo').value.trim();
    const jogadores = parseInt(document.getElementById('cronica-jogadores').value) || 1;
    const imagem = document.getElementById('cronica-imagem').value.trim();
    const texto = document.getElementById('cronica-texto').value.trim();
    
    if (titulo.length < 3) { alert("Dê um título para a sua missão!"); return; }
    if (texto.length < 10) { alert("Escreva um pouco mais de resumo!"); return; }

    const nome = auth.currentUser?.displayName || "Arquivista Anônimo";
    const btn = document.getElementById('btn-salvar-cronica');
    const status = document.getElementById('status-cronica');
    
    btn.textContent = "Salvando...";
    btn.disabled = true;
    status.textContent = "";

    // Se estiver editando, pega as curtidas antigas para não apagar
    const salvarDados = (curtidasAntigas = []) => {
        const payload = { 
            autor: nome, 
            titulo: titulo,
            jogadores: jogadores,
            imagem: imagem,
            historia: texto, 
            data: Date.now(),
            curtidas: curtidasAntigas
        };

        let promessa;
        if (cronicaAbertaId) {
            // EDIÇÃO: Atualiza a crônica existente
            const cronicaRef = ref(db, `salas/${salaAtual}/cronicas/${cronicaAbertaId}`);
            promessa = update(cronicaRef, payload);
        } else {
            // NOVA CRÔNICA: Cria uma nova ID única
            const novaRef = push(ref(db, `salas/${salaAtual}/cronicas`));
            promessa = set(novaRef, payload);
        }

        promessa.then(() => {
            status.textContent = cronicaAbertaId ? "✅ Crônica atualizada!" : "✅ Crônica publicada!";
            status.style.color = "#4caf50";
            
            // Limpa o formulário
            document.getElementById('cronica-titulo').value = '';
            document.getElementById('cronica-texto').value = '';
            document.getElementById('cronica-imagem').value = '';
            
            cronicaAbertaId = null; // Reseta o ID de edição
            btn.textContent = "Publicar Crônica";
            btn.disabled = false;
            
            setTimeout(() => { status.textContent = ""; status.style.color = "#888"; }, 3000);
        }).catch(e => {
            console.error(e); 
            status.textContent = "❌ Erro ao salvar.";
            btn.textContent = "Publicar Crônica";
            btn.disabled = false;
        });
    };

    if (cronicaAbertaId) {
        // Puxa as curtidas antigas antes de atualizar
        get(ref(db, `salas/${salaAtual}/cronicas/${cronicaAbertaId}/curtidas`)).then(snap => {
            salvarDados(snap.val() || []);
        });
    } else {
        salvarDados();
    }
});

// ==========================================
// 2. RENDERIZAR OS CARDS
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

        // Ordena do mais novo para o mais antigo
        const cronicasArray = Object.keys(dados).map(id => ({ id, ...dados[id] }));
        cronicasArray.sort((a, b) => b.data - a.data);

        cronicasArray.forEach(c => {
            const qtdLikes = c.curtidas ? c.curtidas.length : 0;
            const imgFinal = c.imagem && c.imagem.trim() !== '' ? c.imagem : 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';

            const div = document.createElement('div');
            div.className = 'card-cronica';
            div.onclick = () => abrirModalCronica(c, c.id);

            div.innerHTML = `
                <img src="${imgFinal}" class="card-cronica-img" onerror="this.src='https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80'">
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
            lista.appendChild(div);
        });
    });
}

// ==========================================
// 3. MODAL (LEITURA E EDIÇÃO)
// ==========================================
function abrirModalCronica(c, idCronica) {
    cronicaAbertaId = idCronica;
    curtidasDaCronicaAtual = c.curtidas || [];
    
    const modal = document.getElementById('modal-cronica');
    
    document.getElementById('modal-titulo').textContent = c.titulo || 'Crônica sem Título';
    document.getElementById('modal-autor').textContent = `Escrito por: ${c.autor}`;
    document.getElementById('modal-texto').textContent = c.historia;
    
    const imgFinal = c.imagem && c.imagem.trim() !== '' ? c.imagem : 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';
    document.getElementById('modal-img').src = imgFinal;
    
    modal.style.display = 'block';

    atualizarBotaoLike();

    // MOSTRA O BOTÃO EDITAR SÓ SE FOR O DONO DA CRÔNICA
    const btnEditar = document.getElementById('btn-editar');
    if (c.autor === auth.currentUser?.displayName) {
        btnEditar.style.display = 'block';
    } else {
        btnEditar.style.display = 'none';
    }
}

window.fecharModalCronica = function() {
    document.getElementById('modal-cronica').style.display = 'none';
    cronicaAbertaId = null;
}

// ==========================================
// 4. LIKES
// ==========================================
function atualizarBotaoLike() {
    const btn = document.getElementById('btn-like');
    const qtdSpan = document.getElementById('qtd-likes');
    if(!btn) return;
    
    qtdSpan.textContent = curtidasDaCronicaAtual.length;
    
    if (idJogadorAtual && curtidasDaCronicaAtual.includes(idJogadorAtual)) {
        btn.classList.add('curtido');
    } else {
        btn.classList.remove('curtido');
    }
}

window.alternarLike = async function() {
    if (!idJogadorAtual) { alert("Faça login para curtir!"); return; }

    let novasCurtidas = [...curtidasDaCronicaAtual];
    if (novasCurtidas.includes(idJogadorAtual)) {
        novasCurtidas = novasCurtidas.filter(id => id !== idJogadorAtual);
    } else {
        novasCurtidas.push(idJogadorAtual);
    }

    const cronicaRef = ref(db, `salas/${salaAtual}/cronicas/${cronicaAbertaId}`);
    await update(cronicaRef, { curtidas: novasCurtidas });
    
    curtidasDaCronicaAtual = novasCurtidas;
    atualizarBotaoLike();
}

// ==========================================
// 5. PREPARAR EDIÇÃO (PUXA PARA O FORMULÁRIO)
// ==========================================
window.prepararEdicao = function() {
    // Pega os dados do modal e joga para o formulário
    const titulo = document.getElementById('modal-titulo').textContent;
    const texto = document.getElementById('modal-texto').textContent;
    const img = document.getElementById('modal-img').src;
    const jogadores = document.getElementById('modal-jogadores-info')?.textContent || 1; 
    // Nota: se você não tem um campo de jogadores no modal, ele vai manter o padrão.

    document.getElementById('cronica-titulo').value = titulo;
    document.getElementById('cronica-texto').value = texto;
    if(img.startsWith('data:')) {
        document.getElementById('cronica-imagem').value = ""; // Se for Base64, limpa o campo
    } else {
        document.getElementById('cronica-imagem').value = img;
    }

    // Muda o texto do botão para avisar que é uma edição
    document.getElementById('btn-salvar-cronica').textContent = "Salvar Alterações";
    
    fecharModalCronica();
    window.scrollTo(0, 0); 
}

// Inicializa
carregarCronicas();