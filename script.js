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

// --- INICIALIZAÇÃO E ESCUTA GLOBAL ---
if (typeof OBR !== 'undefined') {
    OBR.onReady(() => {
        console.log("Owlbear Pronto. Escutando rolagens...");
        
        // Escuta as mensagens de outros jogadores
        OBR.broadcast.onMessage(CANAL, (event) => {
            const dados = event.data;
            
            // Se a mensagem NÃO for minha, atualiza a tela
            if (dados.senderId !== OBR.player.id) {
                console.log("Recebi rolagem de outro jogador:", dados);
                
                // Atualiza o histórico local
                historicoRolagens.push(dados);
                if (historicoRolagens.length > 4) historicoRolagens.shift();
                renderizarHistorico();

                // Cria um alerta visual na tela (mais garantido que OBR.notification)
                const alerta = document.createElement('div');
                alerta.style.position = 'fixed';
                alerta.style.top = '20px';
                alerta.style.left = '50%';
                alerta.style.transform = 'translateX(-50%)';
                alerta.style.backgroundColor = '#d4af37';
                alerta.style.color = '#121212';
                alerta.style.padding = '15px 30px';
                alerta.style.borderRadius = '8px';
                alerta.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
                alerta.style.zIndex = '9999';
                alerta.style.fontFamily = 'serif';
                alerta.style.textAlign = 'center';
                alerta.style.fontSize = '1.2em';
                
                let texto = `<strong>${dados.nome}</strong> rolou: <br>`;
                texto += `${dados.d12} (d12) + ${dados.outros} (dados) + ${dados.vol} (Vol) = <strong>${dados.total}</strong>`;
                
                if (REGRAS[dados.d12]) {
                    alerta.style.backgroundColor = dados.d12 === 1 ? '#ff4d4d' : (dados.d12 === 6 ? '#ff9800' : '#4caf50');
                    alerta.style.color = '#fff';
                    texto += `<br><small>${REGRAS[dados.d12]}</small>`;
                }

                alerta.innerHTML = texto;
                document.body.appendChild(alerta);

                // Remove o alerta após 5 segundos
                setTimeout(() => {
                    if (alerta.parentNode) alerta.parentNode.removeChild(alerta);
                }, 5000);
            }
        });
    });
}

// --- CLIQUE DO BOTÃO ---
btnRolar.addEventListener('click', () => {
    container.className = '';
    regraTexto.style.display = 'none';
    regraTexto.textContent = '';

    const nome = inputNome.value.trim() || "Arquivista";
    const qtdDados = Math.max(0, parseInt(inputQtd.value) || 0);
    const volume = Math.max(1, Math.min(8, parseInt(inputVolume.value) || 1));
    const faces = tipoRolagem === 'atributo' ? 4 : 6;
    const nomeDado = tipoRolagem === 'atributo' ? 'd4' : 'd6';

    const rolagemD12 = Math.floor(Math.random() * 12) + 1;
    const resultadosDados = rolarDados(qtdDados, faces);
    const somaDados = resultadosDados.reduce((a, b) => a + b, 0);
    const total = rolagemD12 + somaDados + volume;

    // UI Local
    dadoD12.textContent = rolagemD12;
    dadosOutros.textContent = somaDados;
    totalVisual.innerHTML = `Total: <strong>${total}</strong>`;

    if (REGRAS[rolagemD12]) {
        regraTexto.textContent = REGRAS[rolagemD12];
        if (rolagemD12 === 1) container.classList.add('resultado-1');
        if (rolagemD12 === 6) container.classList.add('resultado-6');
        if (rolagemD12 === 12) container.classList.add('resultado-12');
    }

    // Histórico Local
    const novaRolagem = {
        senderId: typeof OBR !== 'undefined' ? OBR.player.id : "local", 
        nome: nome,
        d12: rolagemD12,
        outros: somaDados,
        vol: volume,
        total: total
    };

    historicoRolagens.push(novaRolagem);
    if (historicoRolagens.length > 4) historicoRolagens.shift();
    renderizarHistorico();

    // --- ENVIO GLOBAL ---
    if (typeof OBR !== 'undefined') {
        console.log("Enviando rolagem para a mesa...");
        OBR.broadcast.sendMessage(CANAL, novaRolagem, { destination: 'ALL' });
    }
});