import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, onValue, update, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

let uidLogado = null;
let apelidoAtual = "";

// ==========================================
// 1. CONFIGURAÇÃO DE LOGIN E LOGOUT
// ==========================================
window.addEventListener('usuarioLogado', () => {
    uidLogado = idJogadorAtual;
    const user = auth.currentUser;
    
    // Configura foto e email
    document.getElementById('perfil-avatar').src = user.photoURL || 'https://via.placeholder.com/150';
    document.getElementById('perfil-email').textContent = user.email;
    document.getElementById('perfil-uid').textContent = `UID: ${uidLogado}`;
    
    document.getElementById('btn-logout').style.display = 'block';
    document.getElementById('btn-logout').onclick = () => {
        signOut(auth).then(() => window.location.href = '../index.html');
    };

    // Puxa o perfil customizado (Apelido e Bio)
    onValue(ref(db, `usuarios/${uidLogado}/perfil`), (snapshot) => {
        const dados = snapshot.val();
        if (dados) {
            apelidoAtual = dados.apelido || user.displayName;
            document.getElementById('perfil-nome').textContent = apelidoAtual;
            document.getElementById('perfil-apelido').value = apelidoAtual;
            document.getElementById('perfil-bio').value = dados.bio || "";
        } else {
            apelidoAtual = user.displayName;
            document.getElementById('perfil-nome').textContent = apelidoAtual;
        }
        
        // Depois de carregar o nome, carrega os dados do Firebase
        carregarEstatisticas();
        carregarAcervo();
    });
});

document.getElementById('btn-salvar-perfil')?.addEventListener('click', () => {
    if(!uidLogado) return;
    const novoApelido = document.getElementById('perfil-apelido').value.trim();
    const novaBio = document.getElementById('perfil-bio').value.trim();
    
    if(novoApelido.length < 3) { alert("Apelido muito curto."); return; }

    set(ref(db, `usuarios/${uidLogado}/perfil`), {
        apelido: novoApelido,
        bio: novaBio
    }).then(() => {
        document.getElementById('perfil-nome').textContent = novoApelido;
        apelidoAtual = novoApelido;
        alert("Perfil atualizado com sucesso!");
    });
});

// ==========================================
// 2. ABAS DO PERFIL
// ==========================================
window.mudarTabPerfil = function(idTab) {
    document.querySelectorAll('.tab-conteudo').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(idTab).classList.add('active');
    event.target.classList.add('active');
}

// ==========================================
// 3. CARREGAR ESTATÍSTICAS E ACERVO
// ==========================================
function carregarEstatisticas() {
    // Puxa os dados de todas as coleções da sala
    onValue(ref(db, `salas/${salaAtual}`), (snapshot) => {
        const dados = snapshot.val();
        if(!dados) return;

        let cronicas = 0;
        let monstros = 0;
        let armas = 0;
        let likes = 0;
        let listaFavoritos = [];

        // Conta Crônicas
        if(dados.cronicas) {
            Object.values(dados.cronicas).forEach(c => {
                const isMeu = c.autorId ? c.autorId === uidLogado : c.autor === apelidoAtual;
                if(isMeu) {
                    cronicas++;
                    likes += c.curtidas ? c.curtidas.length : 0;
                }
                if(c.curtidas && c.curtidas.includes(uidLogado)) {
                    listaFavoritos.push({ tipo: 'crônica', titulo: c.titulo, id: c.id });
                }
            });
        }

        // Conta Bestiário
        if(dados.monstros) {
            Object.values(dados.monstros).forEach(m => {
                const isMeu = m.autorId ? m.autorId === uidLogado : m.autor === apelidoAtual;
                if(isMeu) monstros++;
                if(m.curtidas && m.curtidas.includes(uidLogado)) {
                    listaFavoritos.push({ tipo: 'monstro', titulo: m.titulo, id: m.id });
                }
            });
        }

        // Conta Arsenal
        if(dados.armas) {
            Object.values(dados.armas).forEach(a => {
                const isMeu = a.autorId ? a.autorId === uidLogado : a.autor === apelidoAtual;
                if(isMeu) armas++;
                if(a.curtidas && a.curtidas.includes(uidLogado)) {
                    listaFavoritos.push({ tipo: 'arma', titulo: a.titulo, id: a.id });
                }
            });
        }

        document.getElementById('stat-cronicas').textContent = cronicas;
        document.getElementById('stat-monstros').textContent = monstros;
        document.getElementById('stat-armas').textContent = armas;
        document.getElementById('stat-likes').textContent = likes;

        // Preenche a aba de Favoritos
        const gridFav = document.getElementById('lista-favoritos');
        gridFav.innerHTML = listaFavoritos.length > 0 ? '' : '<p style="color:#888;">Nenhum item curtido ainda.</p>';
        listaFavoritos.forEach(fav => {
            gridFav.innerHTML += `
                <div class="mini-card">
                    <p style="color:var(--gold); font-size:0.7rem; text-transform:uppercase;">${fav.tipo}</p>
                    <h4>${fav.titulo}</h4>
                </div>
            `;
        });
    });
}

function carregarAcervo() {
    // 1. Carrega as fichas (Estante)
    const gridEstante = document.getElementById('lista-estante');
    onValue(ref(db, `salas/${salaAtual}/jogadores/${uidLogado}`), (snapshot) => {
        const ficha = snapshot.val();
        if(ficha) {
            gridEstante.innerHTML = `
                <a href="ficha.html" class="mini-card">
                    <h4>${ficha.nome || 'Sem Nome'}</h4>
                    <p>${ficha.espectro || 'Sem Espectro'} | Vol. ${ficha.volume || 1}</p>
                    <p style="color:var(--gold); margin-top:5px;">Voltar para a Mesa →</p>
                </a>
            `;
        } else {
            gridEstante.innerHTML = '<p style="color:#888;">Nenhum personagem nesta sala.</p>';
        }
    });

    // 2. Carrega as criações do usuário
    const gridCronicas = document.getElementById('lista-cronicas');
    const gridMonstros = document.getElementById('lista-monstros');

    onValue(ref(db, `salas/${salaAtual}/cronicas`), (snapshot) => {
        gridCronicas.innerHTML = '';
        const dados = snapshot.val();
        if(dados) {
            Object.values(dados).forEach(c => {
                const isMeu = c.autorId ? c.autorId === uidLogado : c.autor === apelidoAtual;
                if(isMeu) {
                    gridCronicas.innerHTML += `
                        <a href="comunidade.html" class="mini-card">
                            <h4>${c.titulo}</h4>
                            <p>❤️ ${c.curtidas ? c.curtidas.length : 0} Likes</p>
                        </a>
                    `;
                }
            });
        }
        if(gridCronicas.innerHTML === '') gridCronicas.innerHTML = '<p style="color:#888;">Nenhuma crônica escrita.</p>';
    });

    onValue(ref(db, `salas/${salaAtual}/monstros`), (snapshot) => {
        gridMonstros.innerHTML = '';
        const dados = snapshot.val();
        if(dados) {
            Object.values(dados).forEach(m => {
                const isMeu = m.autorId ? m.autorId === uidLogado : m.autor === apelidoAtual;
                if(isMeu) {
                    gridMonstros.innerHTML += `
                        <a href="monstros.html" class="mini-card">
                            <h4>${m.titulo}</h4>
                            <p>${m.nivel || 'Comum'} | PV: ${m.vida}</p>
                        </a>
                    `;
                }
            });
        }
        if(gridMonstros.innerHTML === '') gridMonstros.innerHTML = '<p style="color:#888;">Nenhum monstro registrado.</p>';
    });
}