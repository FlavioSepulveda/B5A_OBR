import { db, salaAtual } from './firebase.js';
import { ref, onValue, set, update, remove, get } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';

const CONDICOES_SISTEMA = [
    'Amedrontado', 'Atordoado', 'Caído', 'Cego', 'Confuso',
    'Congelado', 'Derrubado', 'Envenenado', 'Exausto', 'Feridas Graves',
    'Imobilizado', 'Inconsciente', 'Intangível', 'Obscurecido',
    'Sangrando', 'Silenciado', 'Vulnerável'
];

const BESTIARIO_PRESETS = {
    furao: { nome: 'Furão de Fogo', pvMax: 14, ta: 12, dinamismo: 3, tipo: 'inimigo' },
    espectro_errante: { nome: 'Espectro Errante', pvMax: 22, ta: 14, dinamismo: 4, tipo: 'inimigo' },
    cacador_paginas: { nome: 'Caçador de Páginas', pvMax: 35, ta: 16, dinamismo: 5, tipo: 'inimigo' },
    juiz_imparcial: { nome: 'Juiz Imparcial (Chefe)', pvMax: 85, ta: 18, dinamismo: 6, tipo: 'inimigo' }
};

const ORACULOS = {
    quem: [
        'Um Arquivista veterano desaparecido', 'A Bibliotecária da Ala Restrita', 'Um colecionador de livros proibidos',
        'Um espírito preso em um marcador de página', 'O mensageiro de uma facção rival', 'Um investigador novato em pânico',
        'Uma criança que ouve sussurros das estantes', 'Um ex-Guardião exilado', 'O próprio Diário de um dos jogadores',
        'Um mercador de memórias descartadas', 'Uma entidade disfarçada de leitor comum', 'O Conselho da 5ª Avenida'
    ],
    onde: [
        'Nos arquivos submersos da Ala Norte', 'Em um vagão de trem que nunca para', 'Numa cidade refletida dentro de um espelho',
        'Na Torre do Relógio Congelado', 'Em um teatro onde a peça se repete há séculos', 'Nas ruínas de uma catedral de papel',
        'No corredor infinito entre duas portas', 'Em um hotel vitoriano sem janelas', 'Num farol cercado por névoa de tinta',
        'Na sala de leitura proibida', 'Em um mercado noturno clandestino', 'No limiar de um Espectro colapsado'
    ],
    objetivo: [
        'Recuperar um capítulo arrancado antes do amanhecer', 'Selar uma fenda que vaza criaturas para o mundo real',
        'Escoltar uma testemunha sem deixar que ela olhe para trás', 'Destruir um tomo amaldiçoado que reescreve memórias',
        'Descobrir quem sabotou os registros da expedição anterior', 'Resgatar Arquivistas presos em um loop temporal',
        'Negociar uma trégua com o guardião do andar', 'Decifrar o código antes que o cronômetro zere',
        'Conter um incêndio espectral no acervo', 'Capturar uma criatura viva para estudo',
        'Purificar um altar corrompido pelo Espectro', 'Impedir o despertar de um Chefe adormecido'
    ],
    obstaculo: [
        'A gravidade muda de direção a cada rodada', 'Os guardas locais acreditam que os jogadores são os culpados',
        'Qualquer som alto atrai enxames de criaturas', 'O tempo passa 12 horas a cada falha crítica',
        'As portas só abrem mediante sacrifício de um item ou memória', 'Um nevoeiro denso reduz a visibilidade a 3 metros',
        'Um rival também está atrás do mesmo objetivo', 'Ilusões imitam a voz dos aliados',
        'O chão desaba lentamente para o vazio', 'Magias e Espectros oscilam de forma imprevisível',
        'Uma maldição impede mentiras dentro do local', 'O lugar está prestes a ser demolido ou selado'
    ],
    reviravolta: [
        'O contratante é o verdadeiro vilão da história', 'O objeto buscado é, na verdade, uma prisão para algo pior',
        'Um aliado de confiança foi substituído há dias', 'Salvar o alvo exige sacrificar uma lembrança importante',
        'As criaturas estão apenas protegendo o local de invasores piores', 'Tudo faz parte de um teste da própria Biblioteca',
        'O tempo já acabou no mundo exterior', 'O vilão e um dos Arquivistas compartilham o mesmo Espectro',
        'A saída só aparece se alguém ficar para trás', 'O livro que buscam já está na mochila de um jogador',
        'Derrotar o chefe liberta uma maldição maior na região', 'Toda a missão foi escrita por um autor desconhecido'
    ],
    npc: [
        'Elias Thorne — Arquivista cego que lê pelo tato das cicatrizes',
        'Clara Vance — Restauradora de tomos que carrega uma tesoura de prata',
        'Sr. Corvo — Informante que só aceita segredos como pagamento',
        'Helena D’Ávila — Ex-combatente com um braço marcado pelo Espectro Ígneo',
        'Frei Mateus — Guardião silencioso que anota cada palavra dita perto dele',
        'Nora Lin — Cartógrafa de corredores que mudam de lugar'
    ],
    vilao: [
        'O Revisor — Apaga pessoas da história riscando seus nomes',
        'Dama das Cinzas — Queima memórias para alimentar seu próprio Ímpeto',
        'O Colecionador de Vozes — Rouba a fala e as habilidades de suas vítimas',
        'Arquiteto do Labirinto — Manipula portas e distâncias à vontade',
        'O Juiz Sem Rosto — Pune qualquer quebra de promessa com Dano Real',
        'Escriba da Ruína — Transforma relatos escritos em monstros tangíveis'
    ],
    item: [
        'Monóculo de Alabastro: Revela passagens ocultas e ilusões (TA -2 em Investigação)',
        'Caneta de Tinta Ígnea: Permite escrever uma palavra no ar que causa 1d6 de fogo',
        'Ampulheta Invertida: Permite rerrolar 1d12 uma vez por sessão (gera 1 Descarte)',
        'Marcador de Página Prateado: Teleporta o portador até o livro onde o marcador está',
        'Lanterna Celeste: Afasta criaturas menores em um raio de 6 metros',
        'Chave Mestra Enferrujada: Abre qualquer fechadura comum, mas tranca outra porta próxima'
    ],
    ambiente: [
        'Estantes de 15 metros balançando com o vento subterrâneo',
        'Salão alagado onde reflexos na água se movem sozinhos',
        'Escadaria em espiral iluminada por velas flutuantes',
        'Arquivo congelado com pergaminhos presos em blocos de gelo',
        'Estufa abandonada tomada por vinhas luminosas',
        'Sala de leitura com dezenas de relógios fora de sincronia'
    ],
    genero: [
        'Mistério Clássico', 'Terror Gótico', 'Fantasia Sombria',
        'Suspense Investigativo', 'Aventura Épica', 'Drama Psicológico',
        'Realismo Mágico', 'Tragédia Grega'
    ]
};

