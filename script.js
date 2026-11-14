const btnRolar = document.getElementById('btn-rolar');
const inputNome = document.getElementById('nome-jogador');
const inputQtd = document.getElementById('qtd-dados');
const inputVolume = document.getElementById('volume');

const CANAL_TESTE = "canal_de_teste_b5a";

if (typeof OBR !== 'undefined') {
    OBR.onReady(() => {
        OBR.broadcast.onMessage(CANAL_TESTE, (event) => {
            alert("O OUTRO JOGADOR ROLOU! Total: " + event.data.total);
        });
    });
}

btnRolar.addEventListener('click', () => {
    const nome = inputNome.value.trim() || "Arquivista";
    const qtdDados = parseInt(inputQtd.value) || 0;
    const total = Math.floor(Math.random() * 12) + 1; // Só um número aleatório para teste

    if (typeof OBR !== 'undefined') {
        alert("Vou enviar meu total: " + total);
        
        // Envia para TODOS (incluindo você mesmo, mas o alerta vai pular)
        OBR.broadcast.sendMessage(CANAL_TESTE, {
            nome: nome,
            total: total
        }, { destination: 'ALL' });
    }
});