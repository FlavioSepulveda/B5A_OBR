import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, query, limitToLast, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// SUA CONFIGURAÇÃO DO FIREBASE AQUI
const firebaseConfig = {
  apiKey: "AIzaSyDVpq__JyU5KTQ6p6zB6DTqey4k2jaEFZo",
  authDomain: "b5at-44d1d.firebaseapp.com",
  databaseURL: "https://b5at-44d1d-default-rtdb.firebaseio.com/", // Verifique se está correta
  projectId: "b5at-44d1d",
  storageBucket: "b5at-44d1d.firebasestorage.app",
  messagingSenderId: "394788459759",
  appId: "1:394788459759:web:7050aa055cec655b88b71a"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ==========================================
// LÓGICA DE ROLAGEM (JÁ FUNCIONAVA)
// ==========================================
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
    
    onChildAdded(salaRef, (snapshot) => {
        adicionarHistoricoNaTela(snapshot.val());
    });
}
conectarSala(inputSala.value);
inputSala.addEventListener('change', () => conectarSala(inputSala.value));

btnRolar.addEventListener('click', () => {
    container.className = 'resultado-container'; 
    regraTexto.style.display = 'none';
    
    // Cor do Espectro
    const selectEspectro = document.getElementById('espectro');
    if (selectEspectro && selectEspectro.value !== 'padrao') {
        container.classList.add(`espectro-${selectEspectro.value}`);
    }

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
    push(rolagemRef, {
        nome: nome, d12: rolagemD12, outros: somaDados, vol: volume, total: total
    });
});

// ==========================================
// LÓGICA DA FICHA E FIREBASE
// ==========================================
const btnSalvarFicha = document.getElementById('btn-salvar-ficha');
let fichaRef = null;

// Elementos da Ficha
const el = (id) => document.getElementById(id);
const fNome = el('f-nome'), fEspectro = el('f-espectro'), fVolume = el('f-volume'), fVocacao = el('f-vocacao'), fTitulo = el('f-titulo');
const fVigor = el('f-vigor'), fDinamismo = el('f-dinamismo'), fRazao = el('f-razao'), fDeterminacao = el('f-determinacao');
const fPvAtual = el('f-pv-atual'), fPvMax = el('f-pv-max'), fPiAtual = el('f-pi-atual'), fPiMax = el('f-pi-max'), fHpTemp = el('f-hp-temp'), fIniciativa = el('f-iniciativa');

// Função chamada no HTML para os botões + e -
window.alterarRecurso = function(recurso, valor) {
    if (recurso === 'pv') {
        let atual = parseInt(fPvAtual.value) || 0;
        let novo = Math.max(0, atual + valor); // Não deixa ir abaixo de 0
        fPvAtual.value = novo;
        
        // Se o PV chegar a 0, pisca a tela em vermelho
        if (novo === 0) {
            document.body.style.backgroundColor = "#3a1010";
            setTimeout(() => document.body.style.backgroundColor = "", 500);
        }
    } else if (recurso === 'pi') {
        let atual = parseInt(fPiAtual.value) || 0;
        fPiAtual.value = Math.max(0, atual + valor);
    }
    salvarFicha(); // Salva automaticamente ao clicar
};

// Conecta a ficha ao banco baseada no nome do jogador e ID da sala
function conectarFicha() {
    const idSala = inputSala.value;
    const nomePersonagem = fNome.value.trim() || inputNome.value.trim() || "Arquivista";
    
    // O caminho no banco será: salas/{idSala}/fichas/{nomePersonagem}
    fichaRef = ref(db, 'salas/' + idSala + '/fichas/' + nomePersonagem);

    // Escuta mudanças (útil se o Mestre abrir a ficha ou outro jogador atualizar)
    onValue(fichaRef, (snapshot) => {
        const dados = snapshot.val();
        if (dados) {
            fNome.value = dados.nome || '';
            fEspectro.value = dados.espectro || '';
            fVolume.value = dados.volume || 1;
            fVocacao.value = dados.vocacao || '';
            fTitulo.value = dados.titulo || '';
            
            fVigor.value = dados.vigor || '0d4';
            fDinamismo.value = dados.dinamismo || '0d4';
            fRazao.value = dados.razao || '0d4';
            fDeterminacao.value = dados.determinacao || '0d4';

            fPvAtual.value = dados.pvAtual || 0;
            fPvMax.value = dados.pvMax || 10;
            fPiAtual.value = dados.piAtual || 0;
            fPiMax.value = dados.piMax || 5;
            fHpTemp.value = dados.hpTemp || 0;
            fIniciativa.value = dados.iniciativa || '';
        }
    });
}

// Salva os dados no Firebase
async function salvarFicha() {
    if (!fichaRef) {
        conectarFicha();
    }
    
    const dados = {
        nome: fNome.value,
        espectro: fEspectro.value,
        volume: parseInt(fVolume.value) || 1,
        vocacao: fVocacao.value,
        titulo: fTitulo.value,
        vigor: fVigor.value,
        dinamismo: fDinamismo.value,
        razao: fRazao.value,
        determinacao: fDeterminacao.value,
        pvAtual: parseInt(fPvAtual.value) || 0,
        pvMax: parseInt(fPvMax.value) || 0,
        piAtual: parseInt(fPiAtual.value) || 0,
        piMax: parseInt(fPiMax.value) || 0,
        hpTemp: parseInt(fHpTemp.value) || 0,
        iniciativa: fIniciativa.value
    };

    try {
        await set(fichaRef, dados);
    } catch (error) {
        console.error("Erro ao salvar ficha:", error);
    }
}

// Eventos para salvar automaticamente ao mudar algo
document.querySelectorAll('.ficha-container input').forEach(input => {
    input.addEventListener('change', salvarFicha);
});

// Inicializa a ficha
inputNome.addEventListener('change', () => {
    if(!fNome.value) fNome.value = inputNome.value;
    conectarFicha();
});
fNome.addEventListener('change', conectarFicha);
btnSalvarFicha.addEventListener('click', salvarFicha);

// Inicia quando a página carrega
if (fNome.value === "") fNome.value = inputNome.value;
conectarFicha();