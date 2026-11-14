import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const COLECAO = "monstros";
let itemAbertoId = null;
let curtidasDoItem = [];

// ==========================================
// 1. SALVAR MONSTRO
// ==========================================
document.getElementById('btn-salvar-form')?.addEventListener('click', () => {
    if (!idJogadorAtual) { alert("Faça login!"); return; }
    
    const titulo = document.getElementById('form-titulo').value.trim();
    const texto = document.getElementById('form-texto').value.trim();
    const imagem = document.getElementById('form-imagem').value.trim();
    
    if (titulo.length < 3 || texto.length < 10) { alert("Preencha o nome e a descrição."); return; }

    let habs = [];
    if(document.getElementById('form-hab1').value) habs.push(document.getElementById('form-hab1').value);
    if(document.getElementById('form-hab2').value) habs.push(document.getElementById('form-hab2').value);
    if(document.getElementById('form-hab3').value) habs.push(document.getElementById('form-hab3').value);

    const payload = {
        autor: auth.currentUser.displayName || "Arquivista",
        titulo: titulo,
        texto: texto,
        imagem: imagem,
        vida: document.getElementById('form-vida').value,
        ta: document.getElementById('form-ta').value,
        dominante: document.getElementById('form-dominante').value,
        espectro: document.getElementById('form-espectro').value,
        habilidades: habs,
        data: Date.now()
    };

    const idGerado = itemAbertoId || `monstro_${Date.now()}`;
    const itemRef = ref(db, `salas/${salaAtual}/${COLECAO}/${idGerado}`);

    set(itemRef, payload).then(() => {
        document.getElementById('status-form').textContent = "✅ Monstro salvo!";
        document.getElementById('form-titulo').value = "";
        document.getElementById('form-texto').value = "";
        document.getElementById('form-hab1').value = "";
        document.getElementById('form-hab2').value = "";
        document.getElementById('form-hab3').value = "";
        itemAbertoId = null;
        setTimeout(() => document.getElementById('status-form').textContent = "", 3000);
    });
});

// ==========================================
// 2. RENDERIZAR FEED
// ==========================================
function tempoAtras(timestamp) {
    const segundos = Math.floor((Date.now() - timestamp) / 1000);
    if (segundos < 60) return "Agora mesmo";
    const minutos = Math.floor(segundos / 60);
    if (minutos < 60) return `Há ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Há ${horas} horas`;
    return `Há ${Math.floor(horas / 24)} dias`;
}

function carregarFeed() {
    const lista = document.getElementById('lista-feed');
    if (!lista) return;

    onValue(ref(db, `salas/${salaAtual}/${COLECAO}`), (snapshot) => {
        lista.innerHTML = '';
        const dados = snapshot.val();
        if (!dados) { lista.innerHTML = '<p>Nenhum monstro registrado ainda.</p>'; return; }

        Object.keys(dados).sort((a,b) => dados[b].data - dados[a].data).forEach(id => {
            const item = dados[id];
            const qtdLikes = item.curtidas ? item.curtidas.length : 0;
            
            const imgFinal = item.imagem && item.imagem.trim() !== '' 
                ? item.imagem 
                : 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';

            const card = document.createElement('div');
            card.className = 'card-cronica';
            card.onclick = () => abrirModal(item, id);

            card.innerHTML = `
                <img src="${imgFinal}" class="card-cronica-img" onerror="this.src='https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80'">
                <div class="card-cronica-body">
                    <div class="card-cronica-titulo">${item.titulo}</div>
                    <div class="card-cronica-info">
                        <span>Por: <strong>${item.autor}</strong></span>
                        <span>${tempoAtras(item.data)}</span>
                    </div>
                    <div class="card-cronica-resumo">${item.texto}</div>
                    <div class="card-cronica-footer">
                        <span>❤️ ${qtdLikes}</span>
                    </div>
                </div>
            `;
            lista.appendChild(card);
        });
    });
}