const r12 = (arr) => arr[Math.floor(Math.random() * arr.length)];

let estadoCombate = {
    turno: 1,
    indiceAtivo: 0,
    combatentes: []
};

function obterSalaAtiva() {
    const paramSala = new URLSearchParams(window.location.search).get('sala');
    return paramSala || salaAtual || 'sala-padrao';
}

// =========================================================
// INICIALIZAÇÃO E LISTENERS DA SALA
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    const salaId = obterSalaAtiva();
    const badgeSala = document.getElementById('badge-sala');
    if (badgeSala) badgeSala.textContent = `Sala: ${salaId}`;

    iniciarPilhaGuardiao(salaId);
    iniciarMonitorArquivistas(salaId);
    iniciarCombate(salaId);
    iniciarEscudoEOraculos(salaId);
});

// =========================================================
// 1. PILHA DE DESCARTES DO GUARDIÃO
// =========================================================
function iniciarPilhaGuardiao(salaId) {
    const pilhaRef = ref(db, `salas/${salaId}/mestre/pilhaDescartes`);
    const contadorEl = document.getElementById('contador-pilha-guardiao');
    let valorAtual = 0;

    onValue(pilhaRef, (snap) => {
        valorAtual = Number(snap.val()) || 0;
        if (contadorEl) contadorEl.textContent = valorAtual;
    });

    document.getElementById('btn-pilha-mais')?.addEventListener('click', () => {
        set(pilhaRef, valorAtual + 1);
    });

    document.getElementById('btn-pilha-menos')?.addEventListener('click', () => {
        set(pilhaRef, Math.max(0, valorAtual - 1));
    });
}

