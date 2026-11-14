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
const CANAL_ROLAGEM = "com.biblioteca5a.rolagens.global";

// Função para atualizar o label
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

// Função que exibe o alerta na tela de quem recebeu
function mostrarAlertaGlobal(dados) {
    // Cria um elemento visual temporário para o alerta
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
    texto += `${dados.d12} (d12) + ${dados.soma} (dados) + ${dados.vol} (Vol) = <strong>${dados.total}</strong>`;
    
    if (REGRAS[dados.d12]) {
        alerta.style.backgroundColor = dados.d12 === 1 ? '#ff4d4d' : (dados.d12 === 6 ? '#ff9800' : '#4caf50');
        alerta.style.color = '#fff';
        texto += `<br><small>${REGRAS[dados.d12]}</small>`;
    }

    alerta.innerHTML = texto;
    document.body.appendChild(alerta);

    // Remove o alerta após 5 segundos
    setTimeout(() => {
        if (alerta.parentNode) {
            alerta.parentNode.removeChild(alerta);
        }
    }, 5000);
}

// Configura a escuta de mensagens globais
if (typeof OBR !== 'undefined') {
    OBR.onReady(() => {
        // Escuta as rolagens de todos os jogadores
        OBR.broadcast.onMessage(CANAL_ROLAGEM, (event) => {
            const dados = event.data;
            // Se a mensagem não for de mim mesmo (para não duplicar)
            if (dados.senderId !== OBR.player.id) {
                mostrarAlertaGlobal(dados);
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

        // Atualiza a interface local (como antes)
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

        // --- ENVIO GLOBAL PARA TODOS ---
        if (typeof OBR !== 'undefined') {
            // Prepara os dados para enviar
            const dadosRolagem = {
                senderId: OBR.player.id, // Para não exibir o alerta para quem rolou
                nome: nome,
                d12: rolagemD12,
                soma: somaDados,
                vol: volume,
                total: total
            };

            // Envia a mensagem para todos na mesa
            await OBR.broadcast.sendMessage(CANAL_ROLAGEM, dadosRolagem, { destination: 'ALL' });
        }

    } catch (erro) {
        console.error("Erro na rolagem:", erro);
    }
});