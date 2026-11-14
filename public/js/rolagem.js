import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { dadosPersonagem } from './ficha.js';
import { ref, push, onChildAdded, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

window.rolarTeste = function(nomeExibicao, nomeChave, faces) {
    if (!idJogadorAtual) { alert("Faça login para rolar!"); return; }

    const qtd = dadosPersonagem[nomeChave];
    const vol = parseInt(document.getElementById('f-volume').value) || 1;
    const d12 = Math.floor(Math.random() * 12) + 1;
    
    if (qtd === 0) {
        let d12_1 = Math.floor(Math.random() * 12) + 1;
        let d12_2 = Math.floor(Math.random() * 12) + 1;
        let d12_desafio = Math.max(d12_1, d12_2);
        const total = d12_desafio + vol;
        exibirResultado(d12_desafio, 0, vol, total, "Desafio", true, d12_1, d12_2);
        enviarParaHistorico(`${nomeExibicao} (Desafio)`, d12_desafio, 0, vol, total);
        return;
    }

    let soma = 0;
    for(let i=0; i<qtd; i++) soma += Math.floor(Math.random() * faces) + 1;
    const total = d12 + soma + vol;
    
    exibirResultado(d12, soma, vol, total, `${qtd}d${faces}`);
    enviarParaHistorico(nomeExibicao, d12, soma, vol, total);
};

document.getElementById('btn-desafiar')?.addEventListener('click', () => {
    if (!idJogadorAtual) { alert("Faça login!"); return; }
    const vol = parseInt(document.getElementById('f-volume').value) || 1;
    let d1 = Math.floor(Math.random() * 12) + 1;
    let d2 = Math.floor(Math.random() * 12) + 1;
    let d12 = Math.max(d1, d2);
    const total = d12 + vol;
    exibirResultado(d12, 0, vol, total, "Desafio Manual", true, d1, d2);
    enviarParaHistorico("Desafiar o Destino", d12, 0, vol, total);
});

function exibirResultado(d12, soma, vol, total, labelDado, isDesafio = false, d1 = 0, d2 = 0) {
    const container = document.getElementById('resultado-container');
    container.className = 'resultado-container';
    
    const espectro = document.getElementById('f-espectro').value;
    if (espectro !== 'padrao') container.classList.add(`espectro-${espectro}`);

    document.getElementById('dado-d12').textContent = d12;
    document.getElementById('total-visual').innerHTML = `Total: <strong>${total}</strong>`;

    if (isDesafio) {
        document.getElementById('dados-outros').textContent = "-";
        document.getElementById('label-outros').textContent = "Desafio (2d12)";
        document.getElementById('total-visual').innerHTML += `<br><small style="color:#888;">Rolou ${d1} e ${d2}. Manteve ${d12}</small>`;
    } else {
        document.getElementById('dados-outros').textContent = soma;
        document.getElementById('label-outros').textContent = labelDado;
    }

    if (d12 === 1) document.getElementById('total-visual').innerHTML += `<br><span style="color:#ff4d4d; font-weight:bold;">Catástrofe!</span>`;
    if (d12 === 6) document.getElementById('total-visual').innerHTML += `<br><span style="color:#ff9800; font-weight:bold;">Falha Absoluta!</span>`;
    if (d12 === 12) document.getElementById('total-visual').innerHTML += `<br><span style="color:#4caf50; font-weight:bold;">Lendário!</span>`;
}

function enviarParaHistorico(nomeAcao, d12, soma, vol, total) {
    const nome = document.getElementById('f-nome').value.trim() || "Arquivista";
    const rolagemRef = ref(db, `salas/${salaAtual}/rolagens`);
    push(rolagemRef, { nome: `${nome} (${nomeAcao})`, d12, outros: soma, vol, total });
}

function adicionarHistoricoNaTela(dados) {
    const aviso = document.getElementById('aviso-historico-vazio');
    if (aviso) aviso.style.display = 'none';

    const li = document.createElement('li');
    if (dados.d12 === 1) li.classList.add('hist-1');
    if (dados.d12 === 6) li.classList.add('hist-6');
    if (dados.d12 === 12) li.classList.add('hist-12');

    li.innerHTML = `
        <div>
            <strong>${dados.nome}</strong> 
            <div class="hist-detalhe">${dados.d12} (d12) + ${dados.outros} + ${dados.vol} (Vol)</div>
        </div>
        <div class="hist-total">${dados.total}</div>
    `;
    document.getElementById('lista-historico-global').prepend(li);
}

const salaRef = query(ref(db, `salas/${salaAtual}/rolagens`), limitToLast(20));
onChildAdded(salaRef, (snapshot) => adicionarHistoricoNaTela(snapshot.val()));