// =========================================================
// 2. MONITOR DE ARQUIVISTAS NA MESA (NÃO APAGA DA ESTANTE!)
// =========================================================
function iniciarMonitorArquivistas(salaId) {
    // Nó isolado apenas para quem está sentado nesta mesa do Guardião
    const mesaJogadoresRef = ref(db, `salas/${salaId}/mestre/mesaJogadores`);
    // Repositório global da Estante (onde ficha.html salva os personagens)
    const estanteGlobalRef = ref(db, 'salas/sala-padrao/jogadores');

    const listaEl = document.getElementById('lista-arquivistas');
    let participantesMesa = {};
    let fichasEstante = {};

    const renderizarArquivistasMesa = () => {
        const ids = Object.keys(participantesMesa);

        if (ids.length === 0) {
            listaEl.innerHTML = '<p class="texto-vazio">Nenhum Arquivista vinculado à mesa. Clique em "+ Puxar Ficha" para adicionar.</p>';
            return;
        }

        listaEl.innerHTML = '';
        ids.forEach((id) => {
            // Mescla os dados locais da mesa com a ficha atualizada da Estante
            const fichaBase = fichasEstante[id] || {};
            const p = { ...fichaBase, ...participantesMesa[id] };

            const dinamismo = Number(p.dadosPersonagem?.dinamismo ?? p.dinamismo ?? 2);
            const determinacao = Number(p.dadosPersonagem?.determinacao ?? 0);
            const razao = Number(p.dadosPersonagem?.razao ?? 0);
            const volume = Number(p.volume || 1);

            const pvAtual = p.pvAtual ?? 10;
            const pvMax = p.pvMax ?? (10 + (4 * volume) + (determinacao * 4));
            const pvTemp = p.pvTemp ?? 0;
            const impeto = p.piAtual ?? p.impetoAtual ?? 5;
            const impetoMax = p.piMax ?? p.impetoMax ?? (5 + (4 * volume) + (razao * 4));

            const clash = (dinamismo * 4) + volume;
            const descartes = Array.isArray(p.pilha) ? p.pilha.length : Number(p.descartes || 0);
            const condicoes = Array.isArray(p.condicoes) ? p.condicoes : [];
            const classeLabel = p.tipoClasse === 'vocacao' ? (p.vocacao || 'Vocação') : (p.caminho || 'Caminho');

            const card = document.createElement('div');
            card.className = 'arq-card';
            card.innerHTML = `
                <div class="arq-topo">
                    <div>
                        <div class="arq-nome">${p.nome || 'Arquivista'}</div>
                        <div class="arq-sub">${classeLabel} • Espectro ${p.espectro || 'Padrão'} (Vol. ${volume})</div>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <a href="ficha.html?id=${encodeURIComponent(id)}&sala=${encodeURIComponent(salaId)}" target="_blank" class="btn-secundario-sm" style="text-decoration:none;" title="Abrir Ficha">📜</a>
                        <button class="btn-secundario-sm btn-add-init" title="Enviar para Iniciativa">⚔️ Init</button>
                        <button class="btn-perigo-sm btn-remover-mesa" title="Tirar da mesa (mantém na Estante)">✕</button>
                    </div>
                </div>

                <div class="arq-stats-grid">
                    <div class="stat-box">
                        <span class="stat-label">Vida (PV)</span>
                        <div class="stat-controle">
                            <button class="btn-mini" data-campo="pvAtual" data-delta="-1">-</button>
                            <span>${pvAtual}/${pvMax}</span>
                            <button class="btn-mini" data-campo="pvAtual" data-delta="1">+</button>
                        </div>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">PV Temp</span>
                        <div class="stat-controle">
                            <button class="btn-mini" data-campo="pvTemp" data-delta="-1">-</button>
                            <span style="color:var(--azul)">${pvTemp}</span>
                            <button class="btn-mini" data-campo="pvTemp" data-delta="1">+</button>
                        </div>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">Ímpeto (PI)</span>
                        <div class="stat-controle">
                            <button class="btn-mini" data-campo="piAtual" data-delta="-1">-</button>
                            <span style="color:var(--gold)">${impeto}/${impetoMax}</span>
                            <button class="btn-mini" data-campo="piAtual" data-delta="1">+</button>
                        </div>
                    </div>
                </div>

                <div class="arq-meta-linha">
                    <span>🛡️ Clash Máx: <strong>${clash}</strong></span>
                    <span>⏳ Descartes: <strong>${descartes}/10</strong> (${descartes * 12}h)</span>
                </div>

                <div class="condicoes-area">
                    ${condicoes.map((c) => `<span class="chip-condicao" data-cond="${c}" title="Clique para remover">${c} ✕</span>`).join('')}
                    <select class="select-condicao">
                        <option value="">+ Condição...</option>
                        ${CONDICOES_SISTEMA.filter((c) => !condicoes.includes(c)).map((c) => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
            `;

            // Atualiza PV, PV Temp e PI tanto na mesa quanto na ficha da Estante
            card.querySelectorAll('.btn-mini[data-campo]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const campo = btn.dataset.campo;
                    const delta = Number(btn.dataset.delta);
                    const base = campo === 'pvAtual' ? pvAtual : campo === 'pvTemp' ? pvTemp : impeto;
                    const novoValor = Math.max(0, base + delta);

                    update(ref(db, `salas/${salaId}/mestre/mesaJogadores/${id}`), { [campo]: novoValor });
                    if (fichasEstante[id]) {
                        update(ref(db, `salas/sala-padrao/jogadores/${id}`), { [campo]: novoValor });
                    }
                });
            });

            // Adicionar condição
            card.querySelector('.select-condicao').addEventListener('change', (e) => {
                const nova = e.target.value;
                if (!nova) return;
                const atualizadas = [...condicoes, nova];
                update(ref(db, `salas/${salaId}/mestre/mesaJogadores/${id}`), { condicoes: atualizadas });
            });

            // Remover condição
            card.querySelectorAll('.chip-condicao').forEach((chip) => {
                chip.addEventListener('click', () => {
                    const alvo = chip.dataset.cond;
                    const atualizadas = condicoes.filter((c) => c !== alvo);
                    update(ref(db, `salas/${salaId}/mestre/mesaJogadores/${id}`), { condicoes: atualizadas });
                });
            });

            // Enviar jogador para o rastreador de iniciativa
            card.querySelector('.btn-add-init').addEventListener('click', () => {
                const rolagem = Math.floor(Math.random() * 12) + 1;
                const initTotal = rolagem + clash;
                adicionarCombatente(salaId, {
                    nome: p.nome || 'Arquivista',
                    pvAtual,
                    pvMax,
                    iniciativa: initTotal,
                    detalhe: `d12(${rolagem}) + Clash(${clash})`,
                    tipo: 'aliado'
                });
            });

            // Remove APENAS da mesa do mestre (preserva a ficha na Estante!)
            card.querySelector('.btn-remover-mesa').addEventListener('click', () => {
                if (confirm(`Retirar ${p.nome || 'este Arquivista'} da visualização da mesa?\n(A ficha continuará salva na Estante do jogador)`)) {
                    remove(ref(db, `salas/${salaId}/mestre/mesaJogadores/${id}`));
                }
            });

            listaEl.appendChild(card);
        });
    };

    onValue(mesaJogadoresRef, (snap) => {
        participantesMesa = snap.val() || {};
        renderizarArquivistasMesa();
    });

    onValue(estanteGlobalRef, (snap) => {
        fichasEstante = snap.val() || {};
        renderizarArquivistasMesa();
    });

    // Modal para puxar fichas da Estante (salas/sala-padrao/jogadores)
    const modal = document.getElementById('modal-fichas');
    const listaModal = document.getElementById('lista-fichas-disponiveis');

    document.getElementById('btn-importar-ficha')?.addEventListener('click', async () => {
        modal.style.display = 'flex';
        listaModal.innerHTML = '<p class="texto-vazio">Buscando Arquivistas na Estante...</p>';

        const snapEstante = await get(estanteGlobalRef);
        const todasFichas = snapEstante.val() || {};
        const chaves = Object.keys(todasFichas);

        if (chaves.length === 0) {
            listaModal.innerHTML = '<p class="texto-vazio">Nenhum Arquivista encontrado na Estante.</p>';
            return;
        }

        listaModal.innerHTML = '';
        chaves.forEach((fid) => {
            const f = todasFichas[fid];
            const jaNaMesa = Boolean(participantesMesa[fid]);
            const item = document.createElement('div');
            item.className = 'ficha-import-item';
            item.innerHTML = `
                <div>
                    <strong style="color:var(--gold)">${f.nome || 'Arquivista'}</strong>
                    <div style="font-size:0.75rem; color:#aaa">Vol. ${f.volume || 1} • ${f.caminho || f.vocacao || 'Arquivista'} • ${f.espectro || 'Padrão'}</div>
                </div>
                <button class="btn-primario-sm" ${jaNaMesa ? 'disabled style="opacity:0.5"' : ''}>
                    ${jaNaMesa ? 'Na Mesa' : 'Puxar'}
                </button>
            `;
            item.querySelector('button').addEventListener('click', async () => {
                await set(ref(db, `salas/${salaId}/mestre/mesaJogadores/${fid}`), {
                    nome: f.nome || 'Arquivista',
                    condicoes: []
                });
                modal.style.display = 'none';
            });
            listaModal.appendChild(item);
        });
    });

    document.getElementById('btn-fechar-modal-fichas')?.addEventListener('click', () => {
        modal.style.display = 'none';
    });
}

