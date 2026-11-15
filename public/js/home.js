// js/home.js
import { db } from './firebase.js';
import { ref, onValue, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { conectarInteracoesCard } from './interacoes.js';

const feedHome = document.getElementById('feed-home') || document.getElementById('feed-unificado') || document.querySelector('.feed-container');

function carregarFeedHome() {
    if (!feedHome) return;

    const cronicasRef = query(ref(db, 'cronicas'), limitToLast(10));
    onValue(cronicasRef, (snapshot) => {
        const dados = snapshot.val();
        if (!dados) {
            feedHome.innerHTML = '<p style="text-align:center; color:#888;">Nenhuma atividade recente na Biblioteca.</p>';
            return;
        }

        const recentes = Object.entries(dados)
            .map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => b.timestamp - a.timestamp);

        feedHome.innerHTML = '';

        recentes.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'feed-item card-b5a';
            card.style.cssText = 'background:#16161c; border:1px solid rgba(212,175,55,0.25); border-radius:8px; padding:16px; margin-bottom:16px;';

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px; flex-wrap:wrap;">
                    <a href="pages/perfil.html?uid=${item.autorUid}" style="color:#d4af37; font-weight:bold; text-decoration:none; font-size:0.9rem;">
                        ✒️ ${item.autorNome}
                    </a>
                    <span style="font-size:0.75rem; color:#888;">${new Date(item.timestamp).toLocaleDateString('pt-BR')}</span>
                </div>
                <h4 style="margin:0 0 6px 0; color:#fff; font-size:1.05rem;">${item.titulo}</h4>
                <p style="margin:0; color:#ccc; font-size:0.88rem; line-height:1.5;">
                    ${item.conteudo.length > 220 ? item.conteudo.substring(0, 220) + '...' : item.conteudo}
                </p>
                <div id="home-interacoes-${item.id}"></div>
            `;

            feedHome.appendChild(card);

            const slot = document.getElementById(`home-interacoes-${item.id}`);
            conectarInteracoesCard(slot, item.id, item.autorUid, `"${item.titulo}"`);
        });
    });
}

carregarFeedHome();