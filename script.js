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
const listaHistorico = document.getElementById('lista-historico');

let tipoRolagem = 'atributo'; 
let historicoRolagens = []; 

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

const REGRAS = {
    1: "Catástrofe Definitiva! Falha automática. O Guardião ganha 1 Dado de Descartes.",
    6: "Falha Absoluta! A ação falha, mesmo que o total supere a TA.",
    12: "Momento Lendário! O resultado soma normalmente. Se vencer, sucesso lendário. Se perder, algo positivo surge."
};

function rolarDados(quantidade, faces) {
    const resultados = [];
    for (let i = 0; i < quantidade; i++) {
        resultados.push(Math.floor(Math.random() * faces) + 1);
    }
    return resultados;
}

function renderizarHistorico() {
    listaHistorico.innerHTML = ''; 
    const recentes = historicoRolagens.slice(-4).reverse();

    recentes.forEach(item => {
        const li = document.createElement('li');
        if (item.d12 === 1) li.classList.add('hist-1');
        if (item.d12 === 6) li.classList.add('hist-6');
        if (item.d12 === 12) li.classList.add('hist-12');

        li.innerHTML = `
            <span>
                <strong>${item.nome}</strong> 
                <span class="hist-detalhe">(${item.d12} + ${item.outros} + ${item.vol})</span>
            </span>
            <span class="hist-total">${item.total}</span>
        `;
        listaHistorico.appendChild(li);
    });
}

if (typeof OBR !== 'undefined') {
    OBR.onReady(() => {
        OBR.broadcast.onMessage("com.biblioteca5a.rolagens", (event) => {
            const dados = event.data;
            historicoRolagens.push(dados);
            if (historicoRolagens.length > 4) {
                historicoRolagens.shift();
            }
            renderizarHistorico();
        });
    });
}

btnRolar.addEventListener('click', () => {
    container.className = '';
    regraTexto.style.display = 'none';
    regraTexto.textContent = '';

    const nome = inputNome.value.trim() || "Anônimo";
    const qtdDados = Math.max(0, parseInt(inputQtd.value) || 0);
    const volume = Math.max(1, Math.min(8, parseInt(inputVolume.value) || 1));
    const faces = tipoRolagem === 'atributo' ? 4 : 6;
    const nomeDado = tipoRolagem === 'atributo' ? 'd4' : 'd6';

    const rolagemD12 = Math.floor(Math.random() * 12) + 1;
    const resultadosDados = rolarDados(qtdDados, faces);
    const somaDados = resultadosDados.reduce((a, b) => a + b, 0);
    const total = rolagemD12 + somaDados + volume;

    dadoD12.textContent = rolagemD12;
    if (qtdDados > 0) {
        dadosOutros.textContent = somaDados;
        dadosOutros.title = `Dados: [${resultadosDados.join(', ')}]`;
    } else {
        dadosOutros.textContent = '0';
        dadosOutros.title = "Desafiar o Destino";
    }

    totalVisual.innerHTML = `
        <span style="font-size:0.8em; color:#a89f91;">Total</span><br>
        ${rolagemD12} (d12) + ${somaDados} (${nomeDado}) + ${volume} (Vol) = <strong>${total}</strong>
    `;

    if (REGRAS[rolagemD12]) {
        regraTexto.textContent = REGRAS[rolagemD12];
        if (rolagemD12 === 1) container.classList.add('resultado-1');
        if (rolagemD12 === 6) container.classList.add('resultado-6');
        if (rolagemD12 === 12) container.classList.add('resultado-12');
    }

    const novaRolagem = {
        id: Date.now() + Math.random(),
        nome: nome,
        d12: rolagemD12,
        outros: somaDados,
        vol: volume,
        total: total
    };

    historicoRolagens.push(novaRolagem);
    if (historicoRolagens.length > 4) {
        historicoRolagens.shift();
    }
    renderizarHistorico();

    if (typeof OBR !== 'undefined') {
        OBR.broadcast.sendMessage("com.biblioteca5a.rolagens", novaRolagem, { destination: "REMOTE" });
    }
});