// =========================================================
// 3. RASTREADOR DE COMBATE & BESTIÁRIO
// =========================================================
function sincronizarBestiarioComunidade() {
    const selectBestiario = document.getElementById('select-bestiario');
    if (!selectBestiario) return;

    const carregarNo = (caminho, isChefe = false) => {
        onValue(ref(db, caminho), (snap) => {
            const dados = snap.val() || {};
            Object.entries(dados).forEach(([key, item]) => {
                if (!item || typeof item !== 'object') return;
                const tipoStr = String(item.tipo || '').toLowerCase();
                if (caminho === 'feed' && !['criatura', 'chefe', 'bestiario'].includes(tipoStr)) return;

                const optId = `comunidade_${caminho}_${key}`;
                const ehChefe = isChefe || tipoStr === 'chefe' || item.isChefe === true;
                const nome = (item.nome || item.titulo || 'Criatura').replace(/^\[?(Criatura|Chefe)\]?:\s*/i, '');
                const pv = Number(item.pvMax ?? item.vidaMax ?? item.pv ?? item.vida ?? (ehChefe ? 80 : 18));
                const ta = Number(item.ta ?? item.dificuldade ?? item.defesa ?? (ehChefe ? 17 : 13));
                const din = Number(item.dinamismo ?? item.atributos?.dinamismo ?? (ehChefe ? 5 : 3));

                BESTIARIO_PRESETS[optId] = { nome, pvMax: pv, ta, dinamismo: din, tipo: 'inimigo' };

                let opt = document.getElementById(optId);
                if (!opt) {
                    opt = document.createElement('option');
                    opt.id = optId;
                    opt.value = optId;
                    selectBestiario.appendChild(opt);
                }
                opt.textContent = `${ehChefe ? '👑 [Chefe]' : '👹 [Criatura]'} ${nome} (PV ${pv} | TA ${ta} | Din ${din})`;
            });
        });
    };

    carregarNo('criaturas', false);
    carregarNo('bestiario', false);
    carregarNo('chefes', true);
    carregarNo('feed', false);
}

