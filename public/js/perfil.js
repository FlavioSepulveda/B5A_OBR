import { app, auth, db, salaAtual } from './firebase.js';
import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { ref as dbRef, get, set, push, update, remove, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const storage = getStorage(app);

const params = new URLSearchParams(window.location.search);
let perfilUid = params.get('uid');
let usuarioLogado = null;
let ehProprioPerfil = false;
let filtroNaturezaAtual = 'todas';
let listaAnomaliasCache = [];

// PAPÉIS DO USUÁRIO NA MESA (JOGADOR VS MESTRE)
const PAPEIS_INFO = {
    arquivista: {
        nome: "📜 Arquivista (Jogador)",
        frase: '"Pronto para cruzar uma porta esquecida e registrar o desconhecido."'
    },
    guardiao: {
        nome: "👁️ Guardião do Arquivo (Mestre)",
        frase: '"Toda história precisa de alguém para revelar o que se esconde nas entrelinhas."'
    },
    ambos: {
        nome: "⚖️ Guardião & Arquivista",
        frase: '"Ora escrevendo o próprio Diário, ora guiando outros pelos corredores da 5ª Avenida."'
    }
};

// ESPECTROS DOS PERSONAGENS E ANOMALIAS
const ESPECTROS_INFO = {
    padrao:    { nome: "Sem Espectro", cor: "#d4af37" },
    igneo:     { nome: "Ígneo",        cor: "#e63946" },
    celeste:   { nome: "Celeste",      cor: "#4cc9f0" },
    viridiano: { nome: "Viridiano",    cor: "#2ec4b6" },
    solar:     { nome: "Solar",        cor: "#ffbe0b" },
    indigo:    { nome: "Índigo",       cor: "#9b5de5" },
    alabastro: { nome: "Alabastro",    cor: "#f8f9fa" }
};

const TITULOS_LIVRO = [
    { nome: "Bibliotecário-Chefe", cat: "Investigação", req: "Ter resolvido um mistério usando apenas informação de um livro.", efeito: "Role um dado adicional e descarte o menor em testes de Conhecimento ou Investigação." },
    { nome: "Aquele que Enxerga o Invisível", cat: "Investigação", req: "Ter encontrado algo que ninguém mais conseguia ver.", efeito: "+2 em Percepção e Investigação; identifica rastros de Ímpeto recentes." },
    { nome: "Aquele que Conversa com Ecos", cat: "Investigação", req: "Ter ouvido o eco de uma criatura morta.", efeito: "+2 em Ataques e +1d4 Vida Temporária contra um alvo; 1x/cena pergunta ao Guardião sobre o passado dela." },
    { nome: "Aquele que Conhece os Nomes Proibidos", cat: "Investigação", req: "Ter aprendido um nome que não deveria ser pronunciado.", efeito: "Descobre os efeitos de qualquer Palavra, Frase ou Título ao encontrá-lo pela primeira vez. +2 em Conhecimento." },
    { nome: "Mestre da Biblioteca", cat: "Investigação", req: "Ter passado uma cena inteira estudando um registro antigo.", efeito: "Reduz em 1 PI o custo de uma Frase de Efeito conhecida." },
    { nome: "O Cartógrafo", cat: "Investigação", req: "Ter mapeado um local desconhecido.", efeito: "Recebe a Palavra Mapear (1 PI: conhece saídas, armadilhas e passagens ocultas em 30m)." },
    { nome: "Olhos da Verdade", cat: "Investigação", req: "Ter desmascarado uma ilusão ou mentira.", efeito: "Recebe a Palavra Revelar (1 PI: ignora Oculto, ilusões e disfarces simples até o fim da cena)." },
    { nome: "Aquele que Nunca Cai", cat: "Combate", req: "Ter chegado a 0 PV em combate e continuado lutando.", efeito: "1x/cena, ao chegar a 0 PV, permanece com 1 PV." },
    { nome: "Escudo da Cidade", cat: "Combate", req: "Ter protegido um grupo de aliados durante um combate inteiro.", efeito: "Aliados a até 6m recebem +1d4 de Vida Temporária no início de cada turno." },
    { nome: "Senhor das Correntes", cat: "Combate", req: "Ter capturado uma criatura sem matá-la.", efeito: "Recebe a Frase 'Que as correntes julguem seus passos' com +2 na TA." },
    { nome: "Amigo dos Monstros", cat: "Suporte", req: "Ter feito amizade com uma criatura que outros consideravam um monstro.", efeito: "Feras recebem -2 na TA para resistir às suas habilidades." },
    { nome: "Médico de Guerra", cat: "Suporte", req: "Ter salvado um aliado que estava Caído.", efeito: "Ao curar criatura com menos da metade da Vida, cura +2d6." },
    { nome: "Explorador Nato", cat: "Mobilidade", req: "Ter encontrado um caminho onde ninguém mais via.", efeito: "Recebe a Palavra Rastrear (1 PI: +2 em Percepção e Investigação para localizar rastros)." },
    { nome: "Colecionador de Sonhos", cat: "Mobilidade", req: "Ter tido um sonho que revelou uma verdade importante.", efeito: "Ao concluir descanso, faz uma pergunta verdadeira ao Guardião sobre a missão." }
];

const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function escaparHtml(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function aplicarPapelUsuario(papelKey, statusMesa) {
    const key = PAPEIS_INFO[papelKey] ? papelKey : 'arquivista';
    document.body.className = `papel-${key}`;
    const info = PAPEIS_INFO[key];

    const badge = document.getElementById('perfil-papel-badge');
    const frase = document.getElementById('perfil-frase-papel');
    const statusEl = document.getElementById('perfil-status-mesa');

    if (badge) badge.textContent = info.nome;
    if (frase) frase.textContent = info.frase;
    if (statusEl) statusEl.textContent = statusMesa || "🟢 Procurando Mesa";
}

// INICIALIZAÇÃO VIA AUTH
onAuthStateChanged(auth, async (user) => {
    usuarioLogado = user;

    if (!perfilUid && user) {
        perfilUid = user.uid;
    }

    if (!perfilUid) {
        document.getElementById('perfil-nome').textContent = "Usuário não identificado";
        document.getElementById('perfil-bio').textContent = "Clique em 'Entrar com Google' no topo ou acesse com ?uid=ID_DO_USUARIO.";
        return;
    }

    try {
        await inicializarPerfil(perfilUid);
    } catch (erro) {
        console.error("Erro ao carregar perfil:", erro);
        document.getElementById('perfil-nome').textContent = "Erro ao ler arquivo";
        document.getElementById('perfil-bio').textContent = erro.message;
    }
});

async function inicializarPerfil(uid) {
    ehProprioPerfil = Boolean(usuarioLogado && usuarioLogado.uid === uid);
    const userRef = dbRef(db, `usuarios/${uid}`);
    const snap = await get(userRef);
    let dadosPerfil = snap.exists() ? snap.val() : null;

    if (!dadosPerfil && ehProprioPerfil) {
        dadosPerfil = {
            nome: usuarioLogado.displayName || usuarioLogado.email.split('@')[0],
            papel: "arquivista",
            statusMesa: "🟢 Procurando Mesa",
            bio: "Atravessou uma porta esquecida e agora explora os arquivos da 5ª Avenida.",
            fotoUrl: usuarioLogado.photoURL || ""
        };
        await set(userRef, dadosPerfil);
    }

    const nomeExibir = dadosPerfil?.nome || dadosPerfil?.displayName || (ehProprioPerfil ? usuarioLogado?.displayName : null) || "Usuário";
    const papelAtual = dadosPerfil?.papel || "arquivista";
    const statusMesaAtual = dadosPerfil?.statusMesa || "🟢 Procurando Mesa";
    const bioExibir = dadosPerfil?.bio || "Sem anotação pessoal.";
    const fotoExibir = dadosPerfil?.fotoUrl || dadosPerfil?.photoURL || dadosPerfil?.avatar || (ehProprioPerfil ? usuarioLogado?.photoURL : null) || `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeExibir)}&background=1f1b24&color=d4af37`;

    document.getElementById('perfil-nome').textContent = nomeExibir;
    document.getElementById('perfil-bio').textContent = `"${bioExibir}"`;
    document.getElementById('perfil-avatar').src = fotoExibir;
    aplicarPapelUsuario(papelAtual, statusMesaAtual);

    // Permissões de Dono vs Visitante
    const btnEditar = document.getElementById('btn-editar-perfil');
    const btnSeguir = document.getElementById('btn-seguir');

    if (ehProprioPerfil) {
        btnEditar.style.display = 'block';
        document.getElementById('btn-novo-personagem').style.display = 'inline-block';
        document.getElementById('controles-nfc-dono').style.display = 'flex';
        document.getElementById('btn-abrir-modal-campanha').style.display = 'inline-block';
        document.getElementById('btn-abrir-modal-titulo').style.display = 'inline-block';

        btnEditar.onclick = () => {
            document.getElementById('edit-nome').value = nomeExibir;
            document.getElementById('edit-papel').value = dadosPerfil?.papel || "arquivista";
            document.getElementById('edit-status-mesa').value = dadosPerfil?.statusMesa || "🟢 Procurando Mesa";
            document.getElementById('edit-bio').value = dadosPerfil?.bio || "";
            document.getElementById('modal-editar-perfil').style.display = 'flex';
        };
    } else if (usuarioLogado) {
        btnSeguir.style.display = 'block';
        configurarBotaoSeguir(uid);
    }

    document.getElementById('btn-copiar-link').onclick = () => {
        const url = `${window.location.origin}${window.location.pathname}?uid=${uid}`;
        navigator.clipboard.writeText(url);
        const btn = document.getElementById('btn-copiar-link');
        btn.textContent = "✓ Link do Perfil Copiado!";
        setTimeout(() => btn.textContent = "🔗 Compartilhar Perfil", 2500);
    };

    escutarContadoresSeguidores(uid);
    carregarEstantePersonagens(uid);
    escutarAnomalias(uid);
    escutarCampanhas(uid);
    carregarCronicasDoUsuario(uid);
    escutarTitulos(uid);
    carregarForjaPessoal(uid);

    const nfcParam = params.get('nfc');
    if (nfcParam && ehProprioPerfil) {
        document.querySelector('[data-tab="tab-anomalias"]')?.click();
        document.getElementById('anomalia-codigo').value = nfcParam;
        document.getElementById('modal-anomalia').style.display = 'flex';
    }
}

// Helper para redimensionar imagem caso Firebase Storage não esteja ativo
function converterImagemBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const max = 256;
                const scale = Math.min(1, max / Math.max(img.width, img.height));
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.82));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// SALVAR CREDENCIAL NA BIBLIOTECA
document.getElementById('btn-salvar-identidade')?.addEventListener('click', async () => {
    if (!usuarioLogado) return;
    const novoNome = document.getElementById('edit-nome').value.trim();
    const novoPapel = document.getElementById('edit-papel').value;
    const novoStatusMesa = document.getElementById('edit-status-mesa').value;
    const novaBio = document.getElementById('edit-bio').value.trim();
    const inputFoto = document.getElementById('edit-foto-file');

    if (!novoNome) return alert("O nome não pode ficar em branco.");

    const btn = document.getElementById('btn-salvar-identidade');
    btn.disabled = true;
    btn.textContent = "Gravando no Arquivo...";

    try {
        let fotoUrl = document.getElementById('perfil-avatar').src;
        if (inputFoto.files && inputFoto.files[0]) {
            try {
                const fotoRef = storageRef(storage, `avatares/${usuarioLogado.uid}_${Date.now()}`);
                await uploadBytes(fotoRef, inputFoto.files[0]);
                fotoUrl = await getDownloadURL(fotoRef);
            } catch (_) {
                fotoUrl = await converterImagemBase64(inputFoto.files[0]);
            }
        }

        await update(dbRef(db, `usuarios/${usuarioLogado.uid}`), {
            nome: novoNome,
            papel: novoPapel,
            statusMesa: novoStatusMesa,
            bio: novaBio,
            fotoUrl
        });

        if (!fotoUrl.startsWith('data:')) {
            await updateProfile(usuarioLogado, { displayName: novoNome, photoURL: fotoUrl }).catch(() => {});
        }

        document.getElementById('perfil-nome').textContent = novoNome;
        document.getElementById('perfil-bio').textContent = `"${novaBio}"`;
        document.getElementById('perfil-avatar').src = fotoUrl;
        aplicarPapelUsuario(novoPapel, novoStatusMesa);
        document.getElementById('modal-editar-perfil').style.display = 'none';
    } catch (e) {
        alert("Erro ao salvar credencial: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Salvar Credencial";
    }
});

// SEGUIDORES
function escutarContadoresSeguidores(uid) {
    onValue(dbRef(db, `seguidores/${uid}`), snap => {
        document.getElementById('qtd-seguidores').textContent = snap.exists() ? Object.keys(snap.val()).length : 0;
    });
    onValue(dbRef(db, `seguindo/${uid}`), snap => {
        document.getElementById('qtd-seguindo').textContent = snap.exists() ? Object.keys(snap.val()).length : 0;
    });
}

function configurarBotaoSeguir(alvoUid) {
    const btnSeguir = document.getElementById('btn-seguir');
    const segRef = dbRef(db, `seguidores/${alvoUid}/${usuarioLogado.uid}`);
    const seguindoRef = dbRef(db, `seguindo/${usuarioLogado.uid}/${alvoUid}`);

    onValue(segRef, snap => {
        const segue = snap.exists();
        btnSeguir.textContent = segue ? "✓ Seguindo" : "+ Seguir Usuário";
        btnSeguir.className = segue ? "btn-secundario" : "btn-primario";
    });

    btnSeguir.onclick = async () => {
        const snap = await get(segRef);
        if (snap.exists()) {
            await remove(segRef);
            await remove(seguindoRef);
        } else {
            await set(segRef, true);
            await set(seguindoRef, true);
            try {
                const mod = await import('./interacoes.js');
                if (mod.registrarNotificacao) {
                    await mod.registrarNotificacao(
                        alvoUid,
                        `<strong>${usuarioLogado.displayName || 'Um usuário'}</strong> começou a seguir seu perfil.`,
                        `pages/perfil.html?uid=${usuarioLogado.uid}`
                    );
                }
            } catch (_) {}
        }
    };
}

// 1. ESTANTE DE PERSONAGENS & DIÁRIOS
async function carregarEstantePersonagens(uid) {
    const elEstante = document.getElementById('lista-estante-publica');
    const personagens = [];
    const ids = new Set();

    const adicionarLista = (snap) => {
        if (!snap.exists()) return;
        snap.forEach(child => {
            const val = child.val();
            const f = val?.ficha || val;
            if (f && typeof f === 'object' && !ids.has(child.key)) {
                ids.add(child.key);
                personagens.push({ id: child.key, ...f });
            }
        });
    };

    const [estanteSnap1, estanteSnap2, salaPadraoSnap, salaAtualSnap] = await Promise.all([
        get(dbRef(db, `estante/${uid}`)).catch(() => ({ exists: () => false })),
        get(dbRef(db, `usuarios/${uid}/estante`)).catch(() => ({ exists: () => false })),
        get(dbRef(db, `salas/sala-padrao/jogadores/${uid}`)).catch(() => ({ exists: () => false })),
        get(dbRef(db, `salas/${salaAtual}/jogadores/${uid}`)).catch(() => ({ exists: () => false }))
    ]);

    adicionarLista(estanteSnap1);
    adicionarLista(estanteSnap2);

    [salaPadraoSnap, salaAtualSnap].forEach((sSnap, idx) => {
        if (sSnap.exists()) {
            const val = sSnap.val();
            const f = val.ficha || (val.nome ? val : null);
            const chave = `sala_${idx}`;
            if (f && !personagens.some(p => p.nome === f.nome)) {
                personagens.push({ id: chave, ...f });
            }
        }
    });

    document.getElementById('qtd-personagens').textContent = personagens.length;

    if (personagens.length === 0) {
        elEstante.innerHTML = `<div class="estado-vazio">Nenhum Arquivista registrado na estante deste usuário ainda.</div>`;
        return;
    }

    elEstante.innerHTML = personagens.map(f => {
        const esp = ESPECTROS_INFO[f.espectro] || ESPECTROS_INFO.padrao;
        const vol = ROMANOS[(Number(f.volume) || 1) - 1] || "I";
        const classe = f.vocacao && f.tipoClasse === 'vocacao'
            ? `Vocação: ${f.vocacao}`
            : `Caminho: ${f.caminho || 'Guerreiro'}`;
        const morto = (f.pvAtual !== undefined && Number(f.pvAtual) <= 0 && f.status === 'morto');

        return `
            <article class="card-dossie" style="border-left-color: ${esp.cor};">
                <div>
                    <div class="card-dossie-topo">
                        <span class="badge-tag" style="color: ${esp.cor};">✦ ${esp.nome} • Vol. ${vol}</span>
                        <span class="badge-tag">${morto ? '📕 Diário no Acervo' : '🟢 Ativo'}</span>
                    </div>
                    <h3 style="margin-top: 6px;">${escaparHtml(f.nome || 'Arquivista sem Nome')}</h3>
                    <div class="card-dossie-sub">${escaparHtml(classe)}</div>
                    <div class="card-dossie-corpo" style="margin-top: 8px;">
                        ❤️ PV: <strong>${f.pvAtual ?? f.pvMax ?? '?'}</strong>/${f.pvMax ?? '?'} &nbsp;|&nbsp;
                        ✨ PI: <strong>${f.piAtual ?? f.piMax ?? '?'}</strong>/${f.piMax ?? '?'}
                        ${f.arma?.nome ? `<br>⚔️ Arma Favorita: ${escaparHtml(f.arma.nome)}` : ''}
                    </div>
                </div>
                <div class="card-dossie-rodape">
                    <span>${f.diarioNotas ? '📓 Possui registros no Diário' : '📖 Prólogo registrado'}</span>
                    <a href="ficha.html?id=${uid}" class="link-dossie">Abrir Ficha →</a>
                </div>
            </article>
        `;
    }).join('');
}

// 2. ANOMALIAS DESCOBERTAS & TAGS NFC
function escutarAnomalias(uid) {
    onValue(dbRef(db, `usuarios/${uid}/anomalias`), snap => {
        listaAnomaliasCache = [];
        if (snap.exists()) {
            snap.forEach(child => {
                listaAnomaliasCache.push({ id: child.key, ...child.val() });
            });
        }
        listaAnomaliasCache.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        document.getElementById('qtd-anomalias').textContent = listaAnomaliasCache.length;
        renderizarAnomalias();
    });
}

function renderizarAnomalias() {
    const elLista = document.getElementById('lista-anomalias');
    const filtradas = filtroNaturezaAtual === 'todas'
        ? listaAnomaliasCache
        : listaAnomaliasCache.filter(a => a.natureza === filtroNaturezaAtual);

    if (filtradas.length === 0) {
        elLista.innerHTML = `<div class="estado-vazio">Nenhuma anomalia ou tag NFC catalogada nesta categoria.</div>`;
        return;
    }

    elLista.innerHTML = filtradas.map(a => {
        const esp = ESPECTROS_INFO[a.espectro] || ESPECTROS_INFO.indigo;
        return `
            <article class="card-dossie" style="border-left-color: ${esp.cor};">
                <div>
                    <div class="card-dossie-topo">
                        <span class="badge-tag" style="color: ${esp.cor};">${escaparHtml(a.natureza || 'Anomalia')} • ${esp.nome}</span>
                        <span class="badge-tag">${escaparHtml(a.codigo || 'ARQUIVO')}</span>
                    </div>
                    <h3 style="margin-top: 6px;">${escaparHtml(a.nome)}</h3>
                    <div class="card-dossie-sub">${escaparHtml(a.status || 'Catalogada')}</div>
                    <div class="card-dossie-corpo" style="margin-top: 8px;">
                        ${escaparHtml(a.relato || 'Sem notas de campo adicionais.')}
                    </div>
                </div>
                <div class="card-dossie-rodape">
                    <span>📅 ${a.timestamp ? new Date(a.timestamp).toLocaleDateString('pt-BR') : 'Registrada'}</span>
                    ${ehProprioPerfil ? `<button type="button" class="btn-remover-item" data-del-anomalia="${a.id}">Excluir</button>` : ''}
                </div>
            </article>
        `;
    }).join('');

    if (ehProprioPerfil) {
        elLista.querySelectorAll('[data-del-anomalia]').forEach(btn => {
            btn.onclick = () => remove(dbRef(db, `usuarios/${perfilUid}/anomalias/${btn.dataset.delAnomalia}`));
        });
    }
}

document.querySelectorAll('#filtros-natureza .pill-filtro').forEach(pill => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('#filtros-natureza .pill-filtro').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        filtroNaturezaAtual = pill.dataset.natureza;
        renderizarAnomalias();
    });
});

