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
const CANAL = "com.biblioteca5a.rolagens.global";

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

const REGRAS = { 1: "Catástrofe!", 6: "Falha Absoluta!", 12: "Momento Lendário!" };

function rolarDados(quantidade, faces) {
    const resultados = [];
    for (let i = 0; i < quantidade; i++) resultados.push(Math.floor(Math.random() * faces) + 1);
    return resultados;
}

function renderizarHistorico() {
    listaHistorico.innerHTML = ''; 
    // Como a tela é cheia, podemos mostrar as últimas 15 rolagens
    const recentes = historicoRolagens.slice(-15).reverse();

    recentes.forEach(item => {
        const li = document.createElement('li');
        if (item.d12 === 1) li.classList.add('hist-1');
        if (item.d12 === 6) li.classList.add('hist-6');
        if (item.d12 === 12) li.classList.add('hist-12');

        li.innerHTML = `
            <div>
                <strong>${item.nome}</strong> 
                <div class="hist-detalhe">${item.d12} (d12) + ${item.outros} + ${item.vol} (Vol)</div>
            </div>
            <div class="hist-total">${item.total}</div>
        `;
        listaHistorico.appendChild(li);
    });
}

// Inicia a escuta na rede do Owlbear
if (typeof OBR !== 'undefined') {
    OBR.onReady(() => {
        OBR.broadcast.onMessage(CANAL, (event) => {
            const dados = event.data;
            
            // Se não for minha própria rolagem, adiciona ao histórico e atualiza a tela
            if (dados.senderId !== OBR.player.id) {
                historicoRolagens.push(dados);
                renderizarHistorico();
            }
        });
    });
}

btnRolar.addEventListener('click', () => {
    container.className = '';
    regraTexto.style.display = 'none';

    const nome = inputNome.value.trim() || "Arquivista";
    const qtdDados = Math.max(0, parseInt(inputQtd.value) || 0);
    const volume = Math.max(1, parseInt(inputVolume.value) || 1);
    const faces = tipoRolagem === 'atributo' ? 4 : 6;

    const rolagemD12 = Math.floor(Math.random() * 12) + 1;
    const resultadosDados = rolarDados(qtdDados, faces);
    const somaDados = resultadosDados.reduce((a, b) => a + b, 0);
    const total = rolagemD12 + somaDados + volume;

    // Mostra na tela
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

    // Cria o pacote de rolagem
    const novaRolagem = {
        senderId: typeof OBR !== 'undefined' ? OBR.player.id : "local", 
        nome: nome, d12: rolagemD12, outros: somaDados, vol: volume, total: total
    };
    
    // Adiciona na SUA tela
    historicoRolagens.push(novaRolagem);
    renderizarHistorico();

    // Envia para TODOS (agora funciona porque a tela está sempre ativa)
    if (typeof OBR !== 'undefined') {
        OBR.broadcast.sendMessage(CANAL, novaRolagem, { destination: 'ALL' });
    }
});