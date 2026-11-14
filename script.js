import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, query, limitToLast, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// ==========================================
// 1. CONFIGURAÇÃO DO FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDVpq__JyU5KTQ6p6zB6DTqey4k2jaEFZo",
  authDomain: "b5at-44d1d.firebaseapp.com",
  databaseURL: "https://b5at-44d1d-default-rtdb.firebaseio.com/",
  projectId: "b5at-44d1d",
  storageBucket: "b5at-44d1d.firebasestorage.app",
  messagingSenderId: "394788459759",
  appId: "1:394788459759:web:7050aa055cec655b88b71a"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let idJogadorAtual = null;
let fichaRef = null;
let salaAtual = "sala-padrao";

// Estado dos dados do personagem (AGORA TODOS COMEÇAM EM 0)
let dadosPersonagem = {
    vigor: 0, dinamismo: 0, razao: 0, determinacao: 0,
    barganha: 0, combate: 0, tecnologia: 0, resistencia: 0,
    intuicao: 0, medicina: 0, investigar: 0, invasao: 0,
    pesquisa: 0, arcanismo: 0, imaginacao: 0, historia: 0
};

// ==========================================
// 2. ELEMENTOS DO DOM
// ==========================================
const salaInput = document.getElementById('sala-id');
const statusLogin = document.getElementById('status-login');
const nomeSalaExibicao = document.getElementById('nome-sala-exibicao');
const btnLogin = document.getElementById('btn-login');

const fNome = document.getElementById('f-nome');
const fEspectro = document.getElementById('f-espectro');
const fVolume = document.getElementById('f-volume');
const fPvAtual = document.getElementById('f-pv-atual');
const fPvMax = document.getElementById('f-pv-max');
const fPiAtual = document.getElementById('f-pi-atual');
const fPiMax = document.getElementById('f-pi-max');

const btnDesafiar = document.getElementById('btn-desafiar');
const containerResultado = document.getElementById('resultado-container');
const listaHistorico = document.getElementById('lista-historico-global');

// ==========================================
// 3. CONTROLE DE DADOS (+ e -)
// ==========================================
window.ajustarDado = function(nomeChave, valor) {
    let novoValor = dadosPersonagem[nomeChave] + valor;
    if (novoValor < 0) novoValor = 0;
    if (novoValor > 10) novoValor = 10; 
    
    dadosPersonagem[nomeChave] = novoValor;
    document.getElementById(`val-${nomeChave}`).textContent = novoValor;
    
    salvarFicha();
};

// ==========================================
// 4. ROLAGEM CLICÁVEL (Atributos e Perícias)
// ==========================================
window.rolarTeste = function(nomeExibicao, nomeChave, faces) {
    if (!idJogadorAtual) {
        alert("Faça login com o Google para rolar os dados!");
        return;
    }

    const qtd = dadosPersonagem[nomeChave];
    const vol = parseInt(fVolume.value) || 1;
    const d12 = Math.floor(Math.random() * 12) + 1;
    
    // REGRA DO SISTEMA: Se tiver 0 dados, rola Desafiar o Destino (2d12)
    if (qtd === 0) {
        let d12_1 = Math.floor(Math.random() * 12) + 1;
        let d12_2 = Math.floor(Math.random() * 12) + 1;
        let d12_desafio = Math.max(d12_1, d12_2);
        
        const total = d12_desafio + vol;
        exibirResultado(d12_desafio, 0, vol, total, `${nomeExibicao} (0 dados)`, true, d12_1, d12_2);
        enviarParaHistorico(`${nomeExibicao} (Desafio)`, d12_desafio, 0, vol, total);
        return;
    }

    // Rolagem normal
    let soma = 0;
    for(let i=0; i<qtd; i++) {
        soma += Math.floor(Math.random() * faces) + 1;
    }

    const total = d12 + soma + vol;
    exibirResultado(d12, soma, vol, total, `${qtd}d${faces}`);
    enviarParaHistorico(nomeExibicao, d12, soma, vol, total);
};