document.getElementById('btn-abrir-modal-anomalia')?.addEventListener('click', () => {
    document.getElementById('anomalia-codigo').value = '';
    document.getElementById('anomalia-nome').value = '';
    document.getElementById('anomalia-relato').value = '';
    document.getElementById('modal-anomalia').style.display = 'flex';
});

document.getElementById('btn-escanear-nfc')?.addEventListener('click', async () => {
    const banner = document.getElementById('banner-status-nfc');
    banner.style.display = 'block';

    if (!('NDEFReader' in window)) {
        banner.innerHTML = `⚠️ Seu navegador/computador não possui leitor NFC físico ativo. Use o botão <strong>"+ Registrar Código"</strong> para digitar o código da tag da mesa.`;
        return;
    }

    try {
        const ndef = new NDEFReader();
        await ndef.scan();
        banner.innerHTML = `📡 <strong>Aproxime a tag NFC da Anomalia</strong> na traseira do celular para catalogar no Bestiário...`;

        ndef.onreading = ({ serialNumber, message }) => {
            let textoTag = '';
            for (const record of message.records) {
                if (record.recordType === 'text') {
                    const decoder = new TextDecoder(record.encoding || 'utf-8');
                    textoTag = decoder.decode(record.data);
                }
            }
            const codigoLido = textoTag || `NFC-${serialNumber}`;
            banner.innerHTML = `✅ Tag detectada: <strong>${escaparHtml(codigoLido)}</strong>! Preencha os detalhes da anomalia.`;
            document.getElementById('anomalia-codigo').value = codigoLido;
            document.getElementById('modal-anomalia').style.display = 'flex';
        };
    } catch (err) {
        banner.innerHTML = `❌ Não foi possível iniciar o leitor NFC (${escaparHtml(err.message)}). Use "+ Registrar Código".`;
    }
});

