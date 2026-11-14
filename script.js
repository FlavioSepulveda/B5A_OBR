import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, query, limitToLast, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// COLOQUE SUA CONFIGURAÇÃO DO FIREBASE AQUI
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

// Elementos DOM
const salaInput = document.getElementById('sala-id');
const statusLogin = document.getElementById('status-login');
const nomeSalaExibicao = document.getElementById('nome-sala-exibicao');
const btnLogin = document.getElementById('btn-login'); // Vamos criar esse botão no HTML

// ... (referências da ficha continuam iguais) ...

// ==========================================
// 1. LOGIN COM GOOGLE
// ==========================================
// O botão de login precisa estar no HTML. Vamos adicionar um listener nele.
if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch((error) => {
            console.error("Erro no login com Google:", error);
            alert("Não foi possível fazer login. Verifique se o Google está ativado no Firebase.");
        });
    });
}

// Escuta o estado de autenticação (se o usuário logou ou saiu)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuário logado!
        idJogadorAtual = user.uid;
        statusLogin.textContent = `✅ ${user.displayName || user.email}`;
        if (btnLogin) btnLogin.style.display = 'none'; // Esconde o botão de login
        
        // Inicia a ficha com o ID do usuário do Google
        iniciarFicha();
    } else {
        // Usuário deslogado
        idJogadorAtual = null;
        statusLogin.textContent = "🔴 Faça login para salvar sua ficha";
        if (btnLogin) btnLogin.style.display = 'block'; // Mostra o botão
        
        // Limpa a ficha na tela
        document.querySelectorAll('.coluna-ficha input').forEach(i => i.value = '');
        fPvAtual.textContent = '0';
        fPiAtual.textContent = '0';
    }
});

function iniciarFicha() {
    if (!idJogadorAtual) return;
    salaAtual = salaInput.value.trim() || "sala-padrao";
    nomeSalaExibicao.textContent = salaAtual;
    
    // Caminho no banco: salas/ID_SALA/jogadores/ID_DO_GOOGLE
    fichaRef = ref(db, `salas/${salaAtual}/jogadores/${idJogadorAtual}`);

    onValue(fichaRef, (snapshot) => {
        const dados = snapshot.val();
        if (dados) {
            // Preenche a ficha com os dados salvos
            fNome.value = dados.nome || '';
            fEspectro.value = dados.espectro || 'padrao';
            fVolume.value = dados.volume || 1;
            fPvAtual.textContent = dados.pvAtual || 0;
            fPvMax.value = dados.pvMax || 10;
            fPiAtual.textContent = dados.piAtual || 0;
            fPiMax.value = dados.piMax || 5;
            fVigor.value = dados.vigor || '0d4';
            fDinamismo.value = dados.dinamismo || '0d4';
            fRazao.value = dados.razao || '0d4';
            fDeterminacao.value = dados.determinacao || '0d4';
        } else {
            // Se não tem dados, preenche com os valores padrão
            fNome.value = auth.currentUser.displayName || "Arquivista";
            fPvAtual.textContent = '10';
            fPvMax.value = '10';
            fPiAtual.textContent = '5';
            fPiMax.value = '5';
            salvarFicha(); // Salva o padrão no banco
        }
    });
}

// ==========================================
// 2. SALVAR AUTOMATICAMENTE
// ==========================================
function salvarFicha() {
    if (!fichaRef || !idJogadorAtual) return;
    const dados = {
        nome: fNome.value,
        espectro: fEspectro.value,
        volume: parseInt(fVolume.value) || 1,
        pvAtual: parseInt(fPvAtual.textContent) || 0,
        pvMax: parseInt(fPvMax.value) || 0,
        piAtual: parseInt(fPiAtual.textContent) || 0,
        piMax: parseInt(fPiMax.value) || 0,
        vigor: fVigor.value,
        dinamismo: fDinamismo.value,
        razao: fRazao.value,
        determinacao: fDeterminacao.value
    };
    set(fichaRef, dados).catch(e => console.error("Erro ao salvar:", e));
}

document.querySelectorAll('.coluna-ficha input, .coluna-ficha select').forEach(el => {
    el.addEventListener('change', salvarFicha);
});

// ==========================================
// 3. CONTROLE DE VIDA E ÍMPETO
// ==========================================
window.alterarRecurso = function(recurso, valor) {
    // Se não estiver logado, avisa
    if (!idJogadorAtual) {
        alert("Faça login com o Google para salvar sua ficha!");
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

// ... (O resto do código de rolagem e histórico continua igual ao anterior) ...