import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

document.getElementById('btn-salvar-hab')?.addEventListener('click', () => {
    if (!idJogadorAtual) { alert("Faça login!"); return; }
    const tipo = document.getElementById('hab-tipo').value; // Palavra, Frase ou Título
    const nome = document.getElementById('hab-nome').value.trim();
    const custo = document.getElementById('hab-custo').value;
    const desc = document.getElementById('hab-desc').value.trim();

    push(ref(db, `salas/${salaAtual}/habilidades`), { tipo, nome, custo, desc, autor: auth.currentUser.displayName })
    .then(() => { document.getElementById('hab-nome').value = ''; document.getElementById('hab-desc').value = ''; });
});