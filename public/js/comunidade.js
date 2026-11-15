import { auth, db, storage } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { ref as dbRef, push, set, onValue, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { alternarCurtida, adicionarComentario, renderizarComentarios, registrarNotificacao } from './interacoes.js';

const inputTitulo = document.getElementById('cronica-titulo');
const inputConteudo = document.getElementById('cronica-conteudo');
const inputArquivo = document.getElementById('cronica-arquivo');
const inputImagemUrl = document.getElementById('cronica-imagem');
const btnSalvar = document.getElementById('btn-salvar-cronica');
const statusPostagem = document.getElementById('status-postagem');
const feedCronicas = document.getElementById('feed-cronicas');

let usuarioLogado = null;
let cronicaAbertaId = null;

onAuthStateChanged(auth, (user) => {
    usuarioLogado = user;
    const statusUser = document.getElementById('user-status-bar');
    if (statusUser) {
        statusUser.textContent = user ? `Conectado como ${user.displayName || user.email}` : 'Modo Leitura (Faça login para publicar)';
    }
    carregarFeedCronicas();
});

async function uploadImagemCronica(file, uid) {
    const extensao = file.name.split('.').pop();
    const nomeArquivo = `cronicas/${uid}_${Date.now()}.${extensao}`;
    const arquivoRef = storageRef(storage, nomeArquivo);
    await uploadBytes(arquivoRef, file);
    return await getDownloadURL(arquivoRef);
}

if (btnSalvar) {
    btnSalvar.addEventListener('click', async () => {
        if (!usuarioLogado) {
            alert("Você precisa estar logado para publicar na comunidade.");
            return;
        }

        const titulo = inputTitulo?.value.trim();
        const conteudo = inputConteudo?.value.trim();

        if (!titulo || !conteudo) {
            alert("Preencha o título e o texto da crônica.");
            return;
        }

        btnSalvar.disabled = true;
        btnSalvar.textContent = "Publicando...";
        if (statusPostagem) statusPostagem.textContent = "Enviando para os arquivos...";

        try {
            let imagemUrl = inputImagemUrl?.value.trim() || "";

            if (inputArquivo && inputArquivo.files && inputArquivo.files[0]) {
                const file = inputArquivo.files[0];
                if (!file.type.startsWith('image/')) {
                    throw new Error("Por favor, selecione apenas arquivos de imagem.");
                }
                imagemUrl = await uploadImagemCronica(file, usuarioLogado.uid);
            }

            const cronicasRef = dbRef(db, 'cronicas');
            const novaCronicaRef = push(cronicasRef);

            await set(novaCronicaRef, {
                titulo,
                conteudo,
                imagemUrl,
                autorId: usuarioLogado.uid,
                autorNome: usuarioLogado.displayName || usuarioLogado.email.split('@')[0],
                autorFoto: usuarioLogado.photoURL || "",
                timestamp: serverTimestamp()
            });

            if (inputTitulo) inputTitulo.value = "";
            if (inputConteudo) inputConteudo.value = "";
            if (inputArquivo) inputArquivo.value = "";
            if (inputImagemUrl) inputImagemUrl.value = "";
            if (statusPostagem) statusPostagem.textContent = "Crônica publicada com sucesso!";
            setTimeout(() => { if (statusPostagem) statusPostagem.textContent = ""; }, 3000);

        } catch (erro) {
            console.error("Erro ao publicar crônica:", erro);
            alert("Erro ao publicar: " + erro.message);
            if (statusPostagem) statusPostagem.textContent = "";
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.textContent = "Publicar nos Arquivos";
        }
    });
}

function carregarFeedCronicas() {
    if (!feedCronicas) return;

    const cronicasRef = dbRef(db, 'cronicas');
    onValue(cronicasRef, (snapshot) => {
        if (!snapshot.exists()) {
            feedCronicas.innerHTML = `<p style="color:#94a3b8; text-align:center; grid-column: 1/-1; padding: 30px;">Nenhuma crônica arquivada ainda. Seja o primeiro a relatar!</p>`;
            return;
        }

        const lista = [];
        snapshot.forEach(child => {
            lista.push({ id: child.key, ...child.val() });
        });

        lista.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        feedCronicas.innerHTML = lista.map(post => {
            const curtidasObj = post.curtidas || {};
            const totalCurtidas = Object.keys(curtidasObj).length;
            const curtiu = usuarioLogado && curtidasObj[usuarioLogado.uid];
            const totalComentarios = post.comentarios ? Object.keys(post.comentarios).length : 0;
            const ehAutor = usuarioLogado && post.autorId === usuarioLogado.uid;
            const dataTxt = post.timestamp ? new Date(post.timestamp).toLocaleDateString('pt-BR') : 'Recente';

            return `
                <article class="post-card" style="background: rgba(19, 24, 35, 0.85); border: 1px solid #2a3142; border-radius: 10px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <a href="perfil.html?uid=${post.autorId}" style="color: #c5a059; font-size: 0.85rem; text-decoration: none; font-weight: bold;">
                                ✒️ ${post.autorNome || 'Agente Anônimo'}
                            </a>
                            <small style="color: #64748b; font-size: 0.75rem;">${dataTxt}</small>
                        </div>

                        <h3 style="margin: 0 0 10px 0; color: #f8fafc; font-size: 1.15rem;">${post.titulo}</h3>

                        ${post.imagemUrl ? `<img src="${post.imagemUrl}" alt="${post.titulo}" style="width: 100%; max-height: 220px; object-fit: cover; border-radius: 6px; margin-bottom: 10px; border: 1px solid #2a3142;">` : ''}

                        <p style="color: #cbd5e1; font-size: 0.92rem; line-height: 1.5; white-space: pre-line; max-height: 140px; overflow: hidden;">${post.conteudo}</p>
                    </div>

                    <div style="border-top: 1px solid #2a3142; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <div style="display: flex; gap: 10px;">
                            <button class="btn-curtir-post" data-id="${post.id}" data-autor="${post.autorId}" data-titulo="${post.titulo}" style="background: ${curtiu ? 'rgba(239,68,68,0.18)' : 'transparent'}; border: 1px solid ${curtiu ? '#ef4444' : '#2a3142'}; color: ${curtiu ? '#fca5a5' : '#94a3b8'}; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                                ❤️ ${totalCurtidas}
                            </button>
                            <button class="btn-abrir-modal" data-id="${post.id}" style="background: transparent; border: 1px solid #2a3142; color: #94a3b8; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                                💬 Ler & Comentar (${totalComentarios})
                            </button>
                        </div>
                        ${ehAutor ? `<button class="btn-excluir-post" data-id="${post.id}" title="Excluir" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.85rem;">🗑️</button>` : ''}
                    </div>
                </article>
            `;
        }).join('');

        // Eventos dos cards
        document.querySelectorAll('.btn-curtir-post').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!usuarioLogado) return alert("Faça login para curtir.");
                const postId = btn.dataset.id;
                const autorId = btn.dataset.autor;
                const titulo = btn.dataset.titulo;
                const curtiuAgora = await alternarCurtida(`cronicas/${postId}`, usuarioLogado.uid);
                if (curtiuAgora && autorId && autorId !== usuarioLogado.uid) {
                    const nome = usuarioLogado.displayName || usuarioLogado.email.split('@')[0];
                    await registrarNotificacao(autorId, `<strong>${nome}</strong> curtiu sua crônica "<em>${titulo}</em>".`, `pages/comunidade.html`);
                }
            });
        });

        document.querySelectorAll('.btn-abrir-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                const post = lista.find(p => p.id === btn.dataset.id);
                if (post) abrirModalCronica(post);
            });
        });

        document.querySelectorAll('.btn-excluir-post').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm("Deseja apagar esta crônica permanentemente?")) {
                    await remove(dbRef(db, `cronicas/${btn.dataset.id}`));
                }
            });
        });
    });
}

// Integração com a Modal de Leitura e Comentários de comunidade.html
function abrirModalCronica(post) {
    const modal = document.getElementById('modal-cronica');
    if (!modal) return;

    cronicaAbertaId = post.id;
    document.getElementById('modal-titulo').textContent = post.titulo;
    document.getElementById('modal-autor').textContent = `Relatado por ${post.autorNome || 'Agente Anônimo'}`;
    document.getElementById('modal-texto').textContent = post.conteudo;

    const imgEl = document.getElementById('modal-img');
    if (imgEl) {
        if (post.imagemUrl) {
            imgEl.src = post.imagemUrl;
            imgEl.style.display = 'block';
        } else {
            imgEl.style.display = 'none';
        }
    }

    const totalCurtidas = post.curtidas ? Object.keys(post.curtidas).length : 0;
    const likesCount = document.getElementById('modal-likes-count');
    if (likesCount) likesCount.textContent = totalCurtidas;

    const btnLikeModal = document.getElementById('btn-like-modal');
    if (btnLikeModal) {
        btnLikeModal.onclick = async () => {
            if (!usuarioLogado) return alert("Faça login para curtir.");
            await alternarCurtida(`cronicas/${post.id}`, usuarioLogado.uid);
        };
    }

    const listaComentariosEl = document.getElementById('lista-comentarios');
    if (listaComentariosEl) {
        renderizarComentarios(post.comentarios, listaComentariosEl, usuarioLogado?.uid, `cronicas/${post.id}`);
    }

    const btnEnviarComent = document.getElementById('btn-enviar-comentario');
    const inputComent = document.getElementById('novo-comentario');
    if (btnEnviarComent && inputComent) {
        btnEnviarComent.onclick = async () => {
            if (!usuarioLogado) return alert("Faça login para comentar.");
            const texto = inputComent.value.trim();
            if (!texto) return;

            btnEnviarComent.disabled = true;
            await adicionarComentario(`cronicas/${post.id}`, usuarioLogado, texto);
            inputComent.value = "";
            btnEnviarComent.disabled = false;

            if (post.autorId && post.autorId !== usuarioLogado.uid) {
                const nome = usuarioLogado.displayName || usuarioLogado.email.split('@')[0];
                await registrarNotificacao(post.autorId, `<strong>${nome}</strong> comentou na sua crônica "<em>${post.titulo}</em>".`, `pages/comunidade.html`);
            }
        };
    }

    modal.style.display = 'flex';
}

window.fecharModalCronica = function () {
    const modal = document.getElementById('modal-cronica');
    if (modal) modal.style.display = 'none';
    cronicaAbertaId = null;
};