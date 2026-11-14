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

// Função para exibir o alerta visual (Notificação do Owlbear)
function exibirNotificacao(nome, d12, total) {
    let msg = `${nome} rolou ${total} (d12: ${d12})`;
    let tipo = "INFO";
    
    if (d12 === 1) {
        msg = `💀 CATÁSTROFE! ${nome} rolou ${total}`;
        tipo = "ERROR";
    } else if (d12 === 6) {
        msg = `⚠️ FALHA ABSOLUTA! ${nome} rolou ${total}`;
        tipo = "WARNING";
    } else if (d12 === 12) {
        msg = `🌟 MOMENTO LENDÁRIO! ${nome} rolou ${total}`;
        tipo = "SUCCESS";
    }

    // Dispara a notificação nativa do Owlbear (aparece no topo para todos)
    if (typeof OBR !== 'undefined') {
        OBR.notification.show(msg, tipo);
    } else {
        alert(msg); // Fallback para teste fora do Owlbear
    }
}

// Configura a escuta de mensagens da rede
if (typeof OBR !== 'undefined') {
    OBR.onReady(() => {
        console.log("Extensão pronta. Escutando o canal:", CANAL);
        
        OBR.broadcast.onMessage(CANAL, (event) => {
            const dados = event.data;
            
            // Se a mensagem não for de mim mesmo, exibe
            if (dados.senderId !== OBR.player.id) {
                console.log("Recebi rolagem de outro jogador:", dados);
                exibirNotificacao(dados.nome, dados.d12, dados.total);
            }
        });
    });
}

btnRolar.addEventListener('click', () => {
    container.className = '';
    regraTexto.style.display = 'none';
    regraTexto.textContent = '';

    const nome = inputNome.value.trim() || "Arquivista";
    const qtdDados = Math.max(0, parseInt(inputQtd.value) || 0);
    const volume = Math.max(1, Math.min(8, parseInt(inputVolume.value) || 1));
    const faces = tipoRolagem === 'atributo' ? 4 : 6;

    const rolagemD12 = Math.floor(Math.random() * 12) + 1;
    const resultadosDados = rolarDados(qtdDados, faces);
    const somaDados = resultadosDados.reduce((a, b) => a + b, 0);
    const total = rolagemD12 + somaDados + volume;

    // Atualiza a interface local
    dadoD12.textContent = rolagemD12;
    dadosOutros.textContent = somaDados;
    totalVisual.innerHTML = `Total: <strong>${total}</strong>`;

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
        const pacoteRolagem = {
            senderId: OBR.player.id, // Identificador de quem enviou
            nome: nome,
            d12: rolagemD12,
            total: total
        };
        
        console.log("Enviando pacote:", pacoteRolagem);
        OBR.broadcast.sendMessage(CANAL, pacoteRolagem, { destination: 'ALL' });
    }
});