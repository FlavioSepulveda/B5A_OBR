import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

document.getElementById('btn-salvar-cronica')?.addEventListener('click', () => {
    if (!idJogadorAtual) { alert("Faça login com o Google para salvar sua história!"); return; }
    
    const titulo = document.getElementById('cronica-titulo').value.trim();
    const jogadores = parseInt(document.getElementById('cronica-jogadores').value) || 1;
    const imagem = document.getElementById('cronica-imagem').value.trim();
    const texto = document.getElementById('cronica-texto').value.trim();
    
    if (titulo.length < 3) { alert("Dê um título para a sua missão!"); return; }
    if (texto.length < 10) { alert("Escreva um pouco mais de resumo!"); return; }

    const nome = document.getElementById('f-nome').value.trim() || auth.currentUser.displayName || "Arquivista Anônimo";
    const cronicaRef = ref(db, `salas/${salaAtual}/cronicas/${idJogadorAtual}`);
    const status = document.getElementById('status-cronica');
    
    status.textContent = "Salvando...";
    set(cronicaRef, { 
        autor: nome, 
        titulo: titulo,
        jogadores: jogadores,
        imagem: imagem,
        historia: texto, 
        data: Date.now() 
    })
    .then(() => {
        status.textContent = "✅ Crônica publicada!";
        document.getElementById('cronica-titulo').value = '';
        document.getElementById('cronica-texto').value = '';
        document.getElementById('cronica-imagem').value = '';
        setTimeout(() => status.textContent = "", 3000);
    }).catch(e => {
        console.error(e); status.textContent = "❌ Erro ao salvar.";
    });
});

// Função para formatar o "Tempo Atrás" (ex: Há 2 horas)
function tempoAtras(timestamp) {
    const segundos = Math.floor((Date.now() - timestamp) / 1000);
    if (segundos < 60) return "Agora mesmo";
    const minutos = Math.floor(segundos / 60);
    if (minutos < 60) return `Há ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Há ${horas} horas`;
    const dias = Math.floor(horas / 24);
    return `Há ${dias} dias`;
}

function carregarCronicas() {
    const lista = document.getElementById('lista-cronicas');
    if (!lista) return;

    onValue(ref(db, `salas/${salaAtual}/cronicas`), (snapshot) => {
        lista.innerHTML = '';
        const dados = snapshot.val();
        if (!dados) {
            lista.innerHTML = '<p style="color: #888; font-style: italic; grid-column: 1/-1;">Nenhuma história registrada ainda. Seja o primeiro!</p>';
            return;
        }

        Object.values(dados).sort((a, b) => b.data - a.data).forEach(c => {
            const div = document.createElement('div');
            div.className = 'card-cronica';

            // Imagem padrão caso o jogador não coloque link
            const imagemFinal = c.imagem ? c.imagem : 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';

            div.innerHTML = `
                <img src="${imagemFinal}" alt="Capa da crônica" class="card-cronica-img" onerror="this.src='https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80'">
                <div class="card-cronica-body">
                    <div class="card-cronica-titulo">${c.titulo || 'Crônica sem Título'}</div>
                    
                    <div class="card-cronica-info">
                        <span>Por: <strong>${c.autor}</strong></span>
                        <span>${tempoAtras(c.data)}</span>
                    </div>
                    
                    <div class="card-cronica-resumo">${c.historia}</div>
                    
                    <div class="card-cronica-footer">
                        <span>👥 ${c.jogadores || 1} Jogadores</span>
                    </div>
                </div>
            `;
            lista.appendChild(div);
        });
    });
}
carregarCronicas();