// ==========================================
// 3. MODAL E LIKES
// ==========================================
function abrirModal(item, id) {
    itemAbertoId = id;
    curtidasDoItem = item.curtidas || [];
    
    const imgFinal = item.imagem && item.imagem.trim() !== '' 
        ? item.imagem 
        : 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';

    document.getElementById('modal-img').src = imgFinal;
    document.getElementById('modal-titulo').textContent = item.titulo;
    document.getElementById('modal-texto').textContent = item.texto;

    let sub = `Criado por: ${item.autor} | ${tempoAtras(item.data)}`;
    sub += `<br>PV: ${item.vida} | TA: ${item.ta} | Dominante: ${item.dominante}`;
    if(item.espectro) sub += ` | Espectro: ${item.espectro}`;
    
    let caixaHabs = "";
    if (item.habilidades && item.habilidades.length > 0) {
        caixaHabs = `<h4 style="color:var(--gold); margin-bottom:5px;">Habilidades:</h4>`;
        item.habilidades.forEach(h => { caixaHabs += `<li>${h}</li>`; });
        caixaHabs = `<ul style="margin-left: 20px;">${caixaHabs}</ul>`;
    }

    document.getElementById('modal-subtitulo').innerHTML = sub;
    document.getElementById('modal-habilidades').innerHTML = caixaHabs;
    document.getElementById('modal-habilidades').style.display = caixaHabs ? 'block' : 'none';

    document.getElementById('modal-item').style.display = 'block';
    document.getElementById('btn-editar').style.display = (item.autor === auth.currentUser?.displayName) ? 'block' : 'none';
    
    atualizarBotaoLike();
}

function fecharModal() {
    document.getElementById('modal-item').style.display = 'none';
}

function atualizarBotaoLike() {
    const btn = document.getElementById('btn-like');
    const qtdSpan = document.getElementById('qtd-likes');
    qtdSpan.textContent = curtidasDoItem.length;
    
    if (idJogadorAtual && curtidasDoItem.includes(idJogadorAtual)) {
        btn.classList.add('curtido');
    } else {
        btn.classList.remove('curtido');
    }
}

async function alternarLike() {
    if (!idJogadorAtual) { alert("Faça login para curtir!"); return; }

    let novasCurtidas = [...curtidasDoItem];
    if (novasCurtidas.includes(idJogadorAtual)) {
        novasCurtidas = novasCurtidas.filter(id => id !== idJogadorAtual);
    } else {
        novasCurtidas.push(idJogadorAtual);
    }

    const itemRef = ref(db, `salas/${salaAtual}/${COLECAO}/${itemAbertoId}`);
    await update(itemRef, { curtidas: novasCurtidas });
    
    curtidasDoItem = novasCurtidas;
    atualizarBotaoLike();
}

function prepararEdicao() {
    const itemRef = ref(db, `salas/${salaAtual}/${COLECAO}/${itemAbertoId}`);
    
    onValue(itemRef, (snapshot) => {
        const item = snapshot.val();
        if (!item) return;

        document.getElementById('form-titulo').value = item.titulo;
        document.getElementById('form-texto').value = item.texto;
        document.getElementById('form-imagem').value = item.imagem || "";
        document.getElementById('form-vida').value = item.vida;
        document.getElementById('form-ta').value = item.ta;
        document.getElementById('form-dominante').value = item.dominante;
        document.getElementById('form-espectro').value = item.espectro || "";
        
        if(item.habilidades) {
            document.getElementById('form-hab1').value = item.habilidades[0] || "";
            document.getElementById('form-hab2').value = item.habilidades[1] || "";
            document.getElementById('form-hab3').value = item.habilidades[2] || "";
        }

        fecharModal();
        window.scrollTo(0, 0);
    }, { onlyOnce: true });
}

window.fecharModal = fecharModal;
window.alternarLike = alternarLike;
window.prepararEdicao = prepararEdicao;

carregarFeed();