// ==========================================
// 5. DESAFIAR O DESTINO MANUAL (2d12)
// ==========================================
if (btnDesafiar) {
    btnDesafiar.addEventListener('click', () => {
        if (!idJogadorAtual) {
            alert("Faça login com o Google para rolar os dados!");
            return;
        }

        const vol = parseInt(fVolume.value) || 1;
        let d12_1 = Math.floor(Math.random() * 12) + 1;
        let d12_2 = Math.floor(Math.random() * 12) + 1;
        let d12 = Math.max(d12_1, d12_2);
        
        const total = d12 + vol;
        exibirResultado(d12, 0, vol, total, "Desafio Manual", true, d12_1, d12_2);
        enviarParaHistorico("Desafiar o Destino", d12, 0, vol, total);
    });
}

// ==========================================
// 6. EXIBIÇÃO E HISTÓRICO
// ==========================================
function exibirResultado(d12, soma, vol, total, labelDado, isDesafio = false, d1 = 0, d2 = 0) {
    const d12Box = document.getElementById('dado-d12');
    const outrosBox = document.getElementById('dados-outros');
    const labelOutros = document.getElementById('label-outros');
    const totalVisual = document.getElementById('total-visual');

    containerResultado.className = 'resultado-container';
    
    if (fEspectro.value !== 'padrao') {
        containerResultado.classList.add(`espectro-${fEspectro.value}`);
    }

    d12Box.textContent = d12;
    totalVisual.innerHTML = `Total: <strong>${total}</strong>`;

    if (isDesafio) {
        outrosBox.textContent = "-";
        labelOutros.textContent = "Desafio (2d12)";
        totalVisual.innerHTML += `<br><small style="color:#888;">Rolou ${d1} e ${d2}. Manteve ${d12}</small>`;
    } else {
        outrosBox.textContent = soma;
        labelOutros.textContent = labelDado;
    }

    if (d12 === 1) totalVisual.innerHTML += `<br><span style="color:#ff4d4d; font-weight:bold;">Catástrofe!</span>`;
    if (d12 === 6) totalVisual.innerHTML += `<br><span style="color:#ff9800; font-weight:bold;">Falha Absoluta!</span>`;
    if (d12 === 12) totalVisual.innerHTML += `<br><span style="color:#4caf50; font-weight:bold;">Lendário!</span>`;
}

function adicionarHistoricoNaTela(dados) {
    const aviso = document.getElementById('aviso-historico-vazio');
    if (aviso) aviso.style.display = 'none';

    const li = document.createElement('li');
    if (dados.d12 === 1) li.classList.add('hist-1');
    if (dados.d12 === 6) li.classList.add('hist-6');
    if (dados.d12 === 12) li.classList.add('hist-12');

    li.innerHTML = `
        <div>
            <strong>${dados.nome}</strong> 
            <div class="hist-detalhe">${dados.d12} (d12) + ${dados.outros} + ${dados.vol} (Vol)</div>
        </div>
        <div class="hist-total">${dados.total}</div>
    `;
    listaHistorico.prepend(li);
}

function enviarParaHistorico(nomeAcao, d12, soma, vol, total) {
    const nome = fNome.value.trim() || "Arquivista";
    const rolagemRef = ref(db, `salas/${salaAtual}/rolagens`);
    push(rolagemRef, { 
        nome: `${nome} (${nomeAcao})`, 
        d12: d12, 
        outros: soma, 
        vol: vol, 
        total: total 
    });
}

