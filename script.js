const WORKER_URL = "https://pokemon.brandenkenn.workers.dev";
let fullCollection = []; // Persistent memory for filtering/sorting

async function fetchTrainerData(username) {
    const nameEl = document.getElementById('trainer-name');
    const display = document.getElementById('pokemon-display');
    
    nameEl.innerText = "LOADING...";
    display.innerHTML = "";

    try {
        const response = await fetch(`${WORKER_URL}?user=${username}&userstats=true&format=json`);
        const data = await response.json();

        if (data.total === 0 && data.collection.length === 0) {
            nameEl.innerText = "NOT FOUND";
            return;
        }

        // Update UI
        nameEl.innerText = username.toUpperCase();
        document.getElementById('trainer-balance').innerText = `₽${data.balance.toLocaleString()}`;
        document.getElementById('trainer-total').innerText = data.total;

        // Store and Render
        fullCollection = data.collection || [];
        renderSprites(fullCollection);

    } catch (e) {
        nameEl.innerText = "ERROR";
    }
}

function renderSprites(list) {
    const display = document.getElementById('pokemon-display');
    display.innerHTML = "";

    list.forEach(entry => {
        if (!entry) return;
        const isShiny = entry.includes('✨');
        const hasPokerus = entry.includes('🦠');
        const name = entry.split('(')[0].replace('✨', '').toLowerCase().trim();

        const img = document.createElement('img');
        img.src = `https://img.pokemondb.net/sprites/home/${isShiny ? 'shiny' : 'normal'}/${name}.png`;
        img.title = entry;
        if (isShiny) img.classList.add('shiny-glow');
        if (hasPokerus) img.classList.add('pokerus-border');
        
        img.onerror = () => img.src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png";
        
        display.appendChild(img);
    });
}

// --- Interaction Listeners ---

// Search for new trainer
document.getElementById('search-btn').addEventListener('click', () => {
    const name = document.getElementById('username-input').value.trim();
    if (name) fetchTrainerData(name);
});

// Filter as you type
document.getElementById('pokemon-filter').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = fullCollection.filter(item => item.toLowerCase().includes(term));
    renderSprites(filtered);
});

// Sort dropdown
document.getElementById('sort-order').addEventListener('change', (e) => {
    const val = e.target.value;
    let sorted = [...fullCollection];

    if (val === "newest") sorted = [...fullCollection]; // Default is Newest (at end of array)
    if (val === "oldest") sorted = [...fullCollection].reverse();
    if (val === "alpha") sorted.sort((a, b) => a.localeCompare(b));
    if (val === "shiny") sorted.sort((a, b) => b.includes('✨') - a.includes('✨'));

    // Note: My renderSprites currently draws in array order. 
    // Since your Worker pushes new catches to the END, "Newest" is actually at the bottom.
    // To show Newest at the TOP, we should reverse the 'sorted' list before rendering.
    renderSprites(sorted.reverse()); 
});

// Initial Load
const urlParams = new URLSearchParams(window.location.search);
fetchTrainerData(urlParams.get('user') || 'dranben');

async function loadShinyLeaderboard() {
    const listEl = document.getElementById('leaderboard-list');
    
    try {
        // We use the 'leaderboard=true' flag we built into your worker
        const response = await fetch(`${WORKER_URL}?leaderboard=true&format=json`);
        const stats = await response.json();

        listEl.innerHTML = `
            <div class="leader-row">
                <span>TOTAL SHINIES</span>
                <span class="leader-count">${stats.shinies}</span>
            </div>
            <div class="leader-row">
                <span>GLOBAL HUNDOS</span>
                <span class="leader-count">${stats.hundos}</span>
            </div>
            <div class="leader-row">
                <span>SHUNDOS FOUND</span>
                <span class="leader-count">${stats.shundos}</span>
            </div>
            <div class="leader-row">
                <span>LEGENDARIES</span>
                <span class="leader-count">${stats.legends}</span>
            </div>
        `;
    } catch (e) {
        listEl.innerHTML = "Offline";
    }
}

// Run this on page load
loadShinyLeaderboard();
