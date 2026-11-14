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
const ITEM_HISTORICO_NOME = "Historico_B5A"; // Nome do item invisível na cena

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

// Função para ler o histórico do Owlbear e desenhar na tela
async function sincronizarHistorico() {
    if (typeof OBR === 'undefined') return;

    try {
        const items = await OBR.scene.items.getItems();
        // Procura o nosso item invisível
        const itemHistorico = items.find(i => i.name === ITEM_HISTORICO_NOME);

        if (itemHistorico && itemHistorico.metadata && itemHistorico.metadata.historico) {
            const historico = itemHistorico.metadata.historico;
            listaHistorico.innerHTML = '';
            
            // Pega os 4 últimos
            const recentes = historico.slice(-4).reverse();

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
    } catch (e) {
        console.log("Aguardando cena carregar...", e);
    }
}

// Inicia a leitura quando o Owlbear estiver pronto
if (typeof OBR !== 'undefined') {
    OBR.onReady(() => {
        // Escuta mudanças na cena para atualizar o histórico em tempo real
        OBR.scene.onReadyChange((ready) => {
            if (ready) {
                OBR.scene.items.onChange(() => {
                    sincronizarHistorico();
                });
                sincronizarHistorico();
            }
        });
    });
}

btnRolar.addEventListener('click', async () => {
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

    // Atualiza a SUA interface visual
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

    // --- SALVANDO NO OWLBEAR (GLOBAL) ---
    if (typeof OBR === 'undefined') return;

    try {
        const items = await OBR.scene.items.getItems();
        let itemHistorico = items.find(i => i.name === ITEM_HISTORICO_NOME);
        
        let historicoAtual = [];
        if (itemHistorico && itemHistorico.metadata && itemHistorico.metadata.historico) {
            historicoAtual = itemHistorico.metadata.historico;
        }

        // Cria o novo registro
        const novaRolagem = {
            nome: nome,
            d12: rolagemD12,
            outros: somaDados,
            vol: volume,
            total: total
        };

        historicoAtual.push(novaRolagem);
        // Mantém apenas as 10 últimas para não pesar a cena
        if (historicoAtual.length > 10) historicoAtual.shift();

        if (itemHistorico) {
            // Atualiza o item existente
            await OBR.scene.items.updateItems([itemHistorico], (items) => {
                items[0].metadata.historico = historicoAtual;
            });
        } else {
            // Cria o item invisível pela primeira vez
            const novoItem = {
                name: ITEM_HISTORICO_NOME,
                type: "IMAGE",
                position: { x: 0, y: 0 },
                scale: { x: 1, y: 1 },
                visible: false, // Invisível no mapa!
                layer: "NOTE",
                metadata: {
                    historico: historicoAtual
                }
            };
            await OBR.scene.items.addItems([novoItem]);
        }

        // Atualiza a tela local imediatamente
        sincronizarHistorico();

    } catch (error) {
        console.error("Erro ao salvar no mapa:", error);
    }
});