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
        try {
            const res = await fetch(`${WORKER_URL}?login_code=${code}`);
            const authData = await res.json();

            if (authData.status === "success") {
                // MATCHING THE NAMES:
                localStorage.setItem('twitch_user', authData.user);
                localStorage.setItem('auth_token', authData.token); // Make sure this matches the Worker's key

                window.location.href = "/";
                window.history.replaceState({}, document.title, "/");
                updateAuthUI(authData.user);
            }
        } catch (e) { console.error("Login Failed:", e); }
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

    // 1. IDENTITY CHECK: Are you looking at your own storage?
    const loggedInUser = localStorage.getItem('twitch_user');
    const currentTrainer = document.getElementById('trainer-name').innerText.toLowerCase();
    const isOwner = loggedInUser && loggedInUser.toLowerCase() === currentTrainer;

    // Toggle the 'is-owner' class to show/hide the "X" buttons via CSS
    if (isOwner) display.classList.add('is-owner');
    else display.classList.remove('is-owner');

    // 2. CLEANUP: Filter out any nulls or broken entries
    const validList = list.filter(Boolean);

    validList.forEach((entry) => {
        // 3. THE FIX: Find the REAL index in the master collection 
        // This ensures that when you click 'X', the Worker deletes the right one.
        const actualIndex = fullCollection.indexOf(entry);
        
        let name, isShiny, ivs;

        // Handle Object Format
        if (typeof entry === 'object' && entry.n) {
            name = entry.n;
            isShiny = entry.s === 1;
            ivs = entry.iv ? entry.iv.join('/') : '??/??/??';
        } 
        // Handle Legacy String Format
        else if (typeof entry === 'string') {
            isShiny = entry.includes('✨');
            name = entry.split('(')[0].replace('✨', '').toLowerCase().trim();
            ivs = entry.split('(')[1]?.replace(')', '') || '??/??/??';
        } else {
            return; // Skip if it's neither
        }

        // 4. CREATE THE CARD
        const card = document.createElement('div');
        card.className = `pokemon-card ${isShiny ? 'shiny-card' : ''}`;
        
        card.innerHTML = `
            <button class="release-btn" title="Release ${name}" 
                    onclick="releasePokemon(${actualIndex}, '${name}')">×</button>
            <img src="https://img.pokemondb.net/sprites/home/${isShiny ? 'shiny' : 'normal'}/${name.toLowerCase()}.png" 
                 alt="${name}"
                 onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'">
            <div class="pokemon-stats">${ivs}</div>
        `;
        
        display.appendChild(card);
    });
}

async function releasePokemon(index, name) {
    if (!confirm(`Release ${name}?`)) return;

    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('twitch_user');
    
    const res = await fetch(`${WORKER_URL}?user=${user}&release_index=${index}&token=${token}`);
    const message = await res.text();

    alert(message);
    
    // This line is key! It re-runs the fetch to show the updated list
    fetchTrainerData(user); 
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
