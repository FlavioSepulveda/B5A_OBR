import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, query, limitToLast, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// SUA CONFIGURAÇÃO DO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDVpq__JyU5KTQ6p6zB6DTqey4k2jaEFZo",
  authDomain: "b5at-44d1d.firebaseapp.com",
  databaseURL: "https://b5at-44d1d-default-rtdb.firebaseio.com/",
  projectId: "b5at-44d1d",
  storageBucket: "b5at-44d1d.firebasestorage.app",
  messagingSenderId: "394788459759",
  appId: "1:394788459759:web:7050aa055cec655b88b71a"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let idJogadorAtual = null;
let fichaRef = null;
let salaAtual = "sala-padrao";

// ==========================================
// ELEMENTOS DO DOM (FICHA E ROLAGEM)
// ==========================================
const salaInput = document.getElementById('sala-id');
const statusLogin = document.getElementById('status-login');
const nomeSalaExibicao = document.getElementById('nome-sala-exibicao');
const btnLogin = document.getElementById('btn-login');

// Elementos da Ficha
const fNome = document.getElementById('f-nome');
const fEspectro = document.getElementById('f-espectro');
const fVolume = document.getElementById('f-volume');
const fPvAtual = document.getElementById('f-pv-atual');
const fPvMax = document.getElementById('f-pv-max');
const fPiAtual = document.getElementById('f-pi-atual');
const fPiMax = document.getElementById('f-pi-max');
const fVigor = document.getElementById('f-vigor');
const fDinamismo = document.getElementById('f-dinamismo');
const fRazao = document.getElementById('f-razao');
const fDeterminacao = document.getElementById('f-determinacao');

// Elementos da Rolagem
const btnRolar = document.getElementById('btn-rolar');
const inputQtd = document.getElementById('qtd-dados');
const inputVolume = document.getElementById('volume');
const dadoD12 = document.getElementById('dado-d12');
const dadosOutros = document.getElementById('dados-outros');
const labelOutros = document.getElementById('label-outros');
const totalVisual = document.getElementById('total-visual');
const regraTexto = document.getElementById('regra-texto');
const container = document.getElementById('resultado-container');
const toggles = document.querySelectorAll('.toggle');
const listaHistorico = document.getElementById('lista-historico-global');

let tipoRolagem = 'atributo'; 

// ==========================================
// LÓGICA DE ROLAGEM E CORES
// ==========================================
function atualizarLabel() {
    const qtd = inputQtd.value || 0;
    labelOutros.textContent = tipoRolagem === 'atributo' ? `${qtd}d4` : `${qtd}d6`;
}
if (inputQtd) inputQtd.addEventListener('input', atualizarLabel);

toggles.forEach(btn => {
    btn.addEventListener('click', () => {
        toggles.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        tipoRolagem = btn.dataset.tipo;
        atualizarLabel();
    });
});

const REGRAS = { 1: "Catástrofe Definitiva!", 6: "Falha Absoluta!", 12: "Momento Lendário!" };

function rolarDados(quantidade, faces) {
    const resultados = [];
    for (let i = 0; i < quantidade; i++) {
        resultados.push(Math.floor(Math.random() * faces) + 1);
    }
    return resultados;
}

function adicionarHistoricoNaTela(dados) {
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
    listaHistorico.prepend(li);
}

function conectarSala(idSala) {
    listaHistorico.innerHTML = '';
    salaAtual = idSala;
    if (nomeSalaExibicao) nomeSalaExibicao.textContent = idSala;
    const salaRef = query(ref(db, `salas/${idSala}/rolagens`), limitToLast(20));
    
    onChildAdded(salaRef, (snapshot) => {
        adicionarHistoricoNaTela(snapshot.val());
    });
}

if (salaInput) {
    salaInput.addEventListener('change', () => {
        conectarSala(salaInput.value.trim() || "sala-padrao");
    });
}