function iniciarCombate(salaId) {
    sincronizarBestiarioComunidade();

    const combateRef = ref(db, `salas/${salaId}/mestre/combate`);

    onValue(combateRef, (snap) => {
        const val = snap.val();
        estadoCombate = {
            turno: val?.turno || 1,
            indiceAtivo: val?.indiceAtivo || 0,
            combatentes: Array.isArray(val?.combatentes) ? val.combatentes : []
        };

        document.getElementById('numero-turno').textContent = estadoCombate.turno;
        const ativo = estadoCombate.combatentes[estadoCombate.indiceAtivo];
        document.getElementById('combatente-ativo-nome').textContent = ativo
            ? `Vez de: ${ativo.nome}`
            : 'Nenhum combatente ativo';

        renderizarIniciativa(salaId);
    });

    document.getElementById('btn-adicionar-combatente')?.addEventListener('click', () => {
        const presetKey = document.getElementById('select-bestiario').value;
        const nomeCustom = document.getElementById('custom-nome').value.trim();
        const pvCustom = Number(document.getElementById('custom-pv').value);
        const initCustom = Number(document.getElementById('custom-init').value);

        if (presetKey && BESTIARIO_PRESETS[presetKey]) {
            const p = BESTIARIO_PRESETS[presetKey];
            const d12 = Math.floor(Math.random() * 12) + 1;
            adicionarCombatente(salaId, {
                nome: nomeCustom || p.nome,
                pvAtual: pvCustom || p.pvMax,
                pvMax: pvCustom || p.pvMax,
                iniciativa: initCustom || (d12 + p.dinamismo),
                detalhe: `TA ${p.ta} • d12(${d12})+${p.dinamismo}`,
                tipo: 'inimigo'
            });
        } else if (nomeCustom) {
            adicionarCombatente(salaId, {
                nome: nomeCustom,
                pvAtual: pvCustom || 15,
                pvMax: pvCustom || 15,
                iniciativa: initCustom || (Math.floor(Math.random() * 12) + 1),
                detalhe: 'Combatente Avulso',
                tipo: 'inimigo'
            });
        }

        document.getElementById('select-bestiario').value = '';
        document.getElementById('custom-nome').value = '';
        document.getElementById('custom-pv').value = '';
        document.getElementById('custom-init').value = '';
    });

    document.getElementById('btn-ordenar-iniciativa')?.addEventListener('click', () => {
        const ordenados = [...estadoCombate.combatentes].sort((a, b) => b.iniciativa - a.iniciativa);
        set(combateRef, { ...estadoCombate, indiceAtivo: 0, combatentes: ordenados });
    });

    document.getElementById('btn-proximo-turno')?.addEventListener('click', () => {
        if (estadoCombate.combatentes.length === 0) return;
        let proxIndice = estadoCombate.indiceAtivo + 1;
        let proxTurno = estadoCombate.turno;

        if (proxIndice >= estadoCombate.combatentes.length) {
            proxIndice = 0;
            proxTurno += 1;
        }

        set(combateRef, { ...estadoCombate, indiceAtivo: proxIndice, turno: proxTurno });
    });

    document.getElementById('btn-limpar-combate')?.addEventListener('click', () => {
        if (confirm('Encerrar combate e limpar a lista de iniciativa?')) {
            set(combateRef, { turno: 1, indiceAtivo: 0, combatentes: [] });
        }
    });
}

