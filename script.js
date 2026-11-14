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
const CANAL = "com.biblioteca5a.rolagens.global";

// Função que roda em segundo plano ou no painel
if (typeof OBR !== 'undefined') {
    OBR.onReady(() => {
        // Escuta as mensagens na sala
        OBR.broadcast.onMessage(CANAL, (event) => {
            const dados = event.data;
            // Se não for minha própria mensagem
            if (dados.senderId !== OBR.player.id) {
                // TESTE BRUTO: Se a rede funcionar, esse alerta vai pular na tela do outro jogador
                alert("🎲 RECEBI UMA ROLAGEM DE: " + dados.nome + " | Total: " + dados.total);
            }
        });
    });
}

// Apenas executa a parte visual se o painel estiver aberto (para não dar erro no background)
if (btnRolar) {
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

    function rolarDados(quantidade, faces) {
        const resultados = [];
        for (let i = 0; i < quantidade; i++) {
            resultados.push(Math.floor(Math.random() * faces) + 1);
        }
        return resultados;
    }

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

        // Atualiza a SUA interface
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

        const REGRAS = {
            1: "Catástrofe Definitiva!",
            6: "Falha Absoluta!",
            12: "Momento Lendário!"
        };

        if (REGRAS[rolagemD12]) {
            regraTexto.textContent = REGRAS[rolagemD12];
            regraTexto.style.display = 'block';
            if (rolagemD12 === 1) container.classList.add('resultado-1');
            if (rolagemD12 === 6) container.classList.add('resultado-6');
            if (rolagemD12 === 12) container.classList.add('resultado-12');
        }

        // Envia a mensagem para a rede
        if (typeof OBR !== 'undefined') {
            OBR.broadcast.sendMessage(CANAL, {
                senderId: OBR.player.id, 
                nome: nome,
                d12: rolagemD12,
                total: total
            }, { destination: 'REMOTE' });
        }
    });
}