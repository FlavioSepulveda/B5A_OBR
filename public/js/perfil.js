import { db, auth, idJogadorAtual, salaAtual, uidPerfilVisitado } from './firebase.js';
import { ref, onValue, update, get } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const targetUid = uidPerfilVisitado || idJogadorAtual;
const isMeuPerfil = (targetUid === idJogadorAtual);

window.addEventListener('usuarioLogado', async () => {
    if(!targetUid) {
        document.getElementById('perfil-nome').textContent = "Faça login para ver o perfil.";
        return;
    }

    // 1. Carrega Dados Básicos do Perfil
    onValue(ref(db, `usuarios/${targetUid}/perfil`), async (snapshot) => {
        let dados = snapshot.val();
        const user = auth.currentUser;

        // Se for meu perfil e não tiver dados, usa os do Google
        if (isMeuPerfil) {
            if(!dados) {
                dados = { apelido: user.displayName, bio: "Um novo Arquivista.", espectro: "padrao" };
            }
            document.getElementById('perfil-avatar').src = user.photoURL || 'https://via.placeholder.com/150';
            document.getElementById('btn-editar-perfil').style.display = 'block';
            document.getElementById('btn-seguir').style.display = 'none';
            
            // Configura o modal de edição
            document.getElementById('edit-apelido').value = dados.apelido;
            document.getElementById('edit-bio').value = dados.bio || "";
            document.getElementById('edit-espectro').value = dados.espectro || "padrao";
            
            document.getElementById('btn-editar-perfil').onclick = () => {
                document.getElementById('modal-editar-perfil').style.display = 'block';
            };
            
            document.getElementById('btn-salvar-identidade').onclick = async () => {
                await update(ref(db, `usuarios/${targetUid}/perfil`), {
                    apelido: document.getElementById('edit-apelido').value,
                    bio: document.getElementById('edit-bio').value,
                    espectro: document.getElementById('edit-espectro').value
                });
                document.getElementById('modal-editar-perfil').style.display = 'none';
                window.location.reload();
            };
        } else {
            document.getElementById('btn-editar-perfil').style.display = 'none';
            document.getElementById('btn-seguir').style.display = 'block';
            document.getElementById('perfil-avatar').src = 'https://via.placeholder.com/150'; // Futuro: puxar do Firebase
        }

        document.getElementById('perfil-nome').textContent = dados.apelido || "Arquivista";
        document.getElementById('perfil-bio').textContent = `"${dados.bio || 'Sem juramento registrado.'}"`;
        
        if(dados.espectro && dados.espectro !== 'padrao') {
            document.body.classList.add(`espectro-${dados.espectro}`);
        }
    });

    // 2. Carrega os dados de criações para gerar os SELOS
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
});

function gerarSelos(c) {
    const div = document.getElementById('lista-selos');
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
    onValue(ref(db, `salas/${salaAtual}/jogadores/${uid}`), (snap) => {
        const ficha = snap.val();
        if(ficha) {
            gridEstante.innerHTML = `
                <div class="mini-card">
                    <h4>${ficha.nome}</h4>
                    <p>${ficha.espectro || 'Sem Espectro'} | Vol. ${ficha.volume}</p>
                </div>`;
        } else {
            gridEstante.innerHTML = '<p style="color: #666; font-style: italic;">Nenhum personagem nesta sala.</p>';
        }
    });

    // Puxa as criações
    const gridObras = document.getElementById('lista-obras-publicas');
    onValue(ref(db, `salas/${salaAtual}/monstros`), (snap) => {
        gridObras.innerHTML = '';
        const dados = snap.val();
        if(dados) {
            Object.values(dados).forEach(m => {
                if(m.autorId === uid) gridObras.innerHTML += `<a href="monstros.html" class="mini-card"><h4>${m.titulo}</h4><p>Bestiário | PV: ${m.vida}</p></a>`;
            });
        }
        if(gridObras.innerHTML === '') gridObras.innerHTML = '<p style="color: #666; font-style: italic;">Nenhuma obra pública.</p>';
    });
}

window.mudarTabPerfil = function(idTab) {
    document.querySelectorAll('.tab-conteudo').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(idTab).classList.add('active');
    event.target.classList.add('active');
}