// --- 1. CONFIGURATION ---
const WORKER_URL = "https://pokemon.brandenkenn.workers.dev";
const CLIENT_ID = "YOUR_TWITCH_CLIENT_ID_HERE"; // Replace with your Twitch Client ID
const REDIRECT_URI = "https://dranben.com";

let fullCollection = [];
let leaderboardData = null;

// --- 2. TWITCH AUTH LOGIC ---
function loginWithTwitch() {
    const scope = "user:read:email"; 
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${scope}`;
    window.location.href = authUrl;
}

async function handleTwitchRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        const loginBtn = document.getElementById('login-btn');
        loginBtn.innerText = "VERIFYING...";
        
        try {
            const res = await fetch(`${WORKER_URL}?login_code=${code}`);
            const authData = await res.json();

            if (authData.status === "success") {
                localStorage.setItem('twitch_user', authData.user);
                localStorage.setItem('auth_token', authData.session_token);
                
                // Clean URL and Refresh
                window.history.replaceState({}, document.title, "/");
                updateAuthUI(authData.user);
            }
        } catch (e) {
            console.error("Auth Error:", e);
            loginBtn.innerText = "LOGIN FAILED";
        }
    } else {
        const savedUser = localStorage.getItem('twitch_user');
        if (savedUser) updateAuthUI(savedUser);
    }
}

function updateAuthUI(username) {
    document.getElementById('login-btn').style.display = 'none';
    const display = document.getElementById('user-display');
    display.innerText = `LOGGED IN: ${username.toUpperCase()}`;
    display.style.display = 'inline-block';
}

// --- 3. TAB NAVIGATION ---
function openTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');

    if (tabId === 'leaderboard-view') loadShinyLeaderboard();
}

function switchLeaderboard(cat, btn) {
    document.querySelectorAll('.sub-btn