if (btnRolar) {
    btnRolar.addEventListener('click', () => {
        // 1. RESETAR E APLICAR COR DO ESPECTRO
        container.className = 'resultado-container'; 
        regraTexto.style.display = 'none';
        
        // AQUI ESTÁ A CORREÇÃO DAS CORES: Pega o valor do dropdown de Espectro
        if (fEspectro && fEspectro.value !== 'padrao') {
            container.classList.add(`espectro-${fEspectro.value}`);
        }

        const nome = fNome.value.trim() || "Arquivista";
        const qtdDados = Math.max(0, parseInt(inputQtd.value) || 0);
        const volume = Math.max(1, Math.min(8, parseInt(inputVolume.value) || 1));
        const faces = tipoRolagem === 'atributo' ? 4 : 6;
        const nomeDado = tipoRolagem === 'atributo' ? 'd4' : 'd6';

        const rolagemD12 = Math.floor(Math.random() * 12) + 1;
        const resultadosDados = rolarDados(qtdDados, faces);
        const somaDados = resultadosDados.reduce((a, b) => a + b, 0);
        const total = rolagemD12 + somaDados + volume;

        // 2. ATUALIZAR A TELA
        dadoD12.textContent = rolagemD12;
        dadosOutros.textContent = somaDados;
        totalVisual.innerHTML = `Total: <strong>${total}</strong>`;

        // 3. VERIFICAR RESULTADOS ABSOLUTOS
        if (REGRAS[rolagemD12]) {
            regraTexto.textContent = REGRAS[rolagemD12];
            regraTexto.style.display = 'block';
        }

        // 4. SALVAR NO HISTÓRICO GLOBAL
        const rolagemRef = ref(db, `salas/${salaAtual}/rolagens`);
        push(rolagemRef, { nome: nome, d12: rolagemD12, outros: somaDados, vol: volume, total: total });
    });
}

// ==========================================
// LÓGICA DE LOGIN E FICHA
// ==========================================
if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch((error) => {
            console.error("Erro no login com Google:", error);
            alert("Não foi possível fazer login. Verifique se o Google está ativado no Firebase.");
        });
    });
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        idJogadorAtual = user.uid;
        statusLogin.textContent = `✅ ${user.displayName || user.email}`;
        if (btnLogin) btnLogin.style.display = 'none'; 
        iniciarFicha();
    } else {
        idJogadorAtual = null;
        statusLogin.textContent = "🔴 Faça login para salvar sua ficha";
        if (btnLogin) btnLogin.style.display = 'block'; 
    }
});

function iniciarFicha() {
    if (!idJogadorAtual) return;
    salaAtual = salaInput.value.trim() || "sala-padrao";
    fichaRef = ref(db, `salas/${salaAtual}/jogadores/${idJogadorAtual}`);

    onValue(fichaRef, (snapshot) => {
        const dados = snapshot.val();
        if (dados) {
            fNome.value = dados.nome || '';
            fEspectro.value = dados.espectro || 'padrao';
            fVolume.value = dados.volume || 1;
            fPvAtual.textContent = dados.pvAtual || 0;
            fPvMax.value = dados.pvMax || 10;
            fPiAtual.textContent = dados.piAtual || 0;
            fPiMax.value = dados.piMax || 5;
            fVigor.value = dados.vigor || '0d4';
            fDinamismo.value = dados.dinamismo || '0d4';
            fRazao.value = dados.razao || '0d4';
            fDeterminacao.value = dados.determinacao || '0d4';
        }
    });
}

function salvarFicha() {
    if (!fichaRef || !idJogadorAtual) return;
    const dados = {
        nome: fNome.value,
        espectro: fEspectro.value,
        volume: parseInt(fVolume.value) || 1,
        pvAtual: parseInt(fPvAtual.textContent) || 0,
        pvMax: parseInt(fPvMax.value) || 0,
        piAtual: parseInt(fPiAtual.textContent) || 0,
        piMax: parseInt(fPiMax.value) || 0,
        vigor: fVigor.value,
        dinamismo: fDinamismo.value,
        razao: fRazao.value,
        determinacao: fDeterminacao.value
    };
    set(fichaRef, dados).catch(e => console.error("Erro ao salvar:", e));
}

document.querySelectorAll('.coluna-ficha input, .coluna-ficha select').forEach(el => {
    el.addEventListener('change', salvarFicha);
});

window.alterarRecurso = function(recurso, valor) {
    if (!idJogadorAtual) {
        alert("Faça login com o Google para salvar sua ficha!");
        return;
    }
    
    if (recurso === 'pv') {
        let atual = parseInt(fPvAtual.textContent) || 0;
        let novo = Math.max(0, atual + valor);
        fPvAtual.textContent = novo;
        if (novo === 0) {
            document.body.style.backgroundColor = "#3a1010";
            setTimeout(() => document.body.style.backgroundColor = "", 500);
        }
    } else if (recurso === 'pi') {
        let atual = parseInt(fPiAtual.textContent) || 0;
        fPiAtual.textContent = Math.max(0, atual + valor);
    }
    salvarFicha();
};

// Inicia a sala padrão
conectarSala("sala-padrao");