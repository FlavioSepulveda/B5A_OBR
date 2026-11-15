// js/interacoes.js
import { auth, db } from './firebase.js';
import { ref, push, set, remove, onValue, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { enviarNotificacao } from './notificacoes.js';

const REACOES_CONFIG = [
    { id: 'impeto', icone: '⚡', label: 'Ímpeto' },
    { id: 'misterio', icone: '👁️', label: 'Mistério' },
    { id: 'aplauso', icone: '🕯️', label: 'Honra' }
];

// Renderiza e conecta a barra social dentro de um card de postagem
export function conectarInteracoesCard(containerEl, postId, autorUid, tituloPost = 'sua crônica') {
    if (!containerEl) return;

    containerEl.innerHTML = `
        <div class="b5a-social-bar">
            <div class="b5a-reacoes-grupo">
                ${REACOES_CONFIG.map(r => `
                    <button class="b5a-btn-reacao" data-tipo="${r.id}" title="${r.label}">
                        <span class="icone">${r.icone}</span>
                        <span class="contador" id="cnt-${postId}-${r.id}">0</span>
                    </button>
                `).join('')}
            </div>
            <button class="b5a-btn-comentar" id="toggle-com-${postId}">
                💬 <span id="cnt-com-${postId}">0</span> Comentários
            </button>
        </div>
        <div class="b5a-comentarios-box" id="box-com-${postId}" style="display:none;">
            <div class="b5a-comentarios-lista" id="lista-com-${postId}"></div>
            <form class="b5a-comentario-form" id="form-com-${postId}">
                <input type="text" placeholder="Escreva um comentário..." maxlength="300" required />
                <button type="submit">Enviar</button>
            </form>
        </div>
    `;

    // 1. Escutar Reações
    const reacoesRef = ref(db, `interacoes/${postId}/reacoes`);
    onValue(reacoesRef, (snap) => {
        const dados = snap.val() || {};
        const uidAtual = auth.currentUser?.uid;

        REACOES_CONFIG.forEach(r => {
            const usuariosTipo = dados[r.id] || {};
            const total = Object.keys(usuariosTipo).length;
            const btn = containerEl.querySelector(`.b5a-btn-reacao[data-tipo="${r.id}"]`);
            const cnt = document.getElementById(`cnt-${postId}-${r.id}`);
            
            if (cnt) cnt.textContent = total;
            if (btn) {
                if (uidAtual && usuariosTipo[uidAtual]) btn.classList.add('ativo');
                else btn.classList.remove('ativo');
            }
        });
    });

    // Clique nas Reações
    containerEl.querySelectorAll('.b5a-btn-reacao').forEach(btn => {
        btn.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) return alert('Faça login para interagir com a comunidade.');

            const tipo = btn.getAttribute('data-tipo');
            const userReacaoRef = ref(db, `interacoes/${postId}/reacoes/${tipo}/${user.uid}`);
            const snap = await get(userReacaoRef);

            if (snap.exists()) {
                await remove(userReacaoRef);
            } else {
                await set(userReacaoRef, true);
                const label = REACOES_CONFIG.find(r => r.id === tipo)?.label || 'reagiu a';
                enviarNotificacao(autorUid, 'reacao', `marcou "${label}" em ${tituloPost}.`, '../pages/comunidade.html');
            }
        });
    });

    // 2. Toggle Caixa de Comentários
    const toggleBtn = document.getElementById(`toggle-com-${postId}`);
    const boxCom = document.getElementById(`box-com-${postId}`);
    toggleBtn.addEventListener('click', () => {
        boxCom.style.display = boxCom.style.display === 'none' ? 'block' : 'none';
    });

    // 3. Escutar Comentários
    const comRef = ref(db, `interacoes/${postId}/comentarios`);
    onValue(comRef, (snap) => {
        const dados = snap.val() || {};
        const lista = Object.entries(dados)
            .map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => a.timestamp - b.timestamp);

        const cntCom = document.getElementById(`cnt-com-${postId}`);
        const listaEl = document.getElementById(`lista-com-${postId}`);
        if (cntCom) cntCom.textContent = lista.length;

        if (listaEl) {
            listaEl.innerHTML = lista.length === 0 
                ? '<p class="b5a-sem-comentarios">Nenhum registro ainda. Seja o primeiro a comentar.</p>'
                : lista.map(c => `
                    <div class="b5a-comentario-item">
                        <div class="b5a-comentario-topo">
                            <a href="../pages/perfil.html?uid=${c.autorUid}" class="b5a-comentario-autor">${c.autorNome}</a>
                            <span class="b5a-comentario-data">${new Date(c.timestamp).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <p class="b5a-comentario-texto">${escaparHTML(c.texto)}</p>
                    </div>
                `).join('');
        }
    });

    // 4. Enviar Novo Comentário
    const form = document.getElementById(`form-com-${postId}`);
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return alert('Faça login para comentar.');

        const input = form.querySelector('input');
        const texto = input.value.trim();
        if (!texto) return;

        input.disabled = true;
        await push(comRef, {
            autorUid: user.uid,
            autorNome: user.displayName || 'Viajante',
            texto: texto,
            timestamp: Date.now()
        });

        enviarNotificacao(autorUid, 'comentario', `comentou em ${tituloPost}: "${texto.substring(0, 40)}..."`, '../pages/comunidade.html');
        input.value = '';
        input.disabled = false;
        input.focus();
    });
}

function escaparHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}