document.getElementById('btn-salvar-anomalia')?.addEventListener('click', async () => {
    if (!ehProprioPerfil) return;
    const nome = document.getElementById('anomalia-nome').value.trim();
    if (!nome) return alert("Informe o nome da anomalia descoberta.");

    await push(dbRef(db, `usuarios/${perfilUid}/anomalias`), {
        codigo: document.getElementById('anomalia-codigo').value.trim() || `B5A-${Math.floor(100 + Math.random() * 900)}`,
        nome,
        natureza: document.getElementById('anomalia-natureza').value,
        espectro: document.getElementById('anomalia-espectro').value,
        status: document.getElementById('anomalia-status').value,
        relato: document.getElementById('anomalia-relato').value.trim(),
        timestamp: Date.now()
    });

    document.getElementById('modal-anomalia').style.display = 'none';
});

// 3. CAMPANHAS JOGADAS & CRÔNICAS
function escutarCampanhas(uid) {
    const elCamp = document.getElementById('lista-campanhas');
    onValue(dbRef(db, `usuarios/${uid}/campanhas`), snap => {
        const campanhas = [];
        if (snap.exists()) {
            snap.forEach(c => campanhas.push({ id: c.key, ...c.val() }));
        }
        campanhas.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        document.getElementById('qtd-campanhas').textContent = campanhas.length;

        if (campanhas.length === 0) {
            elCamp.innerHTML = `<div class="estado-vazio">Nenhuma campanha registrada no histórico deste usuário.</div>`;
            return;
        }

        elCamp.innerHTML = campanhas.map(c => `
            <article class="card-dossie">
                <div>
                    <div class="card-dossie-topo">
                        <span class="badge-tag">${escaparHtml(c.papel || 'Arquivista')}</span>
                        <span class="badge-tag">${escaparHtml(c.status || 'Em Andamento')}</span>
                    </div>
                    <h3 style="margin-top: 6px;">${escaparHtml(c.titulo)}</h3>
                    <div class="card-dossie-sub">${escaparHtml(c.detalhe || '')}</div>
                    <div class="card-dossie-corpo" style="margin-top: 8px;">
                        ${escaparHtml(c.resumo || 'Crônica em desenvolvimento.')}
                    </div>
                </div>
                <div class="card-dossie-rodape">
                    <span>📅 Registrada em ${c.timestamp ? new Date(c.timestamp).toLocaleDateString('pt-BR') : 'Arquivo'}</span>
                    ${ehProprioPerfil ? `<button type="button" class="btn-remover-item" data-del-camp="${c.id}">Remover</button>` : ''}
                </div>
            </article>
        `).join('');

        if (ehProprioPerfil) {
            elCamp.querySelectorAll('[data-del-camp]').forEach(btn => {
                btn.onclick = () => remove(dbRef(db, `usuarios/${perfilUid}/campanhas/${btn.dataset.delCamp}`));
            });
        }
    });
}

