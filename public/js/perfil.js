import { db, auth, salaAtual, uidPerfilVisitado } from './firebase.js';
import { ref, onValue, update, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const AVATAR_PADRAO = 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=150&q=80';

onAuthStateChanged(auth, (user) => {
    const targetUid = uidPerfilVisitado || (user ? user.uid : null);

    if (!targetUid) {
        document.getElementById('perfil-nome').textContent = "Faça login para ver seu perfil.";
        document.getElementById('perfil-bio').textContent = "Use o botão no topo da tela para entrar com o Google.";
        return;
    }

    const isMeuPerfil = user ? (targetUid === user.uid) : false;
    carregarPerfil(targetUid, isMeuPerfil, user);
});

function carregarPerfil(targetUid, isMeuPerfil, user) {
    const perfilRef = ref(db, `usuarios/${targetUid}/perfil`);

    // 1. Carrega Dados Básicos do Perfil
    onValue(perfilRef, async (snapshot) => {
        let dados = snapshot.val();

        if (isMeuPerfil && user) {
            if (!dados) {
                dados = {
                    apelido: user.displayName || "Arquivista",
                    bio: "Um novo Arquivista na Biblioteca.",
                    espectro: "padrao",
                    foto: user.photoURL || AVATAR_PADRAO
                };
                await set(perfilRef, dados);
            } else if (user.photoURL && dados.foto !== user.photoURL) {
                await update(perfilRef, { foto: user.photoURL });
            }

            document.getElementById('btn-editar-perfil').style.display = 'block';
            document.getElementById('btn-seguir').style.display = 'none';

            // Preenche modal de edição
            document.getElementById('edit-apelido').value = dados.apelido || '';
            document.getElementById('edit-bio').value = dados.bio || '';
            document.getElementById('edit-espectro').value = dados.espectro || 'padrao';

            document.getElementById('btn-editar-perfil').onclick = () => {
                document.getElementById('modal-editar-perfil').style.display = 'flex';
            };

            document.getElementById('btn-salvar-identidade').onclick = async () => {
                const novoApelido = document.getElementById('edit-apelido').value.trim();
                const novaBio = document.getElementById('edit-bio').value.trim();
                const novoEspectro = document.getElementById('edit-espectro').value;

                await update(perfilRef, {
                    apelido: novoApelido || user.displayName || "Arquivista",
                    bio: novaBio,
                    espectro: novoEspectro
                });
                document.getElementById('modal-editar-perfil').style.display = 'none';
            };
        } else {
            // Visitando perfil de outro jogador
            document.getElementById('btn-editar-perfil').style.display = 'none';
            const btnSeguir = document.getElementById('btn-seguir');
            btnSeguir.style.display = 'block';

            configurarBotaoSeguir(targetUid, user);
        }

        // Atualiza UI
        const nomeExibicao = dados?.apelido || "Arquivista Desconhecido";
        const bioExibicao = dados?.bio || "Sem juramento registrado.";
        const fotoExibicao = dados?.foto || (isMeuPerfil && user?.photoURL ? user.photoURL : AVATAR_PADRAO);

        document.getElementById('perfil-nome').textContent = nomeExibicao;
        document.getElementById('perfil-bio').textContent = `"${bioExibicao}"`;
        
        const avatarEl = document.getElementById('perfil-avatar');
        avatarEl.src = fotoExibicao;
        avatarEl.onerror = () => { avatarEl.src = AVATAR_PADRAO; };

        // Aplica tema do Espectro
        document.body.className = '';
        if (dados?.espectro && dados.espectro !== 'padrao') {
            document.body.classList.add(`espectro-${dados.espectro}`);
        }
    });

    // 2. Monitora Seguidores
    onValue(ref(db, `usuarios/${targetUid}/seguidores`), (snap) => {
        const seguidores = snap.val() || {};
        document.getElementById('qtd-seguidores').textContent = Object.keys(seguidores).length;
    });

    // 3. Carrega Criações, Selos e Acervo
    onValue(ref(db, `salas/${salaAtual}`), (snapshot) => {
        const dados = snapshot.val() || {};
        let contagem = { cronicas: 0, armas: 0, monstros: 0, habilidades: 0, likes: 0 };
        let obrasHTML = '';

        // Crônicas
        if (dados.cronicas) {
            Object.values(dados.cronicas).forEach(c => {
                if (c.autorId === targetUid) {
                    contagem.cronicas++;
                    contagem.likes += (c.curtidas?.length || 0);
                    obrasHTML += `<a href="comunidade.html" class="mini-card"><h4>🌍 ${c.titulo}</h4><p>Crônica • ❤️ ${c.curtidas?.length || 0}</p></a>`;
                }
            });
        }

        // Armas
        if (dados.armas) {
            Object.values(dados.armas).forEach(a => {
                if (a.autorId === targetUid) {
                    contagem.armas++;
                    contagem.likes += (a.curtidas?.length || 0);
                    obrasHTML += `<a href="armas.html" class="mini-card"><h4>🛡️ ${a.titulo}</h4><p>Arsenal • ${a.categoria || 'Arma'}</p></a>`;
                }
            });
        }

        // Monstros
        if (dados.monstros) {
            Object.values(dados.monstros).forEach(m => {
                if (m.autorId === targetUid) {
                    contagem.monstros++;
                    contagem.likes += (m.curtidas?.length || 0);
                    obrasHTML += `<a href="monstros.html" class="mini-card"><h4>👹 ${m.titulo}</h4><p>Bestiário • PV: ${m.vida}</p></a>`;
                }
            });
        }

        // Habilidades
        if (dados.habilidades) {
            Object.values(dados.habilidades).forEach(h => {
                if (h.autorId === targetUid) {
                    contagem.habilidades++;
                    contagem.likes += (h.curtidas?.length || 0);
                    obrasHTML += `<a href="habilidades.html" class="mini-card"><h4>✨ ${h.titulo}</h4><p>Grimório • ${h.tipo || 'Habilidade'}</p></a>`;
                }
            });
        }

        gerarSelos(contagem);

        const gridObras = document.getElementById('lista-obras-publicas');
        if (gridObras) {
            gridObras.innerHTML = obrasHTML || '<p style="color: #666; font-style: italic; grid-column: 1/-1;">Nenhuma obra pública registrada ainda.</p>';
        }

        // Estante Pública (Ficha)
        const gridEstante = document.getElementById('lista-estante-publica');
        if (gridEstante) {
            const ficha = dados.jogadores ? dados.jogadores[targetUid] : null;
            if (ficha) {
                gridEstante.innerHTML = `
                    <a href="ficha.html?id=${targetUid}" class="mini-card">
                        <h4>📜 ${ficha.nome || 'Sem Nome'}</h4>
                        <p>Espectro: ${(ficha.espectro || 'Nenhum').toUpperCase()} | Vol. ${ficha.volume || 1}</p>
                    </a>`;
            } else {
                gridEstante.innerHTML = '<p style="color: #666; font-style: italic; grid-column: 1/-1;">Nenhum personagem registrado na estante.</p>';
            }
        }
    });
}

function configurarBotaoSeguir(targetUid, currentUser) {
    const btnSeguir = document.getElementById('btn-seguir');
    if (!currentUser) {
        btnSeguir.textContent = "Entre para Seguir";
        btnSeguir.onclick = () => alert("Faça login com o Google no topo da página para seguir outros Arquivistas!");
        return;
    }

    const seguidorRef = ref(db, `usuarios/${targetUid}/seguidores/${currentUser.uid}`);
    onValue(seguidorRef, (snap) => {
        const jaSegue = snap.exists();
        btnSeguir.textContent = jaSegue ? "✓ Seguindo" : "+ Seguir Arquivista";
        btnSeguir.classList.toggle('seguindo', jaSegue);

        btnSeguir.onclick = async () => {
            await set(seguidorRef, jaSegue ? null : true);
        };
    });
}

function gerarSelos(c) {
    const div = document.getElementById('lista-selos');
    if (!div) return;

    div.innerHTML = '';
    let temSelo = false;

    if (c.cronicas >= 1) { div.innerHTML += `<span class="selo-item">📜 Primeiro Registro</span>`; temSelo = true; }
    if (c.cronicas >= 5) { div.innerHTML += `<span class="selo-item">✒️ Cronista Veterano</span>`; temSelo = true; }
    if (c.armas >= 1) { div.innerHTML += `<span class="selo-item">⚒️ Aprendiz da Forja</span>`; temSelo = true; }
    if (c.armas >= 5) { div.innerHTML += `<span class="selo-item">⚔️ Ferreiro da 5ª Avenida</span>`; temSelo = true; }
    if (c.monstros >= 1) { div.innerHTML += `<span class="selo-item">👁️ Observador de Sombras</span>`; temSelo = true; }
    if (c.monstros >= 5) { div.innerHTML += `<span class="selo-item">👹 Caçador de Anomalias</span>`; temSelo = true; }
    if (c.habilidades >= 3) { div.innerHTML += `<span class="selo-item">✨ Erudito do Ímpeto</span>`; temSelo = true; }
    if (c.likes >= 10) { div.innerHTML += `<span class="selo-item">🌟 Lenda da Biblioteca</span>`; temSelo = true; }

    if (!temSelo) {
        div.innerHTML = '<p style="color: #666; font-style: italic;">Nenhum selo conquistado ainda.</p>';
    }
}

window.mudarTabPerfil = function(event, idTab) {
    document.querySelectorAll('.tab-conteudo').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(idTab).classList.add('active');
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
};