import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// SUAS CONFIGURAÇÕES DO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDVpq__JyU5KTQ6p6zB6DTqey4k2jaEFZo",
  authDomain: "b5at-44d1d.firebaseapp.com",
  databaseURL: "https://b5at-44d1d-default-rtdb.firebaseio.com/",
  projectId: "b5at-44d1d",
  storageBucket: "b5at-44d1d.firebasestorage.app",
  messagingSenderId: "394788459759",
  appId: "1:394788459759:web:7050aa055cec655b88b71a"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

// Lê o UID da URL para ver perfil de outros jogadores
const urlParams = new URLSearchParams(window.location.search);
export let uidPerfilVisitado = urlParams.get('uid'); 

export let idJogadorAtual = null;
// Puxa a sala do localStorage ou usa a padrão
export let salaAtual = localStorage.getItem('b5a_sala_atual') || "sala-padrao";

// Configura o Botão de Login
const btnLogin = document.getElementById('btn-login');
if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch((error) => {
            console.error("Erro no login:", error);
            alert("Erro no login. Verifique a conexão ou o bloqueador de pop-ups.");
        });
    });
}

// Monitora o estado de login
onAuthStateChanged(auth, (user) => {
    const statusLogin = document.getElementById('status-login');
    if (user) {
        idJogadorAtual = user.uid;
        if(statusLogin) {
            statusLogin.textContent = `✅ ${user.displayName || user.email}`;
            statusLogin.style.color = "var(--gold)";
        }
        if(btnLogin) btnLogin.style.display = 'none'; 
    } else {
        idJogadorAtual = null;
        if(statusLogin) {
            statusLogin.textContent = "🔴 Faça login";
            statusLogin.style.color = "#888";
        }
        if(btnLogin) btnLogin.style.display = 'block'; 
    }
});