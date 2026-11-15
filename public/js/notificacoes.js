import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { ref, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

let usuarioAtual = null;

function inicializarNotificacoes() {
    // Aponta para .nav-user ou .top-nav conforme a estrutura das suas páginas
    const navContainer = document.querySelector('.nav-user') || document.querySelector('.top-nav');
    if (!navContainer || document.getElementById('notif-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'notif-wrapper';
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.marginRight = '10px';

    wrapper.innerHTML = `
        <button id="btn-sino-notif" title="Notificações" style="background: transparent; border: 1px solid var(--border, #2a3142); color: var(--text, #e2e8f0); cursor: pointer; position: relative; font-size: 1.1rem; padding: 6px 10px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: 0.2s;">
            🔔
            <span id="badge-notif" style="display: none; position: absolute; top: -6px; right: -6px; background: #ef4444; color: #fff; font-size: 0.7rem; font-weight: bold; padding: 2px 6px; border-radius: 999px; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">0</span>
        </button>

        <div id="dropdown-notif" style="display: none; position: absolute; right: 0; top: 44px; width: 320px; max-height: 400px; overflow-y: auto; background: #131823; border: 1px solid #2a3142; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.85); z-index: 9999; padding: 12px; color: #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2a3142; padding-bottom: 8px; margin-bottom: 10px;">
                <strong style="font-size: 0.9rem; color: #c5a059;">Notificações</strong>
                <button id="btn-limpar-notifs" style="background: none; border: none; color: #94a3b8; font-size: 0.75rem; cursor: pointer; text-decoration: underline;">Limpar tudo</button>
            </div>
            <div id="lista-notificacoes" style="display: flex; flex-direction: column; gap: 8px; font-size: 0.85rem;">
                <p style="color: #64748b; text-align: center; margin: 15px 0;">Nenhuma notificação por enquanto.</p>
            </div>
        </div>
    `;

    navContainer.prepend(wrapper);

    const btnSino = document.getElementById('btn-sino-notif');
    const dropdown = document.getElementById('dropdown-notif');
    const btnLimpar = document.getElementById('btn-limpar-notifs');

    btnSino.addEventListener('click', (e) => {
        e.stopPropagation();
        const aberto = dropdown.style.display === 'block';
        dropdown.style.display = aberto ? 'none' : 'block';

        if (!aberto && usuarioAtual) {
            marcarTodasComoLidas(usuarioAtual.uid);
        }
    });

    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    btnLimpar.addEventListener('click', async () => {
        if (!usuarioAtual) return;
        await remove(ref(db, `notificacoes/${usuarioAtual.uid}`));
    });
}

function escutarNotificacoes(uid) {
    const notifRef = ref(db, `notificacoes/${uid}`);
    const listaEl = document.getElementById('lista-notificacoes');
    const badgeEl = document.getElementById('badge-notif');

    onValue(notifRef, (snapshot) => {
        if (!listaEl || !badgeEl) return;

        if (!snapshot.exists()) {
            listaEl.innerHTML = `<p style="color: #64748b; text-align: center; margin: 15px 0;">Nenhuma notificação por enquanto.</p>`;
            badgeEl.style.display = 'none';
            return;
        }

        const dados = snapshot.val();
        const itens = Object.entries(dados)
            .map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        const naoLidas = itens.filter(n => !n.lida).length;

        if (naoLidas > 0) {
            badgeEl.textContent = naoLidas > 9 ? '9+' : naoLidas;
            badgeEl.style.display = 'inline-block';
        } else {
            badgeEl.style.display = 'none';
        }

        listaEl.innerHTML = itens.map(n => {
            const dataFormatada = n.timestamp ? new Date(n.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
            const bgDestaque = n.lida ? 'rgba(255,255,255,0.03)' : 'rgba(197, 160, 89, 0.14)';
            return `
                <a href="${n.link || '#'}" style="display: block; text-decoration: none; color: #e2e8f0; background: ${bgDestaque}; padding: 8px 10px; border-radius: 6px; border-left: 3px solid ${n.lida ? '#475569' : '#c5a059'};">
                    <div style="line-height: 1.35;">${n.mensagem}</div>
                    <small style="color: #64748b; font-size: 0.7rem;">${dataFormatada}</small>
                </a>
            `;
        }).join('');
    });
}

async function marcarTodasComoLidas(uid) {
    const notifRef = ref(db, `notificacoes/${uid}`);
    onValue(notifRef, async (snapshot) => {
        if (!snapshot.exists()) return;
        const updates = {};
        snapshot.forEach(child => {
            if (!child.val().lida) {
                updates[`${child.key}/lida`] = true;
            }
        });
        if (Object.keys(updates).length > 0) {
            await update(notifRef, updates);
        }
    }, { onlyOnce: true });
}

onAuthStateChanged(auth, (user) => {
    usuarioAtual = user;
    if (user) {
        inicializarNotificacoes();
        escutarNotificacoes(user.uid);
    } else {
        const wrapper = document.getElementById('notif-wrapper');
        if (wrapper) wrapper.remove();
    }
});