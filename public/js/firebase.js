import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

const urlParams = new URLSearchParams(window.location.search);
export let uidPerfilVisitado = urlParams.get('uid'); 
export let idJogadorAtual = null;
export let salaAtual = localStorage.getItem('b5a_sala_atual') || "sala-padrao";

// Configura o Login de forma segura
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btn-login') {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch((error) => {
            console.error("Erro no login:", error);
            alert("Erro no login. Verifique a conexão ou pop-ups.");
        });
    }
});

onAuthStateChanged(auth, (user) => {
    const statusLogin = document.getElementById('status-login');
    const btnLogin = document.getElementById('btn-login');

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