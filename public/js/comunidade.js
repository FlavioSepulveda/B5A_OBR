import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// Variáveis globais da tela
let cronicaAbertaId = null;
let curtidasDaCronicaAtual = [];

// ==========================================
// 1. SALVAR / EDITAR CRÔNICA
// ==========================================
document.getElementById('btn-salvar-cronica')?.addEventListener('click', () => {
    if (!idJogadorAtual) { alert("Faça login com o Google para salvar sua história!"); return; }
    
    const titulo = document.getElementById('cronica-titulo').value.trim();
    const jogadores = parseInt(document.getElementById('cronica-jogadores').value) || 1;
    const imagem = document.getElementById('cronica-imagem').value.trim();
    const texto = document.getElementById('cronica-texto').value.trim();
    
    if (titulo.length < 3) { alert("Dê um título para a sua missão!"); return; }
    if (texto.length < 10) { alert("Escreva um pouco mais de resumo!"); return; }

    const nome = auth.currentUser.displayName || "Arquivista Anônimo";
    const cronicaRef = ref(db, `salas/${salaAtual}/cronicas/${idJogadorAtual}`);
    const status = document.getElementById('status-cronica');
    
    status.textContent = "Salvando...";
    
    // Pega as curtidas antigas (se existirem) para não apagar ao editar
    onValue(cronicaRef, (snapshot) => {
        const dadosAntigos = snapshot.val() || {};
        const curtidasAntigas = dadosAntigos.curtidas || [];

        set(cronicaRef, { 
            autor: nome, 
            titulo: titulo,
            jogadores: jogadores,
            imagem: imagem,
            historia: texto, 
            data: Date.now(),
            curtidas: curtidasAntigas 
        })
        .then(() => {
            status.textContent = "✅ Crônica publicada!";
            document.getElementById('cronica-titulo').value = '';
            document.getElementById('cronica-texto').value = '';
            document.getElementById('cronica-imagem').value = '';
            setTimeout(() => status.textContent = "", 3000);
        });
    }, { onlyOnce: true });
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
            lista.innerHTML = '<p style="color: #888; font-style: italic; grid-column: 1/-1;">Nenhuma história registrada ainda.</p>';
            return;
        }

        Object.keys(dados).forEach(idCronica => {
            const c = dados[idCronica];
            const qtdLikes = c.curtidas ? c.curtidas.length : 0;
            
            const div = document.createElement('div');
            div.className = 'card-cronica';
            div.onclick = () => abrirModalCronica(c, idCronica);

            const imagemFinal = c.imagem && c.imagem.trim() !== '' 
                ? c.imagem 
                : 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';

            div.innerHTML = `
                <img src="${imagemFinal}" class="card-cronica-img" onerror="this.src='https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80'">
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
// 3. MODAL E LÓGICA DE LIKE
// ==========================================
function abrirModalCronica(c, idCronica) {
    cronicaAbertaId = idCronica;
    curtidasDaCronicaAtual = c.curtidas || [];
    
    const modal = document.getElementById('modal-cronica');
    document.getElementById('modal-titulo').textContent = c.titulo || 'Crônica sem Título';
    document.getElementById('modal-autor').textContent = `Escrito por: ${c.autor}`;
    document.getElementById('modal-texto').textContent = c.historia;
    
    const imagemFinal = c.imagem && c.imagem.trim() !== '' 
        ? c.imagem 
        : 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';
    
    document.getElementById('modal-img').src = imagemFinal;
    
    modal.style.display = 'block';

    atualizarBotaoLike();

    document.getElementById('btn-editar').style.display = (idJogadorAtual === idCronica) ? 'block' : 'none';
}

function fecharModalCronica() {
    document.getElementById('modal-cronica').style.display = 'none';
}

function atualizarBotaoLike() {
    const btn = document.getElementById('btn-like');
    const qtdSpan = document.getElementById('qtd-likes');
    
    qtdSpan.textContent = curtidasDaCronicaAtual.length;
    
    if (idJogadorAtual && curtidasDaCronicaAtual.includes(idJogadorAtual)) {
        btn.classList.add('curtido');
    } else {
        btn.classList.remove('curtido');
    }
}

async function alternarLike() {
    if (!idJogadorAtual) { alert("Faça login para curtir a história!"); return; }

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
// 4. PREPARAR EDIÇÃO
// ==========================================
function prepararEdicao() {
    const titulo = document.getElementById('modal-titulo').textContent;
    const texto = document.getElementById('modal-texto').textContent;
    const img = document.getElementById('modal-img').src;

    document.getElementById('cronica-titulo').value = titulo;
    document.getElementById('cronica-texto').value = texto;
    document.getElementById('cronica-imagem').value = img;

    fecharModalCronica();
    window.scrollTo(0, 0);
}

window.onclick = function(event) {
    const modal = document.getElementById('modal-cronica');
    if (event.target === modal) {
        fecharModalCronica();
    }
}
 
// Exporta para o HTML acessar
window.abrirModalCronica = abrirModalCronica;
window.fecharModalCronica = fecharModalCronica;
window.alternarLike = alternarLike;
window.prepararEdicao = prepararEdicao;

carregarCronicas();