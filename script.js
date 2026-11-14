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

let tipoRolagem = 'atributo'; 
const MY_EXTENSION_ID = "com.biblioteca5a.rolagens";

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

// Função para verificar se a Dice+ está pronta
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

        // Atualiza a interface local
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

        // --- INTEGRAÇÃO COM A DICE+ (COM VERIFICAÇÃO) ---
        if (typeof OBR !== 'undefined') {
            const isReady = await checkDicePlusReady();
            if (!isReady) {
                console.error("Dice+ não está ativa na sala. Verifique se a extensão foi adicionada e ativada.");
                return;
            }

            let notacao = `1d12`;
            if (qtdDados > 0) notacao += ` + ${qtdDados}d${faces}`;
            if (volume > 0) notacao += ` + ${volume}`;

            const rollId = `roll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

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
        }
    } catch (erro) {
        console.error("Erro na rolagem:", erro);
    }
});