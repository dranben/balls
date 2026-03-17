const WORKER_URL = "https://pokemon.brandenkenn.workers.dev";
let fullCollection = [];
let leaderboardData = null;

// --- TAB NAVIGATION ---
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
        rows.forEach(r => { listEl.innerHTML += `<div class="leader-row"><span>${r[0]}</span><span class="rank-count">${r[1] || 0}</span></div>`; });
    } else {
        const list = leaderboardData.topLists[cat] || [];
        if (list.length === 0) { listEl.innerHTML = '<div class="leader-row">No entries yet!</div>'; return; }
        list.forEach((e, i) => {
            listEl.innerHTML += `<div class="leader-row"><span>#${i+1} ${e.user}</span><span class="rank-count">${e.count}</span></div>`;
        });
    }
}

// --- DATA FETCHING ---
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
    } catch (e) { nameEl.innerText = "ERROR"; }
}

function renderSprites(list) {
    const display = document.getElementById('pokemon-display');
    display.innerHTML = "";
    [...list].reverse().forEach(entry => {
        if (!entry) return;
        const isShiny = entry.includes('✨'), name = entry.split('(')[0].replace('✨', '').toLowerCase().trim();
        const img = document.createElement('img');
        img.src = `https://img.pokemondb.net/sprites/home/${isShiny ? 'shiny' : 'normal'}/${name}.png`;
        img.title = entry;
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
    } catch (e) { listEl.innerHTML = "Offline"; }
}

// --- EVENT LISTENERS ---
document.getElementById('search-btn').addEventListener('click', () => {
    const v = document.getElementById('username-input').value.trim();
    if (v) fetchTrainerData(v);
});

document.getElementById('pokemon-filter').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    renderSprites(fullCollection.filter(i => i.toLowerCase().includes(term)));
});

document.getElementById('sort-order').addEventListener('change', (e) => {
    let s = [...fullCollection];
    if (e.target.value === "alpha") s.sort((a,b) => a.localeCompare(b));
    else if (e.target.value === "shiny") s.sort((a,b) => b.includes('✨') - a.includes('✨'));
    renderSprites(s);
});

// Helper to get Pokedex ID from name (Simplified for common catches)
// If the ID isn't found, it defaults to 9999 so it goes to the end of the list.
async function getPokeId(name) {
    try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`);
        const data = await response.json();
        return data.id;
    } catch (e) {
        return 9999; 
    }
}

window.onload = () => fetchTrainerData(new URLSearchParams(window.location.search).get('user') || 'dranben');
