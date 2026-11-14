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
const CANAL_ROLAGEM = "com.biblioteca5a.rolagens.global";
const MY_EXTENSION_ID = "com.biblioteca5a.rolagens";
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

// Função para verificar se a Dice+ está pronta (conforme documentação oficial)
async function checkDicePlusReady() {
    if (typeof OBR === 'undefined') return false;
    
    const requestId = crypto.randomUUID();
    return new Promise((resolve) => {
        const unsubscribe = OBR.broadcast.onMessage("dice-plus/isReady", (event) => {
            const data = event.data;
            if ('ready' in data && data.requestId === requestId) {
                unsubscribe();
                resolve(true);
            }
        });
        OBR.broadcast.sendMessage("dice-plus/isReady", {
            requestId,
            timestamp: Date.now()
        }, { destination: 'ALL' });
        setTimeout(() => {
            unsubscribe();
            resolve(false);
        }, 1000);
    });
}

// Escuta broadcast local (para quem estiver com o painel aberto)
if (typeof OBR !== 'undefined') {
    OBR.onReady(() => {
        OBR.broadcast.onMessage(CANAL_ROLAGEM, (event) => {
            const dados = event.data;
            if (dados.senderId !== OBR.player.id) {
                historicoRolagens.push(dados);
                if (historicoRolagens.length > 4) historicoRolagens.shift();
                renderizarHistorico();
            }
        });
    });
}

btnRolar.addEventListener('click', async () => {
    try {
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

        // UI Local
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

        // Histórico Local
        const novaRolagem = {
            senderId: typeof OBR !== 'undefined' ? OBR.player.id : "local", 
            nome: nome,
            d12: rolagemD12,
            soma: somaDados,
            outros: somaDados, 
            vol: volume,
            total: total
        };

        historicoRolagens.push(novaRolagem);
        if (historicoRolagens.length > 4) historicoRolagens.shift();
        renderizarHistorico();

        // --- INTEGRAÇÃO GLOBAL COM A DICE+ (CORRIGIDA) ---
        if (typeof OBR !== 'undefined') {
            // 1. Envia para o seu próprio broadcast
            OBR.broadcast.sendMessage(CANAL_ROLAGEM, novaRolagem, { destination: 'ALL' });

            // 2. Verifica se a Dice+ está pronta ANTES de enviar
            const dicePlusReady = await checkDicePlusReady();
            
            if (dicePlusReady) {
                let notacao = `1d12`;
                if (qtdDados > 0) notacao += ` + ${qtdDados}d${faces}`;
                if (volume > 0) notacao += ` + ${volume}`;

                const rollId = `roll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                
                // Envia para a Dice+
                await OBR.broadcast.sendMessage("dice-plus/roll-request", {
                    rollId: rollId,
                    playerId: OBR.player.id,
                    playerName: nome,
                    rollTarget: 'everyone',
                    diceNotation: notacao,
                    showResults: true,
                    timestamp: Date.now(),
                    source: MY_EXTENSION_ID
                }, { destination: 'ALL' });

                console.log("Rolagem enviada para a Dice+ com sucesso!");
            } else {
                console.warn("Dice+ não está pronta ou não foi encontrada na sala.");
            }
        }

    } catch (erro) {
        console.error("Erro na rolagem:", erro);
    }
});