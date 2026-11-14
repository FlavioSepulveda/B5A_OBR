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
export const salaAtual = "sala-padrao";

export let idJogadorAtual = null;

document.getElementById('btn-login')?.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch((error) => {
        alert("Erro no login. Verifique o domínio no Firebase.");
    });
});

onAuthStateChanged(auth, (user) => {
    const statusLogin = document.getElementById('status-login');
    if (user) {
        idJogadorAtual = user.uid;
        statusLogin.textContent = `✅ ${user.displayName || user.email}`;
        document.getElementById('btn-login').style.display = 'none'; 
        
        // Dispara o evento avisando que o usuário logou e os outros arquivos podem carregar os dados
        window.dispatchEvent(new Event('usuarioLogado')); 
    } else {
        idJogadorAtual = null;
        statusLogin.textContent = "🔴 Faça login para salvar";
        document.getElementById('btn-login').style.display = 'block'; 
    }
});