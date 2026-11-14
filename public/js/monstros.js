import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

document.getElementById('btn-salvar-monstro')?.addEventListener('click', () => {
    if (!idJogadorAtual) { alert("Faça login!"); return; }
    
    const nome = document.getElementById('monstro-nome').value.trim();
    const pv = document.getElementById('monstro-pv').value;
    const ta = document.getElementById('monstro-ta').value;
    const espectro = document.getElementById('monstro-espectro').value;
    const desc = document.getElementById('monstro-desc').value.trim();
    
    if (!nome) { alert("Dê um nome à criatura!"); return; }

    // Salva no Firebase
    const monstrosRef = ref(db, `salas/${salaAtual}/bestiario`);
    push(monstrosRef, { nome, pv, ta, espectro, desc, autor: auth.currentUser.displayName, data: Date.now() })
    .then(() => {
        document.getElementById('monstro-nome').value = '';
        document.getElementById('monstro-desc').value = '';
    });
});

function carregarMonstros() {
    const lista = document.getElementById('lista-monstros');
    onValue(ref(db, `salas/${salaAtual}/bestiario`), (snapshot) => {
        lista.innerHTML = '';
        const dados = snapshot.val();
        if (!dados) { lista.innerHTML = '<p style="color: #888;">Nenhuma criatura registrada.</p>'; return; }

        Object.values(dados).reverse().forEach(m => {
            const div = document.createElement('div');
            div.className = 'card-cronica'; // Reutiliza o CSS da comunidade
            div.innerHTML = `
                <div class="card-cronica-body">
                    <div class="card-cronica-titulo">${m.nome}</div>
                    <div class="card-cronica-info">
                        <span>${m.espectro}</span>
                        <span>PV: ${m.pv} | TA: ${m.ta}</span>
                    </div>
                    <div class="card-cronica-resumo">${m.desc}</div>
                    <div class="card-cronica-footer"><span>Criado por: ${m.autor}</span></div>
                </div>
            `;
            lista.appendChild(div);
        });
    });
}
carregarMonstros();