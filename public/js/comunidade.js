import { auth, db, idJogadorAtual, salaAtual } from './firebase.js';
import { ref, push, set, onValue, update, remove, get } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';

let cronicaAbertaId = null;
let cronicaAbertaObj = null;

function carregarCronicas() {
    const lista = document.getElementById('lista-cronicas');
    if (!lista) return;

    let dadosRaiz = {};
    let dadosSala = {};

    const renderizar = () => {
        const todas = { ...dadosSala, ...dadosRaiz };
        lista.innerHTML = '';

        const ids = Object.keys(todas);
        if (ids.length === 0) {
            lista.innerHTML = '<p style="color:#888; grid-column:1/-1;">Nenhuma crônica publicada ainda. Seja o primeiro!</p>';
            return;
        }

        ids
            .sort((a, b) => (todas[b]?.criadoEm || todas[b]?.data || 0) - (todas[a]?.criadoEm || todas[a]?.data || 0))
            .forEach((id) => {
                const c = todas[id];
                if (!c || typeof c !== 'object') return;

                const titulo = c.titulo || c.nome || 'Crônica sem Título';
                const autor = c.autor || c.autorNome || 'Arquivista';
                const texto = c.texto || c.resumo || c.descricao || '';
                const likes = Array.isArray(c.curtidas) ? c.curtidas.length : 0;
                const imgPadrao = 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80';
                const imgUrl = c.imagem && c.imagem.trim() !== '' ? c.imagem : imgPadrao;

                const card = document.createElement('article');
                card.className = 'cronica-card';
                card.innerHTML = `
                    <img src="${imgUrl}" alt="${titulo}" onerror="this.src='${imgPadrao}'">
                    <div class="cronica-card-body">
                        <h3>${titulo}</h3>
                        <p>${texto}</p>
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#9c9283; margin-top:auto; padding-top:8px; border-top:1px solid #333;">
                            <span>✍️ ${autor} • 👥 ${c.jogadores || 4} jog.</span>
                            <span>❤️ ${likes}</span>
                        </div>
                    </div>
                `;
                card.addEventListener('click', () => abrirModalCronica(id, c));
                lista.appendChild(card);
            });
    };

    onValue(ref(db, 'cronicas'), (snap) => {
        dadosRaiz = snap.val() || {};
        renderizar();
    }, (err) => console.error('Erro ao ler crônicas:', err));

    onValue(ref(db, `salas/${salaAtual}/cronicas`), (snap) => {
        dadosSala = snap.val() || {};
        renderizar();
    });
}

function configurarFormularioCronica() {
    const btnSalvar = document.getElementById('btn-salvar-cronica');
    if (!btnSalvar) return;

    btnSalvar.addEventListener('click', () => {
        if (!idJogadorAtual) {
            alert('Faça login com o Google para publicar uma crônica!');
            return;
        }

        const titulo = document.getElementById('cronica-titulo')?.value.trim() || '';
        const texto = document.getElementById('cronica-texto')?.value.trim() || '';
        const jogadores = Number(document.getElementById('cronica-jogadores')?.value) || 4;
        const editId = document.getElementById('edit-cronica-id')?.value || '';
        const status = document.getElementById('status-cronica');

        if (titulo.length < 3 || texto.length < 5) {
            alert('Preencha o título e o resumo da crônica.');
            return;
        }

        btnSalvar.disabled = true;
        btnSalvar.textContent = 'Publicando...';

        const gravar = async (imgFinal) => {
            try {
                const payload = {
                    titulo,
                    texto,
                    jogadores,
                    imagem: imgFinal,
                    autor: auth.currentUser?.displayName || 'Arquivista',
                    autorId: idJogadorAtual,
                    criadoEm: Date.now()
                };

                if (editId) {
                    await update(ref(db, `cronicas/${editId}`), payload);
                } else {
                    payload.curtidas = [];
                    const novaRef = push(ref(db, 'cronicas'));
                    await set(novaRef, payload);
                }

                document.getElementById('edit-cronica-id').value = '';
                document.getElementById('cronica-titulo').value = '';
                document.getElementById('cronica-texto').value = '';
                document.getElementById('cronica-imagem').value = '';
                const arq = document.getElementById('cronica-arquivo');
                if (arq) arq.value = '';

                if (status) {
                    status.style.color = '#2ec4b6';
                    status.textContent = editId ? '✅ Crônica atualizada!' : '✅ Crônica publicada!';
                    setTimeout(() => (status.textContent = ''), 3000);
                }
            } catch (e) {
                console.error('Erro ao salvar crônica:', e);
                alert('Erro ao publicar crônica: ' + e.message);
            } finally {
                btnSalvar.disabled = false;
                btnSalvar.textContent = 'Publicar Crônica';
            }
        };

        const arquivoInput = document.getElementById('cronica-arquivo');
        const urlInput = document.getElementById('cronica-imagem')?.value.trim() || '';

        if (arquivoInput && arquivoInput.files.length > 0) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const scale = Math.min(1, 600 / img.width);
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    gravar(canvas.toDataURL('image/jpeg', 0.72));
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(arquivoInput.files[0]);
        } else {
            gravar(urlInput);
        }
    });
}