document.getElementById('btn-abrir-modal-campanha')?.addEventListener('click', () => {
    document.getElementById('modal-campanha').style.display = 'flex';
});

document.getElementById('btn-salvar-campanha')?.addEventListener('click', async () => {
    if (!ehProprioPerfil) return;
    const titulo = document.getElementById('camp-titulo').value.trim();
    if (!titulo) return alert("Informe o nome da campanha.");

    await push(dbRef(db, `usuarios/${perfilUid}/campanhas`), {
        titulo,
        papel: document.getElementById('camp-papel').value,
        status: document.getElementById('camp-status').value,
        detalhe: document.getElementById('camp-detalhe').value.trim(),
        resumo: document.getElementById('camp-resumo').value.trim(),
        timestamp: Date.now()
    });

    document.getElementById('modal-campanha').style.display = 'none';
});

function carregarCronicasDoUsuario(uid) {
    const elFeed = document.getElementById('feed-pessoal');
    onValue(dbRef(db, 'cronicas'), snap => {
        const posts = [];
        if (snap.exists()) {
            snap.forEach(child => {
                const val = child.val();
                if (val && (val.autorId === uid || val.uid === uid || val.userId === uid)) {
                    posts.push({ id: child.key, ...val });
                }
            });
        }
        posts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (posts.length === 0) {
            elFeed.innerHTML = `<div class="estado-vazio">Nenhuma crônica pública publicada na comunidade ainda.</div>`;
            return;
        }

        elFeed.innerHTML = posts.map(p => `
            <article class="card-dossie" style="border-left-color: #4cc9f0;">
                <div>
                    <div class="card-dossie-topo">
                        <span class="badge-tag" style="color: #4cc9f0;">📖 Crônica Publicada</span>
                        <span>${p.timestamp ? new Date(p.timestamp).toLocaleDateString('pt-BR') : ''}</span>
                    </div>
                    <h3 style="margin-top: 6px;">${escaparHtml(p.titulo)}</h3>
                    <div class="card-dossie-corpo" style="margin-top: 8px; white-space: pre-line;">${escaparHtml(p.conteudo || p.texto || '')}</div>
                </div>
            </article>
        `).join('');
    });
}

