import { db, idJogadorAtual } from './firebase.js';
import { ref, get, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const CORES_ESPECTRO = {
    padrao: "#3a3532",
    igneo: "#8b1e24",
    celeste: "#1d4e89",
    viridiano: "#1b5e20",
    solar: "#b28900",
    indigo: "#4a148c",
    alabastro: "#546e7a"
};

const NOMES_ESPECTRO = {
    padrao: "Sem Espectro",
    igneo: "Ígneo",
    celeste: "Celeste",
    viridiano: "Viridiano",
    solar: "Solar",
    indigo: "Índigo",
    alabastro: "Alabastro"
};

const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

async function carregarEstante() {
    const container = document.getElementById('estante-container');
    if (!container) return;

    if (!idJogadorAtual) {
        container.innerHTML = `<p style="color:#aaa; text-align:center; width:100%;">Faça login com o Google para abrir sua Estante de Arquivistas.</p>`;
        return;
    }

    container.innerHTML = `<p style="color:var(--gold); text-align:center; width:100%;">Buscando tomos nos arquivos...</p>`;

    try {
        const snap = await get(ref(db, 'salas/sala-padrao/jogadores'));
        const todosJogadores = snap.val() || {};
        
        // Filtra o personagem principal (id === uid) e todos os criados pelo usuário (donoId === uid)
        const meusPersonagens = Object.entries(todosJogadores).filter(([id, dados]) => {
            return id === idJogadorAtual || dados.donoId === idJogadorAtual;
        });

        let html = "";

        meusPersonagens.forEach(([fichaId, char]) => {
            const espectro = char.espectro || "padrao";
            const corCapa = CORES_ESPECTRO[espectro] || CORES_ESPECTRO.padrao;
            const nomeEspectro = NOMES_ESPECTRO[espectro] || "Sem Espectro";
            const volRomano = ROMANOS[(char.volume || 1) - 1] || "I";
            const subtitulo = char.tipoClasse === 'vocacao' 
                ? (char.vocacao || 'Vocação') 
                : (char.caminho || 'Caminho');

            html += `
                <div class="livro-card" style="background: linear-gradient(135deg, ${corCapa} 0%, #141215 100%); border: 1px solid #444; border-left: 8px solid #0a090a; border-radius: 4px 10px 10px 4px; padding: 18px 14px; width: 175px; min-height: 235px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 4px 6px 15px rgba(0,0,0,0.7); position: relative; transition: transform 0.2s;">
                    
                    <div onclick="window.location.href='ficha.html?id=${fichaId}'" style="cursor: pointer; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.75); display: block; margin-bottom: 4px;">
                                Volume ${volRomano}
                            </span>
                            <h3 style="font-family: 'Bebas Neue', sans-serif; font-size: 1.45rem; color: var(--gold, #d4af37); line-height: 1.15; margin-bottom: 6px; word-break: break-word;">
                                ${char.nome || 'Sem Nome'}
                            </h3>
                            <span style="font-size: 0.78rem; color: #ddd; text-transform: capitalize; display: block;">
                                ${subtitulo}
                            </span>
                        </div>

                        <div style="border-top: 1px solid rgba(255,255,255,0.15); padding-top: 8px; margin-top: 12px;">
                            <span style="font-size: 0.75rem; color: #ccc; display: block;">✦ ${nomeEspectro}</span>
                            <span style="font-size: 0.75rem; color: #aaa; display: block; margin-top: 2px;">❤️ PV: ${char.pvAtual ?? 10} | 🔥 PI: ${char.piAtual ?? 5}</span>
                        </div>
                    </div>

                    <div style="display: flex; gap: 6px; margin-top: 12px;">
                        <a href="ficha.html?id=${fichaId}" style="flex: 1; text-align: center; background: var(--gold, #d4af37); color: #000; font-family: 'Bebas Neue', sans-serif; font-size: 0.95rem; padding: 5px; border-radius: 4px; text-decoration: none; font-weight: bold;">
                            Jogar
                        </a>
                        ${fichaId !== idJogadorAtual ? `
                            <button onclick="excluirPersonagem('${fichaId}', '${(char.nome || 'este personagem').replace(/'/g, "\\'")}')" title="Excluir Ficha" style="background: #3a1518; color: #ff8a8a; border: 1px solid #6b2429; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">
                                🗑️
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        // Slot visual para criar novo personagem direto na prateleira
        html += `
            <a href="ficha.html?novo=true" style="border: 2px dashed #444; border-radius: 6px; width: 175px; min-height: 235px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-decoration: none; color: #888; padding: 16px; text-align: center; transition: all 0.2s;" onmouseover="this.style.borderColor='#d4af37'; this.style.color='#d4af37';" onmouseout="this.style.borderColor='#444'; this.style.color='#888';">
                <span style="font-size: 2.5rem; line-height: 1; margin-bottom: 8px;">+</span>
                <span style="font-family: 'Bebas Neue', sans-serif; font-size: 1.2rem; letter-spacing: 1px;">Novo Tomo</span>
                <span style="font-size: 0.75rem; margin-top: 4px;">Criar Arquivista</span>
            </a>
        `;

        container.innerHTML = html;
    } catch (erro) {
        console.error("Erro ao carregar Estante:", erro);
        container.innerHTML = `<p style="color:#ff6b6b;">Erro ao carregar sua estante.</p>`;
    }
}

window.excluirPersonagem = async (fichaId, nome) => {
    if (!confirm(`Tem certeza que deseja queimar o registro de "${nome}"? Essa ação não pode ser desfeita.`)) return;
    try {
        await remove(ref(db, `salas/sala-padrao/jogadores/${fichaId}`));
        carregarEstante();
    } catch (e) {
        alert("Erro ao excluir personagem.");
        console.error(e);
    }
};

window.addEventListener('usuarioLogado', carregarEstante);
setTimeout(carregarEstante, 700);