function adicionarCombatente(salaId, novo) {
    const lista = [...estadoCombate.combatentes, novo].sort((a, b) => b.iniciativa - a.iniciativa);
    set(ref(db, `salas/${salaId}/mestre/combate`), {
        ...estadoCombate,
        combatentes: lista
    });
}

function renderizarIniciativa(salaId) {
    const listaEl = document.getElementById('lista-iniciativa');
    if (!listaEl) return;

    if (estadoCombate.combatentes.length === 0) {
        listaEl.innerHTML = '<p class="texto-vazio">Nenhuma criatura ou Arquivista em combate.</p>';
        return;
    }

    listaEl.innerHTML = '';
    estadoCombate.combatentes.forEach((c, idx) => {
        const div = document.createElement('div');
        div.className = `comb-item ${c.tipo || 'inimigo'} ${idx === estadoCombate.indiceAtivo ? 'ativo' : ''}`;
        div.innerHTML = `
            <div class="comb-info">
                <strong>[${c.iniciativa}] ${c.nome}</strong>
                <small>${c.detalhe || ''}</small>
            </div>
            <div class="comb-controles">
                <button class="btn-mini btn-pv-menos">-1</button>
                <span style="font-size:0.85rem; min-width:48px; text-align:center;">❤️ ${c.pvAtual}/${c.pvMax}</span>
                <button class="btn-mini btn-pv-mais">+1</button>
                <button class="btn-mini btn-del-comb" style="color:#ff8080">✕</button>
            </div>
        `;

        div.querySelector('.btn-pv-menos').addEventListener('click', () => {
            const copia = [...estadoCombate.combatentes];
            copia[idx].pvAtual = Math.max(0, copia[idx].pvAtual - 1);
            set(ref(db, `salas/${salaId}/mestre/combate/combatentes`), copia);
        });

        div.querySelector('.btn-pv-mais').addEventListener('click', () => {
            const copia = [...estadoCombate.combatentes];
            copia[idx].pvAtual += 1;
            set(ref(db, `salas/${salaId}/mestre/combate/combatentes`), copia);
        });

        div.querySelector('.btn-del-comb').addEventListener('click', () => {
            const copia = estadoCombate.combatentes.filter((_, i) => i !== idx);
            set(ref(db, `salas/${salaId}/mestre/combate`), {
                ...estadoCombate,
                indiceAtivo: 0,
                combatentes: copia
            });
        });

        listaEl.appendChild(div);
    });
}