// 4. TÍTULOS DO LIVRO DE REGRAS & ACERVO FORJADO
function escutarTitulos(uid) {
    const elTitulos = document.getElementById('lista-titulos');
    onValue(dbRef(db, `usuarios/${uid}/titulos`), snap => {
        const titulos = [];
        if (snap.exists()) {
            snap.forEach(c => titulos.push({ id: c.key, ...c.val() }));
        }
        document.getElementById('qtd-titulos').textContent = titulos.length;

        if (titulos.length === 0) {
            elTitulos.innerHTML = `<div class="estado-vazio">Nenhum Título conquistado registrado no Diário ainda (disponível a partir do Volume V ou feitos épicos).</div>`;
            return;
        }

        elTitulos.innerHTML = titulos.map(t => `
            <article class="card-dossie">
                <div>
                    <div class="card-dossie-topo">
                        <span class="badge-tag">🏆 ${escaparHtml(t.cat || 'Feito')}</span>
                        ${t.ativo ? '<span class="badge-tag" style="background: var(--cor-destaque); color: #000;">★ ATIVO</span>' : ''}
                    </div>
                    <h3 style="margin-top: 6px;">${escaparHtml(t.nome)}</h3>
                    <div class="card-dossie-sub">Pré-requisito: ${escaparHtml(t.req)}</div>
                    <div class="card-dossie-corpo" style="margin-top: 8px;">${escaparHtml(t.efeito)}</div>
                </div>
                ${ehProprioPerfil ? `
                    <div class="card-dossie-rodape">
                        <button type="button" class="btn-ativar-titulo ${t.ativo ? 'ativo' : ''}" data-ativar-titulo="${t.id}">
                            ${t.ativo ? '★ Título Equipado' : 'Equipar Título'}
                        </button>
                        <button type="button" class="btn-remover-item" data-del-titulo="${t.id}">Remover</button>
                    </div>
                ` : ''}
            </article>
        `).join('');

        if (ehProprioPerfil) {
            elTitulos.querySelectorAll('[data-ativar-titulo]').forEach(btn => {
                btn.onclick = async () => {
                    const alvoId = btn.dataset.ativarTitulo;
                    const updates = {};
                    titulos.forEach(item => {
                        updates[`usuarios/${uid}/titulos/${item.id}/ativo`] = (item.id === alvoId);
                    });
                    await update(dbRef(db), updates);
                };
            });
            elTitulos.querySelectorAll('[data-del-titulo]').forEach(btn => {
                btn.onclick = () => remove(dbRef(db, `usuarios/${uid}/titulos/${btn.dataset.delTitulo}`));
            });
        }
    });
}

