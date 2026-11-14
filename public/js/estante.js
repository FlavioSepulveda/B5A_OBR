import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const container = document.getElementById('estante-container');

window.addEventListener('usuarioLogado', () => {
    if (!idJogadorAtual) return;
    
    const fichasRef = ref(db, `salas/${salaAtual}/jogadores`);
    
    onValue(fichasRef, (snapshot) => {
        container.innerHTML = '';
        const dados = snapshot.val();
        let temPersonagem = false;

        if (dados) {
            Object.keys(dados).forEach(id => {
                if (id === idJogadorAtual) {
                    temPersonagem = true;
                    const ficha = dados[id];
                    
                    const card = document.createElement('div');
                    card.className = 'livro-card';
                    card.onclick = () => window.location.href = `ficha.html?id=${id}`;
                    
                    card.innerHTML = `
                        <div class="livro-titulo">${ficha.nome || 'Sem Nome'}</div>
                        <div class="livro-detalhe">${ficha.espectro || 'Sem Espectro'}</div>
                        <div class="livro-detalhe">Vol. ${ficha.volume || 1}</div>
                    `;
                    container.appendChild(card);
                }
            });
        }

        if (!temPersonagem) {
            container.innerHTML = `
                <div class="livro-vazio">
                    <p>Nenhum personagem na estante ainda.</p>
                    <a href="ficha.html" class="btn-primario" style="text-decoration: none; max-width: 300px;">Criar Novo Arquivista</a>
                </div>
            `;
        }
    });
});