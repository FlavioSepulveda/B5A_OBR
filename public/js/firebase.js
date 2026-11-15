import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = { /* SUAS CONFIGURAÇÕES AQUI */ };

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

// NOVO: Lê o UID da URL para ver perfil de outros jogadores
const urlParams = new URLSearchParams(window.location.search);
export let uidPerfilVisitado = urlParams.get('uid'); 

export let idJogadorAtual = null;
export let salaAtual = localStorage.getItem('b5a_sala_atual') || "sala-padrao";
export let espectroUsuario = "padrao"; // NOVO: Guarda o Espectro do usuário logado

// Exporta uma função para mudar a sala
export function mudarSala(novaSala) {
    salaAtual = novaSala;
    localStorage.setItem('b5a_sala_atual', novaSala);
    window.location.reload(); // Recarrega para aplicar a nova sala
}

document.getElementById('btn-login')?.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch((error) => {
        console.error("Erro no login:", error);
        alert("Erro no login. Verifique o domínio no Firebase.");
    });
});

onAuthStateChanged(auth, (user) => {
    const statusLogin = document.getElementById('status-login');
    if (user) {
        idJogadorAtual = user.uid;
        
        // Puxa o perfil do banco para pegar o Espectro
        get(ref(db, `usuarios/${user.uid}/perfil`)).then((snapshot) => {
            const dados = snapshot.val();
            if (dados && dados.espectro) {
                espectroUsuario = dados.espectro;
                document.body.classList.add(`espectro-${espectroUsuario}`); // Aplica a cor no body inteiro
            }
            
            if(statusLogin) {
                statusLogin.textContent = `✅ ${user.displayName || user.email}`;
                statusLogin.style.color = "var(--gold)";
            }
            if(document.getElementById('btn-login')) document.getElementById('btn-login').style.display = 'none'; 
            
            window.dispatchEvent(new Event('usuarioLogado')); 
        });
    } else {
        idJogadorAtual = null;
        if(statusLogin) {
            statusLogin.textContent = "🔴 Faça login para salvar";
            statusLogin.style.color = "#888";
        }
        if(document.getElementById('btn-login')) document.getElementById('btn-login').style.display = 'block'; 
    }
});