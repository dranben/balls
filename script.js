// --- 1. CONFIGURATION ---
const WORKER_URL = "https://pokemon.brandenkenn.workers.dev";
const CLIENT_ID = "oqdrp3gkw3lczkb14z6h74ycboupib"; // Replace with your Twitch Client ID
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
    document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const listEl = document.getElementById('leaderboard-list');
    listEl.innerHTML = "";

    if (!leaderboardData) return;

    if (cat === 'global') {
        const g = leaderboardData.global;
        const rows = [
            ["SHINIES", g.shinies], 
            ["LEGENDARIES", g.Legendaries], 
            ["HUNDOS", g.hundos], 
            ["NUNDOS", g.nundos], 
            ["SHUNDOS", g.shundos]
        ];
        rows.forEach(r => { 
            listEl.innerHTML += `<div class="leader-row"><span>${r[0]}</span><span class="rank-count">${r[1] || 0}</span></div>`; 
        });
    } else {
        const list = leaderboardData.topLists[cat] || [];
        if (list.length === 0) { 
            listEl.innerHTML = '<div class="leader-row">No entries yet!</div>'; 
            return; 
        }
        list.forEach((e, i) => {
            listEl.innerHTML += `<div class="leader-row"><span>#${i+1} ${e.user}</span><span class="rank-count">${e.count}</span></div>`;
        });
    }
}

// --- 4. DATA FETCHING ---
async function fetchTrainerData(user) {
    const nameEl = document.getElementById('trainer-name');
    nameEl.innerText = "LOADING...";
    try {
        const res = await fetch(`${WORKER_URL}?user=${encodeURIComponent(user)}&userstats=true&format=json`);
        const data = await res.json();
        
        nameEl.innerText = user.toUpperCase();
        document.getElementById('trainer-balance').innerText = `₽${(data.balance || 0).toLocaleString()}`;
        document.getElementById('trainer-total').innerText = data.total || 0;
        
        fullCollection = data.collection || [];
        renderSprites(fullCollection);
    } catch (e) { 
        nameEl.innerText = "ERROR"; 
    }
}

function renderSprites(list) {
    const display = document.getElementById('pokemon-display');
    display.innerHTML = "";

    // 1. Filter out any null or undefined entries first
    const cleanList = list.filter(entry => entry !== null && entry !== undefined);

    [...cleanList].reverse().forEach(entry => {
        let name, isShiny, title;

        // 2. NEW OBJECT CHECK
        if (typeof entry === 'object' && entry.n) {
            name = entry.n.toLowerCase();
            isShiny = entry.s === 1;
            // Handle IV array safety
            const ivs = entry.iv ? entry.iv.join('/') : '??/??/??';
            title = `${isShiny ? '✨' : ''}${entry.n} (${ivs})`;
        } 
        // 3. LEGACY STRING CHECK
        else if (typeof entry === 'string') {
            isShiny = entry.includes('✨');
            name = entry.split('(')[0].replace('✨', '').toLowerCase().trim();
            title = entry;
        } 
        else {
            return; // Skip if it's neither
        }

        const img = document.createElement('img');
        img.src = `https://img.pokemondb.net/sprites/home/${isShiny ? 'shiny' : 'normal'}/${name}.png`;
        img.title = title;
        if (isShiny) img.classList.add('shiny-glow');
        
        img.onerror = () => img.src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png";
        display.appendChild(img);
    });
}

async function loadShinyLeaderboard() {
    const listEl = document.getElementById('leaderboard-list');
    listEl.innerHTML = '<div class="leader-row">SYNCING...</div>';
    try {
        const res = await fetch(`${WORKER_URL}?leaderboard=true&format=json`);
        leaderboardData = await res.json();
        switchLeaderboard('global', document.querySelector('.sub-btn.active'));
    } catch (e) { 
        listEl.innerHTML = "Offline"; 
    }
}

// --- 5. EVENT LISTENERS ---
document.getElementById('search-btn').addEventListener('click', () => {
    const v = document.getElementById('username-input').value.trim();
    if (v) fetchTrainerData(v);
});

document.getElementById('pokemon-filter').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = fullCollection.filter(i => {
        const name = typeof i === 'object' ? i.n : i;
        return name.toLowerCase().includes(term);
    });
    renderSprites(filtered);
});

document.getElementById('sort-order').addEventListener('change', (e) => {
    const val = e.target.value;
    let sorted = [...fullCollection];

    if (val === "pokedex") {
        sorted.sort((a, b) => {
            const idA = typeof a === 'object' ? a.id : 9999;
            const idB = typeof b === 'object' ? b.id : 9999;
            return idA - idB;
        });
    } else if (val === "alpha") {
        sorted.sort((a, b) => {
            const nameA = typeof a === 'object' ? a.n : a;
            const nameB = typeof b === 'object' ? b.n : b;
            return nameA.localeCompare(nameB);
        });
    } else if (val === "shiny") {
        sorted.sort((a, b) => {
            const isShinyA = typeof a === 'object' ? a.s : (a.includes('✨') ? 1 : 0);
            const isShinyB = typeof b === 'object' ? b.s : (b.includes('✨') ? 1 : 0);
            return isShinyB - isShinyA;
        });
    } else if (val === "oldest") {
        renderSprites(sorted);
        return;
    }

    renderSprites(sorted); // Note: renderSprites reverses the array for display
});

// --- 6. INITIAL LOAD ---
window.onload = () => {
    handleTwitchRedirect();
    const urlParams = new URLSearchParams(window.location.search);
    fetchTrainerData(urlParams.get('user') || 'dranben');
};
