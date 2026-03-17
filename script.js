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
        renderSprites([...fullCollection].reverse());
    } catch (e) { 
        nameEl.innerText = "ERROR"; 
    }
}

function renderSprites(list) {
    const display = document.getElementById('pokemon-display');
    display.innerHTML = "";
    if (!list) return;

    // Filter out nulls/broken entries
    const validList = list.filter(Boolean);

    // REMOVED .reverse() here so it follows the sort order
    validList.forEach(entry => {
        let name, isShiny, title;

        if (typeof entry === 'object' && entry.n) {
            name = entry.n.toLowerCase();
            isShiny = entry.s === 1;
            title = `${isShiny ? '✨' : ''}${entry.n} (${entry.iv.join('/')})`;
        } else if (typeof entry === 'string') {
            isShiny = entry.includes('✨');
            name = entry.split('(')[0].replace('✨', '').toLowerCase().trim();
            title = entry;
        } else { return; }

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
        if (!i) return false; // Skip nulls
        const name = (typeof i === 'object') ? i.n : i;
        // Ensure name is a string before calling includes
        return String(name).toLowerCase().includes(term);
    });
    renderSprites(filtered);
});

document.getElementById('sort-order').addEventListener('change', (e) => {
    const val = e.target.value;
    let sorted = [...fullCollection];

    if (val === "newest") {
        sorted.reverse(); // Manually reverse for Newest first
    } 
    else if (val === "pokedex") {
        sorted.sort((a, b) => {
            const idA = typeof a === 'object' ? a.id : 9999;
            const idB = typeof b === 'object' ? b.id : 9999;
            return idA - idB; // 1 to 1025
        });
    } 
    else if (val === "alpha") {
        sorted.sort((a, b) => {
            const nameA = typeof a === 'object' ? a.n : a;
            const nameB = typeof b === 'object' ? b.n : b;
            return nameA.localeCompare(nameB); // A to Z
        });
    } 
    else if (val === "shiny") {
        sorted.sort((a, b) => {
            const isShinyA = typeof a === 'object' ? a.s : (String(a).includes('✨') ? 1 : 0);
            const isShinyB = typeof b === 'object' ? b.s : (String(b).includes('✨') ? 1 : 0);
            return isShinyB - isShinyA; // Shinies at top
        });
    }
    // "oldest" stays as-is (natural KV order)

    renderSprites(sorted);
});

// --- 6. INITIAL LOAD ---
window.onload = () => {
    handleTwitchRedirect();
    const urlParams = new URLSearchParams(window.location.search);
    fetchTrainerData(urlParams.get('user') || 'dranben');
};
