import { db, auth, idJogadorAtual, salaAtual, uidPerfilVisitado } from './firebase.js';
import { ref, onValue, update, get } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// A MÁGICA ACONTECE AQUI: O código espera o Firebase avisar quem é o usuário
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Se o usuário estiver logado, define quem é o dono do perfil
        const targetUid = uidPerfilVisitado || user.uid;
        const isMeuPerfil = (targetUid === user.uid);
        
        // Inicia o carregamento do perfil
        carregarPerfil(targetUid, isMeuPerfil, user);
        
    } else {
        // Se não estiver logado e não estiver visitando o perfil de outra pessoa
        if (!uidPerfilVisitado) {
            document.getElementById('perfil-nome').textContent = "Faça login para ver seu perfil.";
        } else {
            document.getElementById('perfil-nome').textContent = "Faça login para ver perfis.";
        }
    }
});

function carregarPerfil(targetUid, isMeuPerfil, user) {
    // 1. Carrega Dados Básicos do Perfil
    onValue(ref(db, `usuarios/${targetUid}/perfil`), async (snapshot) => {
        let dados = snapshot.val();

        if (isMeuPerfil) {
            if(!dados) {
                dados = { apelido: user.displayName, bio: "Um novo Arquivista.", espectro: "padrao" };
            }
            const avatar = document.getElementById('perfil-avatar');
            if (avatar) avatar.src = user.photoURL || 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=150&q=80';
            
            const btnEditar = document.getElementById('btn-editar-perfil');
            const btnSeguir = document.getElementById('btn-seguir');
            if (btnEditar) btnEditar.style.display = 'block';
            if (btnSeguir) btnSeguir.style.display = 'none';
            
            // Configura o modal de edição
            if (document.getElementById('edit-apelido')) document.getElementById('edit-apelido').value = dados.apelido || '';
            if (document.getElementById('edit-bio')) document.getElementById('edit-bio').value = dados.bio || "";
            if (document.getElementById('edit-espectro')) document.getElementById('edit-espectro').value = dados.espectro || "padrao";
            
            const btnEditarPerfil = document.getElementById('btn-editar-perfil');
            if (btnEditarPerfil) {
                btnEditarPerfil.onclick = () => {
                    document.getElementById('modal-editar-perfil').style.display = 'block';
                };
            }
            
            const btnSalvar = document.getElementById('btn-salvar-identidade');
            if (btnSalvar) {
                btnSalvar.onclick = async () => {
                    await update(ref(db, `usuarios/${targetUid}/perfil`), {
                        apelido: document.getElementById('edit-apelido').value,
                        bio: document.getElementById('edit-bio').value,
                        espectro: document.getElementById('edit-espectro').value
                    });
                    document.getElementById('modal-editar-perfil').style.display = 'none';
                    window.location.reload();
                };
            }
        } else {
            const btnEditar = document.getElementById('btn-editar-perfil');
            const btnSeguir = document.getElementById('btn-seguir');
            if (btnEditar) btnEditar.style.display = 'none';
            if (btnSeguir) btnSeguir.style.display = 'block';
            
            const avatar = document.getElementById('perfil-avatar');
            if (avatar) avatar.src = 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=150&q=80';
        }

        // Aplica os dados na tela
        if (document.getElementById('perfil-nome')) document.getElementById('perfil-nome').textContent = dados.apelido || "Arquivista";
        if (document.getElementById('perfil-bio')) document.getElementById('perfil-bio').textContent = `"${dados.bio || 'Sem juramento registrado.'}"`;
        
        if(dados.espectro && dados.espectro !== 'padrao') {
            document.body.classList.add(`espectro-${dados.espectro}`);
        }
    });

    // 2. Carrega os dados de criações para gerar os SELOS e o Acervo
    let contagem = { cronicas: 0, armas: 0, monstros: 0, likes: 0 };

    onValue(ref(db, `salas/${salaAtual}`), (snapshot) => {
        const dados = snapshot.val();
        if(!dados) return;

        if(dados.cronicas) Object.values(dados.cronicas).forEach(c => { if(c.autorId === targetUid || c.autor === targetUid) { contagem.cronicas++; contagem.likes += (c.curtidas?.length || 0); } });
        if(dados.armas) Object.values(dados.armas).forEach(a => { if(a.autorId === targetUid) contagem.armas++; });
        if(dados.monstros) Object.values(dados.monstros).forEach(m => { if(m.autorId === targetUid) contagem.monstros++; });

        gerarSelos(contagem);
        carregarAcervo(targetUid);
    });
}

function gerarSelos(c) {
    const div = document.getElementById('lista-selos');
    if(!div) return;
    
    div.innerHTML = '';
    let temSelo = false;

    if(c.cronicas >= 1) { div.innerHTML += `<span class="selo-item">📜 Primeiro Registro</span>`; temSelo = true; }
    if(c.cronicas >= 5) { div.innerHTML += `<span class="selo-item">✒️ Cronista Veterano</span>`; temSelo = true; }
    if(c.armas >= 5) { div.innerHTML += `<span class="selo-item">⚒️ Ferreiro da 5ª Avenida</span>`; temSelo = true; }
    if(c.monstros >= 5) { div.innerHTML += `<span class="selo-item">👹 Caçador de Anomalias</span>`; temSelo = true; }
    if(c.likes >= 10) { div.innerHTML += `<span class="selo-item">🌟 Lenda da Biblioteca</span>`; temSelo = true; }

    if(!temSelo) div.innerHTML = '<p style="color: #666; font-style: italic;">Nenhum selo conquistado ainda.</p>';
}

function carregarAcervo(uid) {
    // Puxa as fichas
    const gridEstante = document.getElementById('lista-estante-publica');
    if (gridEstante) {
        onValue(ref(db, `salas/${salaAtual}/jogadores/${uid}`), (snap) => {
            const ficha = snap.val();
            if(ficha) {
                gridEstante.innerHTML = `
                    <div class="mini-card">
                        <h4>${ficha.nome || 'Sem Nome'}</h4>
                        <p>${ficha.espectro || 'Sem Espectro'} | Vol. ${ficha.volume || 1}</p>
                    </div>`;
            } else {
                gridEstante.innerHTML = '<p style="color: #666; font-style: italic;">Nenhum personagem nesta sala.</p>';
            }
        });
    }

    // Puxa as criações
    const gridObras = document.getElementById('lista-obras-publicas');
    if (gridObras) {
        onValue(ref(db, `salas/${salaAtual}/monstros`), (snap) => {
            gridObras.innerHTML = '';
            const dados = snap.val();
            if(dados) {
                Object.values(dados).forEach(m => {
                    if(m.autorId === uid) {
                        gridObras.innerHTML += `<a href="monstros.html" class="mini-card"><h4>${m.titulo}</h4><p>Bestiário | PV: ${m.vida}</p></a>`;
                    }
                });
            }
            if(gridObras.innerHTML === '') gridObras.innerHTML = '<p style="color: #666; font-style: italic;">Nenhuma obra pública.</p>';
        });
    }
}

window.mudarTabPerfil = function(idTab) {
    document.querySelectorAll('.tab-conteudo').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(idTab).classList.add('active');
    if(event && event.target) event.target.classList.add('active');
}