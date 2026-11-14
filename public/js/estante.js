import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const container = document.getElementById('estante-container');

function renderizarEstante() {
    if (!idJogadorAtual) {
        container.innerHTML = `
            <div class="livro-vazio">
                <p>Faça login para ver a sua estante.</p>
            </div>
        `;
        return;
    }

    const fichasRef = ref(db, `salas/${salaAtual}/jogadores`);
    
    onValue(fichasRef, (snapshot) => {
        container.innerHTML = '';
        const dados = snapshot.val();
        let temPersonagem = false;

        if (dados && dados[idJogadorAtual]) {
            temPersonagem = true;
            const ficha = dados[idJogadorAtual];
            
            const card = document.createElement('div');
            card.className = 'livro-card';
            // Ao clicar, vai para a ficha passando o ID na URL
            card.onclick = () => window.location.href = `ficha.html?id=${idJogadorAtual}`;
            
            card.innerHTML = `
                <div class="livro-titulo">${ficha.nome || 'Sem Nome'}</div>
                <div class="livro-detalhe">${ficha.espectro || 'Sem Espectro'}</div>
                <div class="livro-detalhe">Vol. ${ficha.volume || 1}</div>
            `;
            container.appendChild(card);
        }

        if (!temPersonagem) {
            container.innerHTML = `
                <div class="livro-vazio">
                    <p>Nenhum personagem na estante ainda.</p>
                    <a href="ficha.html" class="btn-primario" style="text-decoration: none; max-width: 250px; padding: 10px;">Criar Novo Arquivista</a>
                </div>
            `;
        }
    });
}

// Escuta o evento de login do firebase.js
window.addEventListener('usuarioLogado', renderizarEstante);

// Caso o usuário já esteja logado e o evento tenha passado, tenta renderizar
setTimeout(renderizarEstante, 1000);