function abrirModalCronica(id, cronica) {
    cronicaAbertaId = id;
    cronicaAbertaObj = cronica;

    const modal = document.getElementById('modal-cronica');
    if (!modal) return;

    const imgPadrao = 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80';
    const imgEl = document.getElementById('modal-img');
    imgEl.src = cronica.imagem && cronica.imagem.trim() !== '' ? cronica.imagem : imgPadrao;
    imgEl.onerror = () => (imgEl.src = imgPadrao);

    document.getElementById('modal-titulo').textContent = cronica.titulo || 'Sem Título';
    document.getElementById('modal-autor').textContent = `Escrito por ${cronica.autor || 'Arquivista'} • ${cronica.jogadores || 4} Jogadores`;
    document.getElementById('modal-texto').textContent = cronica.texto || '';

    const curtidas = Array.isArray(cronica.curtidas) ? cronica.curtidas : [];
    document.getElementById('qtd-likes').textContent = curtidas.length;

    const ehDono = cronica.autorId && cronica.autorId === idJogadorAtual;
    const btnEditar = document.getElementById('btn-editar');
    const btnDeletar = document.getElementById('btn-deletar');

    if (btnEditar) btnEditar.style.display = ehDono ? 'block' : 'none';
    if (btnDeletar) {
        btnDeletar.style.display = ehDono ? 'block' : 'none';
        btnDeletar.onclick = async () => {
            if (!confirm('Deseja apagar esta crônica?')) return;
            await remove(ref(db, `cronicas/${id}`));
            window.fecharModalCronica();
        };
    }

    modal.style.display = 'flex';
}

window.fecharModalCronica = function() {
    const modal = document.getElementById('modal-cronica');
    if (modal) modal.style.display = 'none';
    cronicaAbertaId = null;
};

window.alternarLike = async function() {
    if (!idJogadorAtual) { alert('Faça login para curtir!'); return; }
    if (!cronicaAbertaId) return;

    const snap = await get(ref(db, `cronicas/${cronicaAbertaId}/curtidas`));
    let lista = Array.isArray(snap.val()) ? snap.val() : [];
    if (lista.includes(idJogadorAtual)) {
        lista = lista.filter(uid => uid !== idJogadorAtual);
    } else {
        lista.push(idJogadorAtual);
    }

    await update(ref(db, `cronicas/${cronicaAbertaId}`), { curtidas: lista });
    document.getElementById('qtd-likes').textContent = lista.length;
};

window.prepararEdicao = function() {
    if (!cronicaAbertaId || !cronicaAbertaObj) return;
    document.getElementById('edit-cronica-id').value = cronicaAbertaId;
    document.getElementById('cronica-titulo').value = cronicaAbertaObj.titulo || '';
    document.getElementById('cronica-jogadores').value = cronicaAbertaObj.jogadores || 4;
    document.getElementById('cronica-imagem').value = (cronicaAbertaObj.imagem || '').startsWith('data:') ? '' : (cronicaAbertaObj.imagem || '');
    document.getElementById('cronica-texto').value = cronicaAbertaObj.texto || '';
    document.getElementById('btn-salvar-cronica').textContent = 'Salvar Alterações';
    window.fecharModalCronica();
    window.scrollTo(0, 0);
};

document.addEventListener('DOMContentLoaded', () => {
    configurarFormularioCronica();
    carregarCronicas();
});