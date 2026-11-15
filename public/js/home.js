import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const feedContainer = document.getElementById('feed-home');

// Função para formatar o tempo
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

function carregarFeed() {
    if(!feedContainer) return;

    // O onValue escuta a sala em tempo real
    onValue(ref(db, `salas/${salaAtual}`), (snapshot) => {
        const dados = snapshot.val();
        
        if(!dados) {
            feedContainer.innerHTML = '<p style="color:#888; text-align:center;">Nenhuma atividade recente.</p>';
            return;
        }

        let todasAtividades = [];

        // Verifica se existe cada coleção antes de tentar ler (evita erro de undefined)
        if(dados.monstros) {
            Object.values(dados.monstros).forEach(m => {
                todasAtividades.push({
                    tipo: 'Bestiário', link: 'pages/monstros.html',
                    titulo: m.titulo, autor: m.autor, autorId: m.autorId, data: m.data,
                    imagem: m.imagem, texto: m.texto || 'Uma nova criatura catalogada.',
                    icone: '👹'
                });
            });
        }

        if(dados.armas) {
            Object.values(dados.armas).forEach(a => {
                todasAtividades.push({
                    tipo: 'Arsenal', link: 'pages/armas.html',
                    titulo: a.titulo, autor: a.autor, autorId: a.autorId, data: a.data,
                    imagem: a.imagem, texto: `Arma forjada na categoria ${a.categoria}.`,
                    icone: '🛡️'
                });
            });
        }

        if(dados.cronicas) {
            Object.values(dados.cronicas).forEach(c => {
                todasAtividades.push({
                    tipo: 'Crônica', link: 'pages/comunidade.html',
                    titulo: c.titulo, autor: c.autor, autorId: c.autorId, data: c.data,
                    imagem: c.imagem, texto: c.historia ? c.historia.substring(0, 100) + '...' : 'Nova história registrada.',
                    icone: '🌍'
                });
            });
        }

        if(dados.habilidades) {
            Object.values(dados.habilidades).forEach(h => {
                todasAtividades.push({
                    tipo: 'Grimório', link: 'pages/habilidades.html',
                    titulo: h.titulo, autor: h.autor, autorId: h.autorId, data: h.data,
                    imagem: h.imagem, texto: `Nova ${h.tipo || 'habilidade'} registrada.`,
                    icone: '✨'
                });
            });
        }

        // Ordena do mais novo para o mais antigo
        todasAtividades.sort((a, b) => b.data - a.data);
        
        // Pega os 10 mais recentes
        const feedRecente = todasAtividades.slice(0, 10);

        if(feedRecente.length === 0) {
            feedContainer.innerHTML = '<p style="color:#888; text-align:center;">Nenhuma atividade recente.</p>';
            return;
        }

        feedContainer.innerHTML = '';

        feedRecente.forEach(item => {
            const imagemPadrao = 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=200&q=80';
            const imgFinal = item.imagem && item.imagem.trim() !== '' ? item.imagem : imagemPadrao;

            const card = document.createElement('a');
            card.href = item.link;
            card.className = 'post-card';

            // Link do autor preparado para ir ao perfil
            const linkAutor = item.autorId 
                ? `<a href="pages/perfil.html?uid=${item.autorId}" style="color:var(--gold); text-decoration:none; font-weight:bold;" onclick="event.stopPropagation()">${item.autor}</a>`
                : `<strong>${item.autor || 'Arquivista'}</strong>`;

            card.innerHTML = `
                <div class="post-header">
                    <h3>${item.icone} ${item.titulo}</h3>
                    <span>${tempoAtras(item.data)}</span>
                </div>
                <div class="post-body">
                    <img src="${imgFinal}" class="post-img" onerror="this.src='${imagemPadrao}'">
                    <div class="post-text">
                        ${item.texto}
                    </div>
                </div>
                <div class="post-footer">
                    <span>Publicado no ${item.tipo}</span>
                    <span>Por: ${linkAutor}</span>
                </div>
            `;

            feedContainer.appendChild(card);
        });
    });
}

// Inicia o feed assim que a página carregar
carregarFeed();