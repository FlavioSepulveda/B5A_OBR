import { db, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

export let dadosPersonagem = {
    vigor: 0, dinamismo: 0, razao: 0, determinacao: 0,
    barganha: 0, combate: 0, tecnologia: 0, resistencia: 0,
    intuicao: 0, medicina: 0, investigar: 0, invasao: 0,
    pesquisa: 0, arcanismo: 0, imaginacao: 0, historia: 0
};

// Função para ajustar os dados (+ e -) com proteção contra NaN
window.ajustarDado = function(nomeChave, valor) {
    let valorAtual = parseInt(dadosPersonagem[nomeChave]);
    if (isNaN(valorAtual)) valorAtual = 0;

    let novoValor = valorAtual + valor;
    
    if (novoValor < 0) novoValor = 0;
    if (novoValor > 10) novoValor = 10; 
    
    dadosPersonagem[nomeChave] = novoValor;
    document.getElementById(`val-${nomeChave}`).textContent = novoValor;
    
    salvarFicha();
};

// Função para alterar Vida e Ímpeto
window.alterarRecurso = function(recurso, valor) {
    if (!idJogadorAtual) { alert("Faça login!"); return; }
    if (recurso === 'pv') {
        let el = document.getElementById('f-pv-atual');
        let atual = parseInt(el.textContent) || 0;
        let novo = Math.max(0, atual + valor);
        el.textContent = novo;
        if (novo === 0) { document.body.style.backgroundColor = "#3a1010"; setTimeout(() => document.body.style.backgroundColor = "", 500); }
    } else if (recurso === 'pi') {
        let el = document.getElementById('f-pi-atual');
        let atual = parseInt(el.textContent) || 0;
        el.textContent = Math.max(0, atual + valor);
    }
    salvarFicha();
};

// Salva os dados no Firebase
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

// Carrega os dados quando o usuário loga
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
                for (let k in dadosPersonagem) {
                    // A MÁGICA ACONTECE AQUI: Garante que o valor lido seja sempre um número válido
                    let val = parseInt(d.dadosPersonagem[k]);
                    dadosPersonagem[k] = isNaN(val) ? 0 : val;
                    
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