// js/comunidade.js
import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, push, set, onValue, query, orderByChild } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { conectarInteracoesCard } from './interacoes.js';

const feedContainer = document.getElementById('feed-cronicas') || document.getElementById('lista-cronicas') || document.querySelector('.cronicas-grid');
const formCronica = document.getElementById('form-cronica') || document.querySelector('form');
const inputImagem = document.getElementById('cronica-imagem') || document.querySelector('input[type="file"]');

let imagemBase64Atual = '';

// Compressão leve da imagem para manter o Realtime Database rápido e leve no mobile
if (inputImagem) {
    inputImagem.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scale = Math.min(1, MAX_WIDTH / img.width);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                imagemBase64Atual = canvas.toDataURL('image/jpeg', 0.72);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Publicar nova crônica
if (formCronica) {
    formCronica.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return alert('Você precisa entrar com sua conta Google para publicar uma crônica.');

        const tituloEl = document.getElementById('cronica-titulo') || formCronica.querySelector('input[type="text"]');
        const conteudoEl = document.getElementById('cronica-texto') || formCronica.querySelector('textarea');
        const tagEl = document.getElementById('cronica-tag') || formCronica.querySelector('select');

        const titulo = tituloEl ? tituloEl.value.trim() : 'Registro sem Título';
        const conteudo = conteudoEl ? conteudoEl.value.trim() : '';
        const tag = tagEl ? tagEl.value : 'Relato';

        if (!conteudo) return alert('Escreva o conteúdo da sua crônica antes de publicar.');

        const btnSubmit = formCronica.querySelector('button[type="submit"]');
        if (btnSubmit) btnSubmit.disabled = true;

        try {
            const novaCronicaRef = push(ref(db, 'cronicas'));
            await set(novaCronicaRef, {
                titulo: titulo,
                conteudo: conteudo,
                tag: tag,
                imagem: imagemBase64Atual || null,
                autorUid: user.uid,
                autorNome: user.displayName || 'Viajante da 5ª Avenida',
                autorFoto: user.photoURL || '../assets/img/default-avatar.png',
                timestamp: Date.now()
            });

            formCronica.reset();
            imagemBase64Atual = '';
        } catch (err) {
            console.error('Erro ao publicar crônica:', err);
            alert('Falha ao registrar crônica na Biblioteca.');
        } finally {
            if (btnSubmit) btnSubmit.disabled = false;
        }
    });
}

// Carregar e renderizar crônicas em tempo real
function carregarCronicas() {
    if (!feedContainer) return;

    const cronicasQuery = query(ref(db, 'cronicas'), orderByChild('timestamp'));
    onValue(cronicasQuery, (snapshot) => {
        const dados = snapshot.val();
        if (!dados) {
            feedContainer.innerHTML = '<p style="text-align:center; color:#888; padding:2rem;">Nenhuma crônica registrada ainda. Seja o primeiro a escrever na história da Biblioteca.</p>';
            return;
        }

        const lista = Object.entries(dados)
            .map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => b.timestamp - a.timestamp);

        feedContainer.innerHTML = '';

        lista.forEach((post) => {
            const card = document.createElement('article');
            card.className = 'cronica-card card-b5a';
            card.style.cssText = 'background:#16161c; border:1px solid rgba(212,175,55,0.28); border-radius:8px; padding:18px; margin-bottom:18px;';

            const dataFormatada = new Date(post.timestamp).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', year: 'numeric'
            });

            card.innerHTML = `
                <div class="cronica-header" style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
                    <a href="perfil.html?uid=${post.autorUid}" style="display:flex; align-items:center; gap:10px; text-decoration:none; color:#d4af37;">
                        <img src="${post.autorFoto || ''}" alt="${post.autorNome}" onerror="this.style.display='none'" style="width:36px; height:36px; border-radius:50%; object-fit:cover; border:1px solid #d4af37;">
                        <div>
                            <strong style="display:block; font-size:0.95rem;">${post.autorNome}</strong>
                            <small style="color:#888; font-size:0.75rem;">${dataFormatada}</small>
                        </div>
                    </a>
                    ${post.tag ? `<span class="cronica-tag" style="background:rgba(212,175,55,0.15); color:#d4af37; border:1px solid rgba(212,175,55,0.4); padding:3px 10px; border-radius:12px; font-size:0.75rem;">${post.tag}</span>` : ''}
                </div>
                <h3 style="color:#f5f5f5; margin:0 0 8px 0; font-size:1.2rem;">${escaparHTML(post.titulo)}</h3>
                <p style="color:#d0d0d0; line-height:1.6; white-space:pre-line; font-size:0.92rem; margin:0;">${escaparHTML(post.conteudo)}</p>
                ${post.imagem ? `<img src="${post.imagem}" alt="Ilustração da crônica" style="width:100%; max-height:420px; object-fit:cover; border-radius:6px; margin-top:12px; border:1px solid rgba(255,255,255,0.1);">` : ''}
                <div id="interacoes-${post.id}"></div>
            `;

            feedContainer.appendChild(card);

            // Conecta reações e comentários ao vivo
            const slotInteracoes = document.getElementById(`interacoes-${post.id}`);
            conectarInteracoesCard(slotInteracoes, post.id, post.autorUid, `"${post.titulo}"`);
        });
    });
}

function escaparHTML(str = '') {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

carregarCronicas();