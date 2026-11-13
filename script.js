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

// Função que atualiza o texto "2d4", "1d6", etc.
function atualizarLabel() {
    const qtd = inputQtd.value || 0;
    labelOutros.textContent = tipoRolagem === 'atributo' ? `${qtd}d4` : `${qtd}d6`;
}

inputQtd.addEventListener('input', atualizarLabel);

// Botões de alternar entre Atributo e Perícia
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

// Função para rolar os dados
function rolarDados(quantidade, faces) {
    const resultados = [];
    for (let i = 0; i < quantidade; i++) {
        resultados.push(Math.floor(Math.random() * faces) + 1);
    }
    return resultados;
}

// ===== O CLIQUE DO BOTÃO =====
btnRolar.addEventListener('click', async () => {
    try {
        // 1. Limpa os estados anteriores
        container.className = '';
        regraTexto.style.display = 'none';
        regraTexto.textContent = '';

        // 2. Pega os valores
        const nome = inputNome.value.trim() || "Anônimo";
        const qtdDados = Math.max(0, parseInt(inputQtd.value) || 0);
        const volume = Math.max(1, Math.min(8, parseInt(inputVolume.value) || 1));
        const faces = tipoRolagem === 'atributo' ? 4 : 6;
        const nomeDado = tipoRolagem === 'atributo' ? 'd4' : 'd6';

        // 3. Rola e calcula
        const rolagemD12 = Math.floor(Math.random() * 12) + 1;
        const resultadosDados = rolarDados(qtdDados, faces);
        const somaDados = resultadosDados.reduce((a, b) => a + b, 0);
        const total = rolagemD12 + somaDados + volume;

        // 4. Atualiza a Interface
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

        // 5. Integração com a Dice+
        if (typeof OBR !== 'undefined') {
            // Monta a conta para a Dice+
            let notacao = `1d12`;
            if (qtdDados > 0) notacao += ` + ${qtdDados}d${faces}`;
            if (volume > 0) notacao += ` + ${volume}`;

            const rollId = `roll_${Date.now()}`;
            
            // Envia para a Dice+
            OBR.broadcast.sendMessage("dice-plus/roll-request", {
                rollId: rollId,
                playerId: await OBR.player.getId(),
                playerName: nome,
                rollTarget: 'everyone',
                diceNotation: notacao,
                showResults: true,
                timestamp: Date.now(),
                source: "com.biblioteca5a.rolagens"
            }, { destination: 'ALL' });
        }
    } catch (erro) {
        // Se der erro, mostra no console para sabermos o que foi
        console.error("Erro na rolagem:", erro);
        alert("Ocorreu um erro ao rolar. Verifique o console (F12).");
    }
});