const selectTitulo = document.getElementById('titulo-preset');
const previewTitulo = document.getElementById('preview-titulo-info');
if (selectTitulo && previewTitulo) {
    selectTitulo.innerHTML = TITULOS_LIVRO.map((t, idx) => `<option value="${idx}">${t.nome} (${t.cat})</option>`).join('');
    const atualizarPreviewTitulo = () => {
        const t = TITULOS_LIVRO[selectTitulo.value];
        previewTitulo.innerHTML = `<strong>Pré-requisito:</strong> ${t.req}<br><br><strong>Efeito Mecânico:</strong> ${t.efeito}`;
    };
    selectTitulo.addEventListener('change', atualizarPreviewTitulo);
    atualizarPreviewTitulo();
}

document.getElementById('btn-abrir-modal-titulo')?.addEventListener('click', () => {
    document.getElementById('modal-titulo').style.display = 'flex';
});

document.getElementById('btn-salvar-titulo')?.addEventListener('click', async () => {
    if (!ehProprioPerfil) return;
    const t = TITULOS_LIVRO[document.getElementById('titulo-preset').value];
    await push(dbRef(db, `usuarios/${perfilUid}/titulos`), {
        ...t,
        ativo: false,
        timestamp: Date.now()
    });
    document.getElementById('modal-titulo').style.display = 'none';
});

