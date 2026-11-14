import { db, auth, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, push, set, update, remove, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

let imagemBase64Atual = "";

function escaparHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

function formatarData(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Redimensiona e comprime a imagem para caber leve no Realtime Database
document.getElementById('monstro-img-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 600;
            const scale = Math.min(1, MAX_WIDTH / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            imagemBase64Atual = canvas.toDataURL('image/jpeg', 0.75);

            const preview = document.getElementById('monstro-img-preview');
            preview.src = imagemBase64Atual;
            preview.style.display = 'block';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

function limparFormularioMonstro() {
    document.getElementById('monstro-edit-id').value = '';
    document.getElementById('titulo-form-monstro').textContent = 'Registrar Nova Criatura';
    document.getElementById('monstro-nome').value = '';
    document.getElementById('monstro-ameaca').value = '';
    document.getElementById('monstro-pv').value = 15;
    document.getElementById('monstro-ta').value = 12;
    document.getElementById('monstro-desc').value = '';
    document.getElementById('hab1-nome').value = '';
    document.getElementById('hab1-desc').value = '';
    document.getElementById('hab2-nome').value = '';
    document.getElementById('hab2-desc').value = '';
    document.getElementById('hab3-nome').value = '';
    document.getElementById('hab3-desc').value = '';
    document.getElementById('monstro-img-input').value = '';
    document.getElementById('monstro-img-preview').style.display = 'none';
    document.getElementById('btn-cancelar-edicao-monstro').style.display = 'none';
    imagemBase64Atual = '';
}

document.getElementById('btn-cancelar-edicao-monstro')?.addEventListener('click', limparFormularioMonstro);

// Salvar ou Atualizar Criatura
document.getElementById('btn-salvar-monstro')?.addEventListener('click', () => {
    if (!idJogadorAtual) {
        alert("Faça login com o Google para registrar ou editar criaturas!");
        return;
    }

    const nome = document.getElementById('monstro-nome').value.trim();
    if (!nome) { alert("Dê um nome à criatura!"); return; }

    const editId = document.getElementById('monstro-edit-id').value;
    const habilidades = [
        { nome: document.getElementById('hab1-nome').value.trim(), desc: document.getElementById('hab1-desc').value.trim() },
        { nome: document.getElementById('hab2-nome').value.trim(), desc: document.getElementById('hab2-desc').value.trim() },
        { nome: document.getElementById('hab3-nome').value.trim(), desc: document.getElementById('hab3-desc').value.trim() }
    ].filter(h => h.nome || h.desc);

    const payload = {
        nome,
        natureza: document.getElementById('monstro-natureza').value,
        espectro: document.getElementById('monstro-espectro').value,
        ameaca: document.getElementById('monstro-ameaca').value.trim() || 'Comum | Vol. I',
        atributoDominante: document.getElementById('monstro-atributo').value,
        pv: parseInt(document.getElementById('monstro-pv').value) || 10,
        ta: parseInt(document.getElementById('monstro-ta').value) || 12,
        desc: document.getElementById('monstro-desc').value.trim(),
        habilidades,
        atualizadoEm: Date.now()
    };

    if (imagemBase64Atual) {
        payload.imagem = imagemBase64Atual;
    }

    if (editId) {
        update(ref(db, `salas/${salaAtual}/bestiario/${editId}`), payload)
            .then(() => limparFormularioMonstro())
            .catch(err => console.error("Erro ao editar:", err));
    } else {
        payload.autor = auth.currentUser?.displayName || "Arquivista";
        payload.autorId = idJogadorAtual;
        payload.criadoEm = Date.now();
        push(ref(db, `salas/${salaAtual}/bestiario`), payload)
            .then(() => limparFormularioMonstro())
            .catch(err => console.error("Erro ao salvar:", err));
    }
});

// Carregar Feed com Likes, Feedbacks e Edição
function carregarMonstros() {
    const lista = document.getElementById('lista-monstros');
    if (!lista) return;

    onValue(ref(db, `salas/${salaAtual}/bestiario`), (snapshot) => {
        lista.innerHTML = '';
        const dados = snapshot.val();

        if (!dados) {
            lista.innerHTML = '<p style="color:#888; font-style:italic;">Nenhuma criatura registrada no Bestiário.</p>';
            return;
        }

        Object.entries(dados).reverse().forEach(([id, m]) => {
            const likesObj = m.likes || {};
            const qtdLikes = Object.keys(likesObj).length;
            const curtiu = idJogadorAtual && likesObj[idJogadorAtual];

            const comentariosObj = m.comentarios || {};
            const listaComentarios = Object.values(comentariosObj);

            const habsHTML = (m.habilidades || []).map((h, i) => `
                <div style="background:rgba(255,255,255,0.04); padding:8px 10px; border-left:3px solid #d4af37; margin-top:6px; border-radius:4px;">
                    <strong>Slot ${i + 1} — ${escaparHTML(h.nome || 'Habilidade')}:</strong>
                    <p style="margin:4px 0 0; font-size:0.92em; color:#ddd;">${escaparHTML(h.desc)}</p>
                </div>
            `).join('');

            const imgHTML = m.imagem
                ? `<img src="${m.imagem}" alt="${escaparHTML(m.nome)}" style="width:100%; max-height:260px; object-fit:cover; border-radius:6px; margin-bottom:10px;">`
                : '';

            const textoTempo = m.atualizadoEm && m.atualizadoEm !== m.criadoEm
                ? `Criado em ${formatarData(m.criadoEm)} • Editado em ${formatarData(m.atualizadoEm)}`
                : `Criado em ${formatarData(m.criadoEm)}`;

            const botoesAutor = (idJogadorAtual && m.autorId === idJogadorAtual) ? `
                <div style="display:flex; gap:8px;">
                    <button class="btn-editar-monstro" data-id="${id}" style="cursor:pointer;">✏️ Editar</button>
                    <button class="btn-excluir-monstro" data-id="${id}" style="cursor:pointer; color:#ff6b6b;">🗑️ Excluir</button>
                </div>
            ` : '';

            const comentariosHTML = listaComentarios.map(c => `
                <div style="padding:6px 10px; background:rgba(0,0,0,0.3); border-radius:4px; margin-top:6px; font-size:0.9em;">
                    <strong>${escaparHTML(c.autor)}</strong> <span style="color:#888; font-size:0.8em;">(${formatarData(c.data)})</span>:
                    <p style="margin:2px 0 0;">${escaparHTML(c.texto)}</p>
                </div>
            `).join('');

            const card = document.createElement('article');
            card.className = 'card-cronica';
            card.innerHTML = `
                <div class="card-cronica-body">
                    ${imgHTML}
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <h3 class="card-cronica-titulo" style="margin:0;">${escaparHTML(m.nome)}</h3>
                        <span class="badge-espectro">${escaparHTML(m.natureza || 'Criatura')} • ${escaparHTML(m.espectro)}</span>
                    </div>

                    <div class="card-cronica-info" style="margin:8px 0; display:flex; flex-wrap:wrap; gap:12px; font-weight:bold; color:#d4af37;">
                        <span>🛡️ TA: ${m.ta}</span>
                        <span>❤️ PV: ${m.pv}</span>
                        <span>🎲 Atributo Dominante: ${escaparHTML(m.atributoDominante || 'Vigor')}</span>
                        <span>📖 ${escaparHTML(m.ameaca || '')}</span>
                    </div>

                    <p class="card-cronica-resumo" style="white-space:pre-line;">${escaparHTML(m.desc)}</p>

                    <div style="margin-top:10px;">${habsHTML}</div>

                    <div class="card-cronica-footer" style="margin-top:14px; padding-top:10px; border-top:1px solid #333; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; font-size:0.85em; color:#aaa;">
                        <span>✍️ Por <strong>${escaparHTML(m.autor)}</strong> • ${textoTempo}</span>
                        ${botoesAutor}
                    </div>

                    <!-- LIKE E FEEDBACK -->
                    <div style="margin-top:12px; display:flex; align-items:center; gap:12px;">
                        <button class="btn-like-monstro" data-id="${id}" style="cursor:pointer; padding:5px 12px; border-radius:4px; border:1px solid #555; background:${curtiu ? '#7a1c1c' : 'transparent'}; color:#fff;">
                            ❤️ ${qtdLikes} Curtida(s)
                        </button>
                    </div>

                    <div style="margin-top:12px;">
                        <div style="display:flex; gap:6px;">
                            <input type="text" id="input-coment-${id}" placeholder="Deixar feedback ou sugestão de balanceamento..." style="flex:1;">
                            <button class="btn-comentar-monstro" data-id="${id}" style="cursor:pointer;">Enviar</button>
                        </div>
                        <div style="margin-top:8px;">${comentariosHTML}</div>
                    </div>
                </div>
            `;
            lista.appendChild(card);

            // Eventos internos do card
            card.querySelector('.btn-like-monstro')?.addEventListener('click', () => {
                if (!idJogadorAtual) { alert("Faça login para curtir!"); return; }
                const likeRef = ref(db, `salas/${salaAtual}/bestiario/${id}/likes/${idJogadorAtual}`);
                curtiu ? remove(likeRef) : set(likeRef, true);
            });

            card.querySelector('.btn-comentar-monstro')?.addEventListener('click', () => {
                if (!idJogadorAtual) { alert("Faça login para comentar!"); return; }
                const input = document.getElementById(`input-coment-${id}`);
                const texto = input.value.trim();
                if (!texto) return;

                push(ref(db, `salas/${salaAtual}/bestiario/${id}/comentarios`), {
                    autor: auth.currentUser?.displayName || "Arquivista",
                    autorId: idJogadorAtual,
                    texto,
                    data: Date.now()
                });
                input.value = '';
            });

            card.querySelector('.btn-excluir-monstro')?.addEventListener('click', () => {
                if (confirm(`Remover "${m.nome}" do Bestiário?`)) {
                    remove(ref(db, `salas/${salaAtual}/bestiario/${id}`));
                }
            });

            card.querySelector('.btn-editar-monstro')?.addEventListener('click', () => {
                document.getElementById('monstro-edit-id').value = id;
                document.getElementById('titulo-form-monstro').textContent = `Editando: ${m.nome}`;
                document.getElementById('monstro-nome').value = m.nome || '';
                document.getElementById('monstro-natureza').value = m.natureza || 'Fera';
                document.getElementById('monstro-espectro').value = m.espectro || 'Ígneo';
                document.getElementById('monstro-ameaca').value = m.ameaca || '';
                document.getElementById('monstro-atributo').value = m.atributoDominante || 'Vigor';
                document.getElementById('monstro-pv').value = m.pv || 10;
                document.getElementById('monstro-ta').value = m.ta || 12;
                document.getElementById('monstro-desc').value = m.desc || '';

                const habs = m.habilidades || [];
                document.getElementById('hab1-nome').value = habs[0]?.nome || '';
                document.getElementById('hab1-desc').value = habs[0]?.desc || '';
                document.getElementById('hab2-nome').value = habs[1]?.nome || '';
                document.getElementById('hab2-desc').value = habs[1]?.desc || '';
                document.getElementById('hab3-nome').value = habs[2]?.nome || '';
                document.getElementById('hab3-desc').value = habs[2]?.desc || '';

                imagemBase64Atual = m.imagem || '';
                const preview = document.getElementById('monstro-img-preview');
                if (imagemBase64Atual) {
                    preview.src = imagemBase64Atual;
                    preview.style.display = 'block';
                } else {
                    preview.style.display = 'none';
                }

                document.getElementById('btn-cancelar-edicao-monstro').style.display = 'inline-block';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    });
}

carregarMonstros();