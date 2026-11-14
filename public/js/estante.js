import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

function carregarEstante() {
    const container = document.getElementById('estante-container');
    if (!container) return;

    window.addEventListener('usuarioLogado', () => {
        if (!idJogadorAtual) return;
        
        // Puxa a ficha atual do jogador
        const fichaRef = ref(db, `salas/${salaAtual}/jogadores/${idJogadorAtual}`);
        
        onValue(fichaRef, (snapshot) => {
            const dados = snapshot.val();
            container.innerHTML = '';

            if (dados) {
                // Transforma o personagem em um Livro
                const livro = document.createElement('div');
                livro.className = 'livro';
                // Ao clicar, vai para a página da ficha
                livro.onclick = () => window.location.href = 'ficha.html'; 
                
                livro.innerHTML = `
                    <div class="livro-texto">${dados.nome || 'Sem Nome'}</div>
                `;
                container.appendChild(livro);
            } else {
                container.innerHTML = '<p style="color: #888; font-style: italic;">Sua estante está vazia. Crie um personagem na Mesa de Jogo.</p>';
            }
        });
    });
}

carregarEstante();