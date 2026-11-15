import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, set, onValue, update, push, get, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

let cronicaEmEdicaoId = null; // Guarda o ID da crônica que está sendo editada
let curtidasDaCronicaAtual = [];

// ==========================================
// 1. SALVAR / EDITAR CRÔNICA
// ==========================================
document.getElementById('btn-salvar-cronica')?.addEventListener('click', () => {
    if (!idJogadorAtual) { alert("Faça login com o Google para publicar!"); return; }
    
    const titulo = document.getElementById('cronica-titulo').value.trim();
    const jogadores = parseInt(document.getElementById('cronica-jogadores').value) || 1;
    const imagem = document.getElementById('cronica-imagem').value.trim();
    const texto = document.getElementById('cronica-texto').value.trim();
    
    if (titulo.length < 3) { alert("Dê um título para a sua missão!"); return; }
    if (texto.length < 10) { alert("Escreva um pouco mais de resumo!"); return; }

    const nome = auth.currentUser?.displayName || "Arquivista Anônimo";
    const btn = document.getElementById('btn-salvar-cronica');
    const status = document.getElementById('status-cronica');
    
    btn.textContent = "Salvando...";
    btn.disabled = true;
    status.textContent = "";

    // Prepara o pacote de dados
    const payload = { 
        autor: nome, 
        titulo: titulo,
        jogadores: jogadores,
        imagem: imagem,
        historia: texto, 
        data: Date.now()
    };

    let promessa;

    if (cronicaEmEdicaoId) {
        // MODO EDIÇÃO: Atualiza apenas os dados, mantendo as curtidas
        const cronicaRef = ref(db, `salas/${salaAtual}/cronicas/${cronicaEmEdicaoId}`);
        promessa = update(cronicaRef, payload);
    } else {
        // MODO CRIAÇÃO: Cria uma ID única e adiciona as curtidas zeradas
        payload.curtidas = [];
        const novaRef = push(ref(db, `salas/${salaAtual}/cronicas`));
        promessa = set(novaRef, payload);
    }

    promessa.then(() => {
        status.textContent = cronicaEmEdicaoId ? "✅ Crônica atualizada!" : "✅ Crônica publicada!";
        status.style.color = "#4caf50";
        
        // Limpa o formulário e volta ao modo normal
        cancelarEdicao();
        
        setTimeout(() => { status.textContent = ""; status.style.color = "#888"; }, 3000);
    }).catch(e => {
        console.error(e); 
        status.textContent = "❌ Erro ao salvar.";
        btn.textContent = cronicaEmEdicaoId ? "Salvar Alterações" : "Publicar Crônica";
        btn.disabled = false;
    });
});

// ==========================================
// 2. RENDERIZAR OS CARDS
// ==========================================
function tempoAtras(timestamp) {
    if (!timestamp) return "Recentemente";
    const segundos = Math.floor((Date.now() - timestamp) / 1000);
    if (segundos < 60) return "Agora mesmo";
    const minutos = Math.floor(segundos / 60);
    if (minutos < 60) return `Há ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Há ${horas} horas`;
    return `Há ${Math.floor(horas / 24)} dias`;
}

function carregarCronicas() {
    const lista = document.getElementById('lista-cronicas');
    if (!lista) return;

    onValue(ref(db, `salas/${salaAtual}/cronicas`), (snapshot) => {
        lista.innerHTML = '';
        const dados = snapshot.val();
        
        if (!dados) {
            lista.innerHTML = '<p style="color: #888; font-style: italic; grid-column: 1/-1;">Nenhuma crônica registrada ainda.</p>';
            return;
        }

        const cronicasArray = Object.keys(dados).map(id => ({ id, ...dados[id] }));
        cronicasArray.sort((a, b) => b.data - a.data);

        cronicasArray.forEach(c => {
            const qtdLikes = c.curtidas ? c.curtidas.length : 0;
            const imgFinal = c.imagem && c.imagem.trim() !== '' ? c.imagem : 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';

            const div = document.createElement('div');
            div.className = 'card-cronica';
            div.onclick = () => abrirModalCronica(c, c.id);

            div.innerHTML = `
                <img src="${imgFinal}" class="card-cronica-img" onerror="this.src='https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80'">
                <div class="card-cronica-body">
                    <div class="card-cronica-titulo">${c.titulo || 'Crônica sem Título'}</div>
                    <div class="card-cronica-info">
                        <span>Por: <strong>${c.autor}</strong></span>
                        <span>${tempoAtras(c.data)}</span>
                    </div>
                    <div class="card-cronica-resumo">${c.historia}</div>
                    <div class="card-cronica-footer">
                        <span>👥 ${c.jogadores || 1} Jogadores</span>
                        <span>❤️ ${qtdLikes}</span>
                    </div>
                </div>
            `;
            lista.appendChild(div);
        });
    });
}

