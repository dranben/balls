const WORKER_URL = "https://pokemon.brandenkenn.workers.dev";
let fullCollection = [];
let leaderboardData = null;

// --- 1. NAVIGATION ---
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
        const rows = [["SHINIES", g.shinies], ["LEGENDARIES", g.Legendaries], ["HUNDOS", g.hundos], ["NUNDOS", g.nundos], ["SHUNDOS", g.shundos]];
        rows.forEach(r => { 
            listEl.innerHTML += `<div class="leader-row"><span>${r[0]}</span><span class="rank-count">${r[1] || 0}</span></div>`; 
        });
    } else {
        const list = leaderboardData.topLists[cat] || [];
        if (list.length === 0) { listEl.innerHTML = '<div class="leader-row">No entries yet!</div>'; return; }
        list.forEach((e, i) => {
            listEl.innerHTML += `<div class="leader-row"><span>#${i+1} ${e.user}</span><span class="rank-count">${e.count}</span></div>`;
        });
    }
}

// --- 2. DATA FETCHING ---
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

// --- 3. RENDER LOGIC (Handles both new Objects and old Strings) ---
function renderSprites(list) {
    const display = document.getElementById('pokemon-display');
    display.innerHTML = "";

    // Reverse so newest is at the top by default
    [...list].reverse().forEach(entry => {
        if (!entry) return;

        let name, isShiny, title;

        // Check if entry is a new Object or an old String
        if (typeof entry === 'object') {
            name = entry.n.toLowerCase();
            isShiny = entry.s === 1;
            title = `${isShiny ? '✨' : ''}${entry.n} (${entry.iv.join('/')})`;
        } else {
            isShiny = entry.includes('✨');
            name = entry.split('(')[0].replace('✨', '').toLowerCase().trim();
            title = entry;
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

// --- 4. EVENT LISTENERS (Sorted & Syntax Checked) ---
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
        // Just render as-is (KV order is oldest first)
        renderSprites(sorted);
        return;
    }

    // Default newest (handled by renderSprites reverse)
    renderSprites(sorted);
});

window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    fetchTrainerData(urlParams.get('user') || 'dranben');
};
