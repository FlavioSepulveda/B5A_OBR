// 1. Importações do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// 2. Suas configurações
const firebaseConfig = {
  apiKey: "AIzaSyDVpq__JyU5KTQ6p6zB6DTqey4k2jaEFZo",
  authDomain: "b5at-44d1d.firebaseapp.com",
  databaseURL: "https://b5at-44d1d-default-rtdb.firebaseio.com/", // <--- ATENÇÃO AQUI (Passo 3)
  projectId: "b5at-44d1d",
  storageBucket: "b5at-44d1d.firebasestorage.app",
  messagingSenderId: "394788459759",
  appId: "1:394788459759:web:7050aa055cec655b88b71a"
};

// 3. Inicia o Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ==========================================
// 4. ELEMENTOS DA TELA
// ==========================================
const btnRolar = document.getElementById('btn-rolar');
const inputSala = document.getElementById('sala-id');
const inputNome = document.getElementById('nome-jogador');
const selectEspectro = document.getElementById('espectro');
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
let salaAtual = inputSala.value;

// ==========================================
// 5. LÓGICA VISUAL
// ==========================================
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

// ==========================================
// 6. CONEXÃO EM TEMPO REAL COM O BANCO
// ==========================================
function conectarSala(idSala) {
    listaHistorico.innerHTML = ''; // Limpa a tela ao trocar de sala
    salaAtual = idSala;
    
    // Cria a referência para a sala específica, pegando apenas as últimas 20 rolagens
    const salaRef = query(ref(db, 'salas/' + idSala), limitToLast(20));
    
    // Escuta quando uma nova rolagem é adicionada
    onChildAdded(salaRef, (snapshot) => {
        const dados = snapshot.val();
        adicionarHistoricoNaTela(dados);
    });
}

// Inicia a conexão com a sala padrão
conectarSala(inputSala.value);

// Se o usuário mudar o ID da sala, reconecta
inputSala.addEventListener('change', () => conectarSala(inputSala.value));

// ==========================================
// 7. MOSTRAR NO HISTÓRICO
// ==========================================
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

// ==========================================
// 8. CLIQUE DO BOTÃO DE ROLAR
// ==========================================
btnRolar.addEventListener('click', () => {
    container.className = 'resultado-container'; 
    regraTexto.style.display = 'none';
    regraTexto.textContent = '';

    // Aplica a cor do Espectro
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

    // Atualiza a interface local
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

    // ENVIA PARA O BANCO DE DADOS (GLOBAL)
    const rolagemRef = ref(db, 'salas/' + salaAtual);
    push(rolagemRef, {
        nome: nome,
        d12: rolagemD12,
        outros: somaDados,
        vol: volume,
        total: total,
        timestamp: Date.now()
    }).catch((error) => {
        console.error("Erro ao enviar rolagem:", error);
        alert("Erro de conexão com o banco. Verifique a 'databaseURL' e as Regras.");
    });
});