// CARREGAR ARMAS, ITENS E MONSTROS FORJADOS PELO USUÁRIO
async function carregarForjaPessoal(uid) {
    const elForja = document.getElementById('lista-forja-pessoal');
    const criacoes = [];

    const lerColecao = async (caminho, tipoLabel, cor, link) => {
        const snap = await get(dbRef(db, caminho)).catch(() => ({ exists: () => false }));
        if (!snap.exists()) return;
        snap.forEach(c => {
            const v = c.val();
            if (v && (v.uid === uid || v.autorId === uid || v.donoId === uid || v.criadorId === uid)) {
                criacoes.push({
                    tipo: tipoLabel,
                    cor,
                    link,
                    nome: v.nome || v.titulo || 'Sem Nome',
                    sub: v.categoria || v.tipo || v.natureza || '',
                    desc: v.descricao || v.efeito || v.passiva || ''
                });
            }
        });
    };

    await Promise.all([
        lerColecao('armas', '⚔️ Arma', '#ffbe0b', 'armas.html'),
        lerColecao('itens', '🎒 Item', '#f4a261', 'armas.html'),
        lerColecao('monstros', '👁️ Criatura', '#e63946', 'monstros.html')
    ]);

    if (criacoes.length === 0) {
        elForja.innerHTML = `<div class="estado-vazio">Nenhuma arma, relíquia ou criatura forjada nas oficinas ainda.</div>`;
        return;
    }

    elForja.innerHTML = criacoes.map(item => `
        <article class="card-dossie" style="border-left-color: ${item.cor};">
            <div>
                <div class="card-dossie-topo">
                    <span class="badge-tag" style="color: ${item.cor};">${item.tipo}</span>
                </div>
                <h3 style="margin-top: 6px;">${escaparHtml(item.nome)}</h3>
                <div class="card-dossie-sub">${escaparHtml(item.sub)}</div>
                <div class="card-dossie-corpo" style="margin-top: 8px;">${escaparHtml(item.desc)}</div>
            </div>
            <div class="card-dossie-rodape">
                <span>Acervo da Comunidade</span>
                <a href="${item.link}" class="link-dossie">Abrir Oficina →</a>
            </div>
        </article>
    `).join('');
}