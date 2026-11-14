import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

document.getElementById('btn-salvar-arma')?.addEventListener('click', () => {
    if (!idJogadorAtual) { alert("Faça login!"); return; }
    const nome = document.getElementById('arma-nome').value.trim();
    const dano = document.getElementById('arma-dano').value;
    const cat = document.getElementById('arma-categoria').value;
    const desc = document.getElementById('arma-desc').value.trim();
    
    if (!nome) { alert("Dê um nome à arma!"); return; }

    push(ref(db, `salas/${salaAtual}/armas`), { nome, dano, cat, desc, autor: auth.currentUser.displayName })
    .then(() => { document.getElementById('arma-nome').value = ''; document.getElementById('arma-desc').value = ''; });
});

// O carregamento é idêntico ao de monstros, mudando só o caminho do banco (`/armas`).