// ... (mantenha todo o código anterior: constantes, funções, etc.) ...

// 1. Defina um ID único para sua extensão (pode ser qualquer string)
const MINHA_EXTENSAO_ID = "com.biblioteca5a.rolagens";

btnRolar.addEventListener('click', async () => {
    // Limpa estados anteriores
    container.className = '';
    regraTexto.style.display = 'none';
    regraTexto.textContent = '';

    // Lê os valores
    const nome = inputNome.value.trim() || "Anônimo";
    const qtdDados = Math.max(0, parseInt(inputQtd.value) || 0);
    const volume = Math.max(1, Math.min(8, parseInt(inputVolume.value) || 1));
    const faces = tipoRolagem === 'atributo' ? 4 : 6;
    const nomeDado = tipoRolagem === 'atributo' ? 'd4' : 'd6';

    // Rola o d12 e os dados de atributo/perícia
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

    // --- INTEGRAÇÃO COM A DICE+ ---
    // Só tenta enviar se estiver dentro do Owlbear Rodeo
    if (typeof OBR !== 'undefined') {
        try {
            // Monta a notação de dados para a Dice+
            // Ex: "1d12 + 2d4 + 3" ou "1d12 + 1d6 + 5"
            let notacao = `1d12`;
            if (qtdDados > 0) {
                notacao += ` + ${qtdDados}d${faces}`;
            }
            if (volume > 0) {
                notacao += ` + ${volume}`;
            }

            // Gera um ID único para esta rolagem
            const rollId = `roll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

            // Envia o pedido para a Dice+
            await OBR.broadcast.sendMessage("dice-plus/roll-request", {
                rollId: rollId,
                playerId: await OBR.player.getId(),
                playerName: nome, // Usa o nome que o jogador digitou
                rollTarget: 'everyone', // Todos veem
                diceNotation: notacao,
                showResults: true, // Mostra o popup da Dice+
                timestamp: Date.now(),
                source: MINHA_EXTENSAO_ID
            }, { destination: 'ALL' });

            console.log(`Rolagem enviada para Dice+: ${notacao} = ${total}`);

        } catch (error) {
            console.error("Erro ao enviar para a Dice+:", error);
        }
    }
});