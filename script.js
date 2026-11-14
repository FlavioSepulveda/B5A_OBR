import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, query, limitToLast, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVpq__JyU5KTQ6p6zB6DTqey4k2jaEFZo",
  authDomain: "b5at-44d1d.firebaseapp.com",
  databaseURL: "https://b5at-44d1d-default-rtdb.firebaseio.com/", // <-- VERIFIQUE ESTA LINHA
  projectId: "b5at-44d1d",
  storageBucket: "b5at-44d1d.firebasestorage.app",
  messagingSenderId: "394788459759",
  appId: "1:394788459759:web:7050aa055cec655b88b71a"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Referências DOM Rolagem
const btnRolar = document.getElementById('btn-rolar');
const inputNome = document.getElementById('nome-jogador');
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
const inputSala = document.getElementById('sala-id');

let tipoRolagem = 'atributo'; 
let salaAtual = inputSala.value;

function atualizarLabel() {
    const qtd = inputQtd.value || 0;
    labelOutros.textContent = tipoRolagem === 'atributo' ? `${qtd}d4` : `${qtd}d6`;
}
inputQtd.addEventListener('input', atualizarLabel);

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
    const salaRef = query(ref(db, 'salas/' + idSala + '/rolagens'), limitToLast(20));
    onChildAdded(salaRef, (snapshot) => { adicionarHistoricoNaTela(snapshot.val()); });
}
conectarSala(inputSala.value);
inputSala.addEventListener('change', () => conectarSala(inputSala.value));

btnRolar.addEventListener('click', () => {
    container.className = 'resultado-container'; 
    regraTexto.style.display = 'none';
    const selectEspectro = document.getElementById('espectro');
    if (selectEspectro && selectEspectro.value !== 'padrao') container.classList.add(`espectro-${selectEspectro.value}`);

    const nome = inputNome.value.trim() || "Arquivista";
    const qtdDados = Math.max(0, parseInt(inputQtd.value) || 0);
    const volume = Math.max(1, Math.min(8, parseInt(inputVolume.value) || 1));
    const faces = tipoRolagem === 'atributo' ? 4 : 6;
    const nomeDado = tipoRolagem === 'atributo' ? 'd4' : 'd6';

    const rolagemD12 = Math.floor(Math.random() * 12) + 1;
    const resultadosDados = rolarDados(qtdDados, faces);
    const somaDados = resultadosDados.reduce((a, b) => a + b, 0);
    const total = rolagemD12 + somaDados + volume;

    dadoD12.textContent = rolagemD12;
    dadosOutros.textContent = somaDados;
    totalVisual.innerHTML = `Total: <strong>${total}</strong>`;

    if (REGRAS[rolagemD12]) {
        regraTexto.textContent = REGRAS[rolagemD12];
        regraTexto.style.display = 'block';
        if (rolagemD12 === 1) container.classList.add('resultado-1');
        if (rolagemD12 === 6) container.classList.add('resultado-6');
        if (rolagemD12 === 12) container.classList.add('resultado-12');
    }

    const rolagemRef = ref(db, 'salas/' + salaAtual + '/rolagens');
    push(rolagemRef, { nome: nome, d12: rolagemD12, outros: somaDados, vol: volume, total: total });
});

// ==========================================
// LÓGICA DA FICHA
// ==========================================
const btnSalvarFicha = document.getElementById('btn-salvar-ficha');
let fichaRef = null;

const el = (id) => document.getElementById(id);
const fNome = el('f-nome'), fVolume = el('f-volume'), fPvAtual = el('f-pv-atual'), fPvMax = el('f-pv-max'), fPiAtual = el('f-pi-atual'), fPiMax = el('f-pi-max');

window.alterarRecurso = function(recurso, valor) {
    if (recurso === 'pv') {
        let novo = Math.max(0, (parseInt(fPvAtual.value) || 0) + valor);
        fPvAtual.value = novo;
        if (novo === 0) {
            document.body.style.backgroundColor = "#3a1010";
            setTimeout(() => document.body.style.backgroundColor = "", 500);
        }
    } else if (recurso === 'pi') {
        fPiAtual.value = Math.max(0, (parseInt(fPiAtual.value) || 0) + valor);
    }
    salvarFicha(); 
};

function conectarFicha() {
    const idSala = inputSala.value;
    const nomePersonagem = fNome.value.trim() || inputNome.value.trim() || "Arquivista";
    fichaRef = ref(db, 'salas/' + idSala + '/fichas/' + nomePersonagem);

    onValue(fichaRef, (snapshot) => {
        const dados = snapshot.val();
        if (dados) {
            fNome.value = dados.nome || '';
            fVolume.value = dados.volume || 1;
            fPvAtual.value = dados.pvAtual || 0;
            fPvMax.value = dados.pvMax || 10;
            fPiAtual.value = dados.piAtual || 0;
            fPiMax.value = dados.piMax || 5;
        }
    });
}

async function salvarFicha() {
    if (!fichaRef) conectarFicha();
    const dados = {
        nome: fNome.value,
        volume: parseInt(fVolume.value) || 1,
        pvAtual: parseInt(fPvAtual.value) || 0,
        pvMax: parseInt(fPvMax.value) || 0,
        piAtual: parseInt(fPiAtual.value) || 0,
        piMax: parseInt(fPiMax.value) || 0
    };
    try { await set(fichaRef, dados); } catch (error) { console.error("Erro ao salvar ficha:", error); }
}

document.querySelectorAll('.ficha-papel input').forEach(input => input.addEventListener('change', salvarFicha));
inputNome.addEventListener('change', () => { if(!fNome.value) fNome.value = inputNome.value; conectarFicha(); });
fNome.addEventListener('change', conectarFicha);
btnSalvarFicha.addEventListener('click', salvarFicha);

if (fNome.value === "") fNome.value = inputNome.value;
conectarFicha();