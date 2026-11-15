import { auth, db, storage } from './firebase.js';
import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { ref as dbRef, get, set, update, remove, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { registrarNotificacao } from './interacoes.js';

const params = new URLSearchParams(window.location.search);
let perfilUid = params.get('uid');
let usuarioLogado = null;

// Elementos alinhados com pages/perfil.html
const elAvatar = document.getElementById('perfil-avatar');
const elNome = document.getElementById('perfil-nome');
const elTitulo = document.getElementById('perfil-titulo');
const elBio = document.getElementById('perfil-bio');
const elSeguidores = document.getElementById('qtd-seguidores');
const elSeguindo = document.getElementById('qtd-seguindo');
const elQtdPersonagens = document.getElementById('qtd-personagens');
const elEstante = document.getElementById('lista-estante-publica');
const elFeedPessoal = document.getElementById('feed-pessoal');
const btnSeguir = document.getElementById('btn-seguir');
const btnEditarPerfil = document.getElementById('btn-editar-perfil');

// Elementos da Modal de Edição
const modalEditar = document.getElementById('modal-editar-perfil');
const inputEditNome = document.getElementById('edit-nome');
const inputEditTitulo = document.getElementById('edit-titulo');
const inputEditBio = document.getElementById('edit-bio');
const inputEditFoto = document.getElementById('edit-foto-file');
const btnSalvarIdentidade = document.getElementById('btn-salvar-identidade');

onAuthStateChanged(auth, async (user) => {
    usuarioLogado = user;

    if (!perfilUid && user) {
        perfilUid = user.uid;
    }

    if (!perfilUid) {
        if (elNome) elNome.textContent = "Perfil não encontrado (faça login)";
        return;
    }

    await inicializarPerfil(perfilUid);
});

async function inicializarPerfil(uid) {
    const ehProprioPerfil = usuarioLogado && usuarioLogado.uid === uid;
    const userRef = dbRef(db, `usuarios/${uid}`);
    const snap = await get(userRef);

    let dadosPerfil = snap.exists() ? snap.val() : null;

    if (!dadosPerfil && ehProprioPerfil) {
        dadosPerfil = {
            nome: usuarioLogado.displayName || usuarioLogado.email.split('@')[0],
            titulo: "Investigador Iniciante",
            bio: "Explorando os mistérios da Biblioteca da 5ª Avenida.",
            fotoUrl: usuarioLogado.photoURL || ""
        };
        await set(userRef, dadosPerfil);
    }

    if (dadosPerfil) {
        if (elNome) elNome.textContent = dadosPerfil.nome || "Agente";
        if (elTitulo) elTitulo.textContent = dadosPerfil.titulo || "Investigador";
        if (elBio) elBio.textContent = dadosPerfil.bio || "Sem biografia registrada.";
        if (elAvatar) {
            elAvatar.src = dadosPerfil.fotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(dadosPerfil.nome || 'A')}&background=1e293b&color=c5a059`;
        }
    }

    // Controle de botões (Editar vs Seguir)
    if (ehProprioPerfil) {
        if (btnEditarPerfil) {
            btnEditarPerfil.style.display = 'inline-block';
            btnEditarPerfil.onclick = () => {
                if (inputEditNome) inputEditNome.value = dadosPerfil?.nome || "";
                if (inputEditTitulo) inputEditTitulo.value = dadosPerfil?.titulo || "";
                if (inputEditBio) inputEditBio.value = dadosPerfil?.bio || "";
                if (modalEditar) modalEditar.style.display = 'flex';
            };
        }
        if (btnSeguir) btnSeguir.style.display = 'none';
    } else {
        if (btnEditarPerfil) btnEditarPerfil.style.display = 'none';
        if (btnSeguir && usuarioLogado) {
            btnSeguir.style.display = 'inline-block';
            configurarBotaoSeguir(uid);
        }
    }

    escutarContadoresSeguidores(uid);
    carregarEstantePersonagens(uid);
    carregarCronicasDoUsuario(uid);
}

// Salvar edição de perfil
if (btnSalvarIdentidade) {
    btnSalvarIdentidade.addEventListener('click', async () => {
        if (!usuarioLogado) return;

        const novoNome = inputEditNome?.value.trim();
        const novoTitulo = inputEditTitulo?.value.trim() || "Investigador";
        const novaBio = inputEditBio?.value.trim() || "";

        if (!novoNome) {
            alert("O nome não pode ficar em branco.");
            return;
        }

        btnSalvarIdentidade.disabled = true;
        btnSalvarIdentidade.textContent = "Salvando...";

        try {
            let novaFotoUrl = elAvatar?.src || "";

            if (inputEditFoto && inputEditFoto.files && inputEditFoto.files[0]) {
                const file = inputEditFoto.files[0];
                const fotoRef = storageRef(storage, `avatares/${usuarioLogado.uid}_${Date.now()}`);
                await uploadBytes(fotoRef, file);
                novaFotoUrl = await getDownloadURL(fotoRef);
            }

            await update(dbRef(db, `usuarios/${usuarioLogado.uid}`), {
                nome: novoNome,
                titulo: novoTitulo,
                bio: novaBio,
                fotoUrl: novaFotoUrl
            });

            await updateProfile(usuarioLogado, {
                displayName: novoNome,
                photoURL: novaFotoUrl
            });

            if (elNome) elNome.textContent = novoNome;
            if (elTitulo) elTitulo.textContent = novoTitulo;
            if (elBio) elBio.textContent = novaBio;
            if (elAvatar) elAvatar.src = novaFotoUrl;

            if (modalEditar) modalEditar.style.display = 'none';
        } catch (erro) {
            console.error("Erro ao atualizar perfil:", erro);
            alert("Erro ao salvar perfil: " + erro.message);
        } finally {
            btnSalvarIdentidade.disabled = false;
            btnSalvarIdentidade.textContent = "Salvar Alterações";
        }
    });
}

function escutarContadoresSeguidores(uid) {
    onValue(dbRef(db, `seguidores/${uid}`), (snap) => {
        if (elSeguidores) elSeguidores.textContent = snap.exists() ? Object.keys(snap.val()).length : 0;
    });

    onValue(dbRef(db, `seguindo/${uid}`), (snap) => {
        if (elSeguindo) elSeguindo.textContent = snap.exists() ? Object.keys(snap.val()).length : 0;
    });
}

function configurarBotaoSeguir(alvoUid) {
    const seguidorRef = dbRef(db, `seguidores/${alvoUid}/${usuarioLogado.uid}`);
    const seguindoRef = dbRef(db, `seguindo/${usuarioLogado.uid}/${alvoUid}`);

    onValue(seguidorRef, (snap) => {
        const jaSegue = snap.exists();
        btnSeguir.textContent = jaSegue ? "✓ Seguindo" : "+ Seguir";
        btnSeguir.style.background = jaSegue ? "#1e293b" : "#c5a059";
        btnSeguir.style.color = jaSegue ? "#e2e8f0" : "#0b0f17";
    });

    btnSeguir.onclick = async () => {
        const snap = await get(seguidorRef);
        if (snap.exists()) {
            await remove(seguidorRef);
            await remove(seguindoRef);
        } else {
            await set(seguidorRef, true);
            await set(seguindoRef, true);
            const meuNome = usuarioLogado.displayName || usuarioLogado.email.split('@')[0];
            await registrarNotificacao(
                alvoUid,
                `<strong>${meuNome}</strong> começou a seguir você.`,
                `pages/perfil.html?uid=${usuarioLogado.uid}`
            );
        }
    };
}

// Lê os personagens salvos em salas/sala-padrao/jogadores/{uid} (e fichas/{uid} caso existam)
async function carregarEstantePersonagens(uid) {
    if (!elEstante) return;

    const personagens = [];

    // 1. Verifica ficha ativa na sala padrão
    const salaSnap = await get(dbRef(db, `salas/sala-padrao/jogadores/${uid}`));
    if (salaSnap.exists()) {
        const dados = salaSnap.val();
        if (dados.ficha) {
            personagens.push({ id: 'ativo', ...dados.ficha });
        }
    }

    // 2. Verifica também estante multi-fichas caso exista
    const estanteSnap = await get(dbRef(db, `estante/${uid}`));
    if (estanteSnap.exists()) {
        estanteSnap.forEach(child => {
            personagens.push({ id: child.key, ...child.val() });
        });
    }

    if (elQtdPersonagens) elQtdPersonagens.textContent = personagens.length;

    if (personagens.length === 0) {
        elEstante.innerHTML = `<p style="color: #64748b; font-size: 0.9rem;">Nenhum personagem público encontrado.</p>`;
        return;
    }

    elEstante.innerHTML = personagens.map(f => `
        <div style="background: rgba(15, 20, 30, 0.9); border: 1px solid #2a3142; border-left: 3px solid #c5a059; border-radius: 8px; padding: 12px;">
            <strong style="color: #f8fafc; display: block; font-size: 1rem;">${f.nome || 'Sem Nome'}</strong>
            <span style="color: #c5a059; font-size: 0.8rem;">${f.caminho || 'Sem Caminho'}</span>
            <div style="margin-top: 8px; font-size: 0.8rem; color: #94a3b8;">
                ❤️ PV: ${f.pvAtual ?? f.pvMax ?? '?'} | ✨ PE: ${f.peAtual ?? f.peMax ?? '?'}
            </div>
        </div>
    `).join('');
}

// Carrega as crônicas escritas por este usuário
function carregarCronicasDoUsuario(uid) {
    if (!elFeedPessoal) return;

    onValue(dbRef(db, 'cronicas'), (snap) => {
        if (!snap.exists()) {
            elFeedPessoal.innerHTML = `<p style="color: #64748b; text-align: center;">Nenhuma crônica publicada ainda.</p>`;
            return;
        }

        const posts = [];
        snap.forEach(child => {
            const val = child.val();
            if (val.autorId === uid) {
                posts.push({ id: child.key, ...val });
            }
        });

        posts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (posts.length === 0) {
            elFeedPessoal.innerHTML = `<p style="color: #64748b; text-align: center;">Nenhuma crônica publicada por este agente.</p>`;
            return;
        }

        elFeedPessoal.innerHTML = posts.map(p => `
            <article style="background: rgba(19, 24, 35, 0.85); border: 1px solid #2a3142; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <strong style="color: #f8fafc; font-size: 1.05rem;">${p.titulo}</strong>
                    <small style="color: #64748b;">${p.timestamp ? new Date(p.timestamp).toLocaleDateString('pt-BR') : ''}</small>
                </div>
                <p style="color: #cbd5e1; font-size: 0.9rem; line-height: 1.5; white-space: pre-line;">${p.conteudo}</p>
            </article>
        `).join('');
    });
}