// ==========================================
// 7. CONEXÃO COM AS SALAS
// ==========================================
function conectarSala(idSala) {
    listaHistorico.innerHTML = '';
    
    const aviso = document.getElementById('aviso-historico-vazio');
    if (aviso) aviso.style.display = 'block';

    salaAtual = idSala;
    if (nomeSalaExibicao) nomeSalaExibicao.textContent = idSala;
    
    const salaRef = query(ref(db, `salas/${idSala}/rolagens`), limitToLast(20));
    onChildAdded(salaRef, (snapshot) => {
        adicionarHistoricoNaTela(snapshot.val());
    });
    
    if (idJogadorAtual) iniciarFicha();
}

if (salaInput) {
    salaInput.addEventListener('change', () => {
        conectarSala(salaInput.value.trim() || "sala-padrao");
    });
}

// ==========================================
// 8. LOGIN E FICHA (FIREBASE)
// ==========================================
if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch((error) => {
            console.error("Erro no login:", error);
            alert("Não foi possível fazer login. Verifique o domínio autorizado no Firebase.");
        });
    });
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        idJogadorAtual = user.uid;
        statusLogin.textContent = `✅ ${user.displayName || user.email}`;
        if (btnLogin) btnLogin.style.display = 'none'; 
        iniciarFicha();
    } else {
        idJogadorAtual = null;
        statusLogin.textContent = "🔴 Faça login para salvar";
        if (btnLogin) btnLogin.style.display = 'block'; 
    }
});

function iniciarFicha() {
    if (!idJogadorAtual) return;
    salaAtual = salaInput.value.trim() || "sala-padrao";
    fichaRef = ref(db, `salas/${salaAtual}/jogadores/${idJogadorAtual}`);

    onValue(fichaRef, (snapshot) => {
        const dados = snapshot.val();
        if (dados) {
            fNome.value = dados.nome || '';
            fEspectro.value = dados.espectro || 'padrao';
            fVolume.value = dados.volume || 1;
            fPvAtual.textContent = dados.pvAtual || 10;
            fPvMax.value = dados.pvMax || 10;
            fPiAtual.textContent = dados.piAtual || 5;
            fPiMax.value = dados.piMax || 5;
            
            if (dados.dadosPersonagem) {
                dadosPersonagem = dados.dadosPersonagem;
                // Atualiza a interface com os valores salvos
                for (let chave in dadosPersonagem) {
                    let el = document.getElementById(`val-${chave}`);
                    if (el) el.textContent = dadosPersonagem[chave];
                }
            }
        } else {
            fNome.value = auth.currentUser.displayName || "Arquivista";
            salvarFicha();
        }
    });
}

function salvarFicha() {
    if (!fichaRef || !idJogadorAtual) return;
    const dados = {
        nome: fNome.value,
        espectro: fEspectro.value,
        volume: parseInt(fVolume.value) || 1,
        pvAtual: parseInt(fPvAtual.textContent) || 0,
        pvMax: parseInt(fPvMax.value) || 10,
        piAtual: parseInt(fPiAtual.textContent) || 0,
        piMax: parseInt(fPiMax.value) || 5,
        dadosPersonagem: dadosPersonagem
    };
    set(fichaRef, dados).catch(e => console.error("Erro ao salvar:", e));
}

[fNome, fEspectro, fVolume].forEach(el => {
    if (el) el.addEventListener('change', salvarFicha);
});

window.alterarRecurso = function(recurso, valor) {
    if (!idJogadorAtual) {
        alert("Faça login com o Google para salvar!");
        return;
    }
    
    if (recurso === 'pv') {
        let atual = parseInt(fPvAtual.textContent) || 0;
        let novo = Math.max(0, atual + valor);
        fPvAtual.textContent = novo;
        if (novo === 0) {
            document.body.style.backgroundColor = "#3a1010";
            setTimeout(() => document.body.style.backgroundColor = "", 500);
        }
    } else if (recurso === 'pi') {
        let atual = parseInt(fPiAtual.textContent) || 0;
        fPiAtual.textContent = Math.max(0, atual + valor);
    }
    salvarFicha();
};

// ==========================================
// 9. INICIALIZAÇÃO
// ==========================================
conectarSala("sala-padrao");