// =========================================================
// 4. ESCUDO, ORÁCULOS E NOTAS DO GUARDIÃO
// =========================================================
function iniciarEscudoEOraculos(salaId) {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab)?.classList.add('active');
        });
    });

    const boxResultado = document.getElementById('resultado-oraculo');
    document.getElementById('btn-rolar-missao')?.addEventListener('click', () => {
        boxResultado.textContent =
            `📜 GANCHO DE CRÔNICA GERADO:\n\n` +
            `• Gênero: ${r12(ORACULOS.genero)}\n` +
            `• Quem Envia: ${r12(ORACULOS.quem)}\n` +
            `• Onde Acontece: ${r12(ORACULOS.onde)}\n` +
            `• Objetivo: ${r12(ORACULOS.objetivo)}\n` +
            `• Obstáculo: ${r12(ORACULOS.obstaculo)}\n` +
            `• Reviravolta: ${r12(ORACULOS.reviravolta)}`;
    });

    document.querySelectorAll('[data-oraculo]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const tipo = btn.dataset.oraculo;
            const lista = ORACULOS[tipo];
            if (lista) {
                boxResultado.textContent = `🔮 ORÁCULO (${tipo.toUpperCase()}):\n\n${r12(lista)}`;
            }
        });
    });

    const notasEl = document.getElementById('notas-guardiao');
    const statusNotas = document.getElementById('status-notas');
    const notasRef = ref(db, `salas/${salaId}/mestre/notas`);
    let timerDebounce = null;

    onValue(notasRef, (snap) => {
        const textoSalvo = snap.val() || '';
        if (document.activeElement !== notasEl) {
            notasEl.value = textoSalvo;
        }
    });

    notasEl?.addEventListener('input', () => {
        if (statusNotas) statusNotas.textContent = 'Salvando...';
        clearTimeout(timerDebounce);
        timerDebounce = setTimeout(() => {
            set(notasRef, notasEl.value).then(() => {
                if (statusNotas) statusNotas.textContent = '✅ Sincronizado com a sala.';
            });
        }, 600);
    });
}