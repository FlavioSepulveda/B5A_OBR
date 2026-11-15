// js/perfil.js
import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, get, set, remove, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { enviarNotificacao } from './notificacoes.js';

const params = new URLSearchParams(window.location.search);
let uidPerfil = params.get('uid');

const nomeEl = document.getElementById('perfil-nome');
const fotoEl = document.getElementById('perfil-foto');
const bioEl = document.getElementById('perfil-bio');
const btnSeguir = document.getElementById('btn-seguir');
const cntSeguidores = document.getElementById('perfil-seguidores-count');
const cntSeguindo = document.getElementById('perfil-seguindo-count');
const listaPersonagensEl = document.getElementById('perfil-personagens');

onAuthStateChanged(auth, async (user) => {
    // Se não há ?uid= na URL, carrega o perfil do próprio usuário logado
    if (!uidPerfil && user) {
        uidPerfil = user.uid;
    }

    if (!uidPerfil) {
        if (nomeEl) nomeEl.textContent = 'Faça login para visualizar seu perfil.';
        return;
    }

    carregarDadosPerfil(uidPerfil, user);
    carregarSeguidores(uidPerfil, user);
    carregarVitrinePersonagens(uidPerfil);
});

async function carregarDadosPerfil(uid, userLogado) {
    const userRef = ref(db, `usuarios/${uid}`);
    const snap = await get(userRef);
    const dados = snap.val() || {};

    // Se for o próprio usuário e ainda não houver registro no nó /usuarios, cria automaticamente
    if (userLogado && userLogado.uid === uid && !snap.exists()) {
        const perfilInicial = {
            nome: userLogado.displayName || 'Viajante da Biblioteca',
            foto: userLogado.photoURL || '',
            bio: 'Explorador dos mistérios da 5ª Avenida.'
        };
        await set(userRef, perfilInicial);
        Object.assign(dados, perfilInicial);
    }

    if (nomeEl) nomeEl.textContent = dados.nome || 'Viajante Desconhecido';
    if (fotoEl && dados.foto) fotoEl.src = dados.foto;
    if (bioEl) bioEl.textContent = dados.bio || 'Sem biografia registrada.';
}

function carregarSeguidores(uidAlvo, userLogado) {
    const seguidoresRef = ref(db, `seguidores/${uidAlvo}`);
    const seguindoRef = ref(db, `seguindo/${uidAlvo}`);

    onValue(seguidoresRef, (snap) => {
        const lista = snap.val() || {};
        const total = Object.keys(lista).length;
        if (cntSeguidores) cntSeguidores.textContent = total;

        if (btnSeguir) {
            if (!userLogado || userLogado.uid === uidAlvo) {
                btnSeguir.style.display = 'none';
            } else {
                btnSeguir.style.display = 'inline-block';
                const jaSegue = Boolean(lista[userLogado.uid]);
                btnSeguir.textContent = jaSegue ? '✓ Seguindo' : '+ Seguir Viajante';
                btnSeguir.classList.toggle('seguindo', jaSegue);

                btnSeguir.onclick = async () => {
                    const relSeguidor = ref(db, `seguidores/${uidAlvo}/${userLogado.uid}`);
                    const relSeguindo = ref(db, `seguindo/${userLogado.uid}/${uidAlvo}`);

                    if (jaSegue) {
                        await remove(relSeguidor);
                        await remove(relSeguindo);
                    } else {
                        await set(relSeguidor, true);
                        await set(relSeguindo, true);
                        enviarNotificacao(
                            uidAlvo,
                            'seguidor',
                            'começou a seguir seus registros na Biblioteca.',
                            `../pages/perfil.html?uid=${userLogado.uid}`
                        );
                    }
                };
            }
        }
    });

    onValue(seguindoRef, (snap) => {
        const total = Object.keys(snap.val() || {}).length;
        if (cntSeguindo) cntSeguindo.textContent = total;
    });
}

// Vitrine social: exibe os personagens criados pelo usuário visitado
function carregarVitrinePersonagens(uid) {
    if (!listaPersonagensEl) return;

    const fichasRef = ref(db, `fichas/${uid}`);
    onValue(fichasRef, (snap) => {
        const dados = snap.val();
        if (!dados) {
            listaPersonagensEl.innerHTML = '<p style="color:#777; font-size:0.85rem;">Nenhum personagem público na estante.</p>';
            return;
        }

        const fichas = Object.entries(dados).map(([id, val]) => ({ id, ...val }));
        listaPersonagensEl.innerHTML = fichas.map(f => `
            <div style="background:#1a1a22; border:1px solid rgba(212,175,55,0.3); border-radius:6px; padding:12px;">
                <strong style="color:#d4af37; display:block; font-size:0.95rem;">${f.nome || 'Sem Nome'}</strong>
                <span style="color:#aaa; font-size:0.8rem;">${f.caminho || 'Caminho Oculto'} • ${f.espectro || 'Espectro Neutro'}</span>
            </div>
        `).join('');
    });
}