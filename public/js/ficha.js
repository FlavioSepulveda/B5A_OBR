import { db, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

export let dadosPersonagem = {
    vigor: 0, dinamismo: 0, razao: 0, determinacao: 0,
    barganha: 0, combate: 0, tecnologia: 0, resistencia: 0,
    intuicao: 0, medicina: 0, investigar: 0, invasao: 0,
    pesquisa: 0, arcanismo: 0, imaginacao: 0, historia: 0
};

window.ajustarDado = function(nomeChave, valor) {
    let novoValor = dadosPersonagem[nomeChave] + valor;
    if (novoValor < 0) novoValor = 0;
    if (novoValor > 10) novoValor = 10; 
    
    dadosPersonagem[nomeChave] = novoValor;
    document.getElementById(`val-${nomeChave}`).textContent = novoValor;
    salvarFicha();
};

window.alterarRecurso = function(recurso, valor) {
    if (!idJogadorAtual) { alert("Faça login!"); return; }
    if (recurso === 'pv') {
        let el = document.getElementById('f-pv-atual');
        let novo = Math.max(0, parseInt(el.textContent) + valor);
        el.textContent = novo;
        if (novo === 0) { document.body.style.backgroundColor = "#3a1010"; setTimeout(() => document.body.style.backgroundColor = "", 500); }
    } else if (recurso === 'pi') {
        let el = document.getElementById('f-pi-atual');
        el.textContent = Math.max(0, parseInt(el.textContent) + valor);
    }
    salvarFicha();
};

export function salvarFicha() {
    if (!idJogadorAtual) return;
    const fichaRef = ref(db, `salas/${salaAtual}/jogadores/${idJogadorAtual}`);
    const dados = {
        nome: document.getElementById('f-nome').value,
        espectro: document.getElementById('f-espectro').value,
        volume: parseInt(document.getElementById('f-volume').value) || 1,
        pvAtual: parseInt(document.getElementById('f-pv-atual').textContent) || 0,
        pvMax: parseInt(document.getElementById('f-pv-max').value) || 10,
        piAtual: parseInt(document.getElementById('f-pi-atual').textContent) || 0,
        piMax: parseInt(document.getElementById('f-pi-max').value) || 5,
        dadosPersonagem: dadosPersonagem
    };
    set(fichaRef, dados).catch(e => console.error("Erro ao salvar:", e));
}

window.addEventListener('usuarioLogado', () => {
    if (!idJogadorAtual) return;
    const fichaRef = ref(db, `salas/${salaAtual}/jogadores/${idJogadorAtual}`);
    onValue(fichaRef, (snapshot) => {
        const d = snapshot.val();
        if (d) {
            document.getElementById('f-nome').value = d.nome || '';
            document.getElementById('f-espectro').value = d.espectro || 'padrao';
            document.getElementById('f-volume').value = d.volume || 1;
            document.getElementById('f-pv-atual').textContent = d.pvAtual || 10;
            document.getElementById('f-pv-max').value = d.pvMax || 10;
            document.getElementById('f-pi-atual').textContent = d.piAtual || 5;
            document.getElementById('f-pi-max').value = d.piMax || 5;
            
            if (d.dadosPersonagem) {
                dadosPersonagem = d.dadosPersonagem;
                for (let k in dadosPersonagem) {
                    let el = document.getElementById(`val-${k}`);
                    if (el) el.textContent = dadosPersonagem[k];
                }
            }
        }
    });
});

document.getElementById('f-nome')?.addEventListener('change', salvarFicha);
document.getElementById('f-espectro')?.addEventListener('change', salvarFicha);
document.getElementById('f-volume')?.addEventListener('change', salvarFicha);