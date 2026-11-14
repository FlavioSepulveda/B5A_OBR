import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

document.getElementById('btn-salvar-cronica')?.addEventListener('click', () => {
    if (!idJogadorAtual) { alert("Faça login com o Google para salvar sua história!"); return; }
    
    const texto = document.getElementById('cronica-texto').value.trim();
    if (texto.length < 10) { alert("Escreva um pouco mais! Sua história é importante."); return; }

    const nome = document.getElementById('f-nome').value.trim() || auth.currentUser.displayName || "Arquivista Anônimo";
    const cronicaRef = ref(db, `salas/${salaAtual}/cronicas/${idJogadorAtual}`);
    const status = document.getElementById('status-cronica');
    
    status.textContent = "Salvando...";
    set(cronicaRef, { autor: nome, historia: texto, data: Date.now() })
        .then(() => {
            status.textContent = "✅ Prólogo salvo com sucesso!";
            setTimeout(() => status.textContent = "", 3000);
        }).catch(e => {
            console.error(e); status.textContent = "❌ Erro ao salvar.";
        });
});

function carregarCronicas() {
    const lista = document.getElementById('lista-cronicas');
    if (!lista) return;

    onValue(ref(db, `salas/${salaAtual}/cronicas`), (snapshot) => {
        lista.innerHTML = '';
        const dados = snapshot.val();
        if (!dados) {
            lista.innerHTML = '<p style="color: #888; font-style: italic;">Nenhuma história registrada ainda. Seja o primeiro!</p>';
            return;
        }

        Object.values(dados).sort((a, b) => b.data - a.data).forEach(c => {
            const div = document.createElement('div');
            div.style.cssText = "background: #222; padding: 15px; border-left: 4px solid var(--gold); border-radius: 4px; margin-bottom: 10px;";
            div.innerHTML = `
                <h4 style="color: var(--gold); font-family: 'Bebas Neue'; font-size: 1.3rem; margin-bottom: 5px;">${c.autor}</h4>
                <p style="color: #ccc; font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap;">${c.historia}</p>
            `;
            lista.appendChild(div);
        });
    });
}
carregarCronicas();