// ==========================================
// 3. MODAL E LÓGICA DE EDIÇÃO
// ==========================================
function abrirModalCronica(c, idCronica) {
    curtidasDaCronicaAtual = c.curtidas || [];
    
    const modal = document.getElementById('modal-cronica');
    
    document.getElementById('modal-titulo').textContent = c.titulo || 'Crônica sem Título';
    document.getElementById('modal-autor').textContent = `Escrito por: ${c.autor}`;
    document.getElementById('modal-texto').textContent = c.historia;
    
    const imgFinal = c.imagem && c.imagem.trim() !== '' ? c.imagem : 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=400&q=80';
    document.getElementById('modal-img').src = imgFinal;
    
    modal.style.display = 'block';

    atualizarBotaoLike();

    // Configura o botão Editar
    const btnEditar = document.getElementById('btn-editar');
    if (c.autor === auth.currentUser?.displayName) {
        btnEditar.style.display = 'block';
        // Quando clicar em editar, passa os dados e o ID para a variável global
        btnEditar.onclick = () => {
            cronicaEmEdicaoId = idCronica;
            
            document.getElementById('cronica-titulo').value = c.titulo;
            document.getElementById('cronica-jogadores').value = c.jogadores || 1;
            document.getElementById('cronica-texto').value = c.historia;
            
            // Se a imagem for um Base64 antigo, limpa. Se for link, mantém.
            document.getElementById('cronica-imagem').value = (c.imagem && c.imagem.startsWith('http')) ? c.imagem : "";
            
            // Muda o visual do botão Salvar e mostra o botão Cancelar
            document.getElementById('btn-salvar-cronica').textContent = "Salvar Alterações";
            document.getElementById('btn-salvar-cronica').style.background = "#4caf50";
            
            let btnCancelar = document.getElementById('btn-cancelar-edicao');
            if(!btnCancelar) {
                btnCancelar = document.createElement('button');
                btnCancelar.id = 'btn-cancelar-edicao';
                btnCancelar.className = 'btn-primario';
                btnCancelar.style.background = '#a83232';
                btnCancelar.style.marginTop = '5px';
                btnCancelar.textContent = 'Cancelar Edição';
                btnCancelar.onclick = cancelarEdicao;
                document.getElementById('btn-salvar-cronica').parentNode.appendChild(btnCancelar);
            }
            btnCancelar.style.display = 'block';

            fecharModalCronica();
            window.scrollTo(0, 0);
        };
    } else {
        btnEditar.style.display = 'none';
    }
}

function cancelarEdicao() {
    cronicaEmEdicaoId = null;
    
    document.getElementById('cronica-titulo').value = "";
    document.getElementById('cronica-jogadores').value = 4;
    document.getElementById('cronica-imagem').value = "";
    document.getElementById('cronica-texto').value = "";
    
    const btnSalvar = document.getElementById('btn-salvar-cronica');
    btnSalvar.textContent = "Publicar Crônica";
    btnSalvar.style.background = "var(--gold)";
    btnSalvar.disabled = false;
    
    const btnCancelar = document.getElementById('btn-cancelar-edicao');
    if(btnCancelar) btnCancelar.style.display = 'none';
}

window.fecharModalCronica = function() {
    document.getElementById('modal-cronica').style.display = 'none';
}

// ==========================================
// 4. LIKES
// ==========================================
function atualizarBotaoLike() {
    const btn = document.getElementById('btn-like');
    const qtdSpan = document.getElementById('qtd-likes');
    if(!btn) return;
    
    qtdSpan.textContent = curtidasDaCronicaAtual.length;
    
    if (idJogadorAtual && curtidasDaCronicaAtual.includes(idJogadorAtual)) {
        btn.classList.add('curtido');
    } else {
        btn.classList.remove('curtido');
    }
}

window.alternarLike = async function() {
    if (!idJogadorAtual) { alert("Faça login para curtir!"); return; }

    let novasCurtidas = [...curtidasDaCronicaAtual];
    if (novasCurtidas.includes(idJogadorAtual)) {
        novasCurtidas = novasCurtidas.filter(id => id !== idJogadorAtual);
    } else {
        novasCurtidas.push(idJogadorAtual);
    }

    const cronicaRef = ref(db, `salas/${salaAtual}/cronicas/${document.getElementById('modal-cronica').getAttribute('data-id')}`);
    await update(cronicaRef, { curtidas: novasCurtidas });
    
    curtidasDaCronicaAtual = novasCurtidas;
    atualizarBotaoLike();
}

carregarCronicas();