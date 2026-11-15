// js/notificacoes.js
import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, push, set, onValue, update, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Função global para disparar notificações de qualquer página
export async function enviarNotificacao(destinoUid, tipo, mensagem, link = '../index.html') {
    const user = auth.currentUser;
    if (!user || !destinoUid || user.uid === destinoUid) return; // Não notifica a si mesmo

    const notifRef = push(ref(db, `notificacoes/${destinoUid}`));
    await set(notifRef, {
        remetenteUid: user.uid,
        remetenteNome: user.displayName || 'Viajante Anônimo',
        remetenteFoto: user.photoURL || '',
        tipo: tipo, // 'reacao', 'comentario', 'seguidor', 'mesa'
        mensagem: mensagem,
        link: link,
        lida: false,
        timestamp: Date.now()
    });
}

// Injeção da UI do Sino no Header
function inicializarSinoUI(uid) {
    const navContainer = document.querySelector('header nav') || document.querySelector('.nav-links') || document.querySelector('header');
    if (!navContainer || document.getElementById('b5a-notif-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'b5a-notif-wrapper';
    wrapper.className = 'b5a-notif-wrapper';
    wrapper.innerHTML = `
        <button id="b5a-notif-btn" class="b5a-notif-btn" aria-label="Notificações" title="Notificações">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span id="b5a-notif-badge" class="b5a-notif-badge" style="display:none;">0</span>
        </button>
        <div id="b5a-notif-dropdown" class="b5a-notif-dropdown">
            <div class="b5a-notif-header">
                <span>Ecos da Biblioteca</span>
                <button id="b5a-marcar-lidas" class="b5a-btn-limpar">Marcar lidas</button>
            </div>
            <div id="b5a-notif-lista" class="b5a-notif-lista">
                <p class="b5a-notif-vazio">Nenhum eco recente...</p>
            </div>
        </div>
    `;

    navContainer.appendChild(wrapper);

    const btn = document.getElementById('b5a-notif-btn');
    const dropdown = document.getElementById('b5a-notif-dropdown');
    const badge = document.getElementById('b5a-notif-badge');
    const lista = document.getElementById('b5a-notif-lista');
    const btnMarcarLidas = document.getElementById('b5a-marcar-lidas');

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('ativo');
    });

    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) dropdown.classList.remove('ativo');
    });

    // Escutar notificações em tempo real
    const notifQuery = query(ref(db, `notificacoes/${uid}`), limitToLast(20));
    onValue(notifQuery, (snapshot) => {
        const dados = snapshot.val();
        if (!dados) {
            badge.style.display = 'none';
            lista.innerHTML = '<p class="b5a-notif-vazio">Nenhum eco recente...</p>';
            return;
        }

        const itens = Object.entries(dados)
            .map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => b.timestamp - a.timestamp);

        const naoLidas = itens.filter(i => !i.lida);
        if (naoLidas.length > 0) {
            badge.textContent = naoLidas.length > 9 ? '9+' : naoLidas.length;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }

        lista.innerHTML = itens.map(item => `
            <a href="${item.link}" class="b5a-notif-item ${item.lida ? '' : 'nao-lida'}" data-id="${item.id}">
                <div class="b5a-notif-texto">
                    <strong>${item.remetenteNome}</strong> ${item.mensagem}
                    <small>${formatarTempoRelativo(item.timestamp)}</small>
                </div>
            </a>
        `).join('');

        // Marcar individualmente ao clicar
        lista.querySelectorAll('.b5a-notif-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.getAttribute('data-id');
                update(ref(db, `notificacoes/${uid}/${id}`), { lida: true });
            });
        });

        btnMarcarLidas.onclick = () => {
            const updates = {};
            naoLidas.forEach(n => {
                updates[`notificacoes/${uid}/${n.id}/lida`] = true;
            });
            if (Object.keys(updates).length > 0) update(ref(db), updates);
        };
    });
}

function formatarTempoRelativo(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'agora mesmo';
    if (diff < 3600) return `há ${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
    return `há ${Math.floor(diff / 86400)}d`;
}

onAuthStateChanged(auth, (user) => {
    if (user) inicializarSinoUI(user.uid);
});