const btnRolar = document.getElementById('btn-rolar');
const inputNome = document.getElementById('nome-jogador');
const inputQtd = document.getElementById('qtd-dados');
const inputVolume = document.getElementById('volume');
const dadoD12 = document.getElementById('dado-d12');
const d12Box = document.getElementById('d12-box');
const dadosOutros = document.getElementById('dados-outros');
const labelOutros = document.getElementById('label-outros');
const totalVisual = document.getElementById('total-visual');
const regraTexto = document.getElementById('regra-texto');
const container = document.getElementById('resultado-container');
const toggles = document.querySelectorAll('.toggle');
const listaHistorico = document.getElementById('lista-historico');

let tipoRolagem = 'atributo'; 
let historicoRolagens = [];

// Função para atualizar o label
function atualizarLabel() {
    const qtd = inputQtd.value || 0;
    labelOutros.textContent = tipoRolagem === 'atributo' ? `${qtd}d4` : `${qtd}d6`;
}
inputQtd.addEventListener('input', atualizarLabel);

// Alternar Atributo/Perícia
toggles.forEach(btn => {
    btn.addEventListener('click', () => {
        toggles.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        tipoRolagem = btn.dataset.tipo;
        atualizarLabel();
    });
});

const REGRAS = {
    1: "Catástrofe Definitiva!",
    6: "Falha Absoluta!",
    12: "Momento Lendário!"
};

function rolarDados(quantidade, faces) {
    const resultados = [];
    for (let i = 0; i < quantidade; i++) {
        resultados.push(Math.floor(Math.random() * faces) + 1);
    }
    return resultados;
}

// Desenha o histórico
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

// Clique do botão
btnRolar.addEventListener('click', () => {
    container.className = 'resultado-container'; // reseta classes do container
    regraTexto.style.display = 'none';
    regraTexto.textContent = '';

    // Pega a cor do Espectro selecionado (se houver)
    const espectroSelect = document.getElementById('espectro-select');
    const espectro = espectroSelect ? espectroSelect.value : '';

    // Aplica a classe da cor no box do d12
    d12Box.className = 'dice-box principal'; // limpa cores antigas
    if (espectro) {
        d12Box.classList.add(`espectro-${espectro}`);
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

    // Atualiza a UI
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

    // Histórico Local
    const novaRolagem = {
        nome: nome, d12: rolagemD12, outros: somaDados, vol: volume, total: total
    };
    historicoRolagens.push(novaRolagem);
    if (historicoRolagens.length > 4) historicoRolagens.shift();
    renderizarHistorico();

    // Envia para o Chat do Owlbear
    if (typeof OBR !== 'undefined' && OBR.chat) {
        let msg = `🎲 **${nome}** rolou: **${total}** (d12: ${rolagemD12}, dados: ${somaDados}, Vol: ${volume})`;
        if (REGRAS[rolagemD12]) msg += `\n*${REGRAS[rolagemD12]}*`;
        
        OBR.chat.postMessage(msg).catch(e => console.log("Chat do Owlbear indisponível."));
    }
});