// --- 1. CONFIGURATION ---
const WORKER_URL = "https://pokemon.brandenkenn.workers.dev";
let fullCollection = []; // Stores the current trainer's catches for filtering/sorting

// --- 2. TAB LOGIC ---
/**
 * Handles switching between Pokedex and Leaderboard views
 * @param {string} tabId - The ID of the view to show
 * @param {Element} btn - The button element that was clicked
 */
function openTab(tabId, btn) {
    // Hide all tab contents
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));

    // Remove active state from all tab buttons
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(button => button.classList.remove('active'));

    // Show the specific tab and mark the button as active
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');

    // If opening the leaderboard, fetch fresh global stats
    if (tabId === 'leaderboard-view') {
        loadShinyLeaderboard();
    }
}

// --- 3. TRAINER DATA FETCHING ---
async function fetchTrainerData(username) {
    const nameEl = document.getElementById('trainer-name');
    const display = document.getElementById('pokemon-display');
    const balanceEl = document.getElementById('trainer-balance');
    const totalEl = document.getElementById('trainer-total');
    
    nameEl.innerText = "LOADING...";
    display.innerHTML = '<div style="color: white; grid-column: 1/-1; text-align: center;">Accessing KV Database...</div>';

    try {
        const response = await fetch(`${WORKER_URL}?user=${encodeURIComponent(username)}&userstats=true&format=json`);
        
        if (!response.ok) throw new Error("Worker Offline");
        
        const data = await response.json();

        if (data.total === 0 && (!data.collection || data.collection.length === 0)) {
            nameEl.innerText = "NOT FOUND";
            display.innerHTML = '<div style="color: #ff4444; grid-column: 1/-1; text-align: center;">No catches recorded for this trainer.</div>';
            balanceEl.innerText = "₽0";
            totalEl.innerText = "0";
            return;
        }

        // Update UI Text
        nameEl.innerText = username.toUpperCase();
        balanceEl.innerText = `₽${(data.balance || 0).toLocaleString()}`;
        totalEl.innerText = data.total || 0;

        // Store globally for filtering/sorting and render
        fullCollection = data.collection || [];
        renderSprites(fullCollection);

    } catch (error) {
        console.error("Fetch Error:", error);
        nameEl.innerText = "ERROR";
        display.innerHTML = `<div style="color: #ff4444; grid-column: 1/-1; text-align: center;">Connection Error: ${error.message}</div>`;
    }
}

// --- 4. SPRITE RENDERING ---
function renderSprites(list) {
    const display = document.getElementById('pokemon-display');
    display.innerHTML = "";

    // We use a reversed copy by default so newest catches appear first
    const itemsToDisplay = [...list].reverse();

    itemsToDisplay.forEach(entry => {
        if (!entry || typeof entry !== 'string') return;

        const isShiny = entry.includes('✨');
        const hasPokerus = entry.includes('🦠');
        const name = entry.split('(')[0].replace('✨', '').toLowerCase().trim();

        const img = document.createElement('img');
        const spritePath = isShiny ? 'shiny' : 'normal';
        
        img.src = `https://img.pokemondb.net/sprites/home/${spritePath}/${name}.png`;
        img.title = entry; // Hover tooltip for IVs
        img.alt = name;
        
        // Error fallback for missing sprites (shows a gray Pokeball)
        img.onerror = () => { 
            img.src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"; 
            img.style.filter = "grayscale(1)";
            img.style.opacity = "0.5";
        };

        if (isShiny) img.classList.add('shiny-glow');
        if (hasPokerus) img.classList.add('pokerus-border');
        
        display.appendChild(img);
    });
}

// --- 5. LEADERBOARD LOGIC ---
async function loadShinyLeaderboard() {
    const listEl = document.getElementById('leaderboard-list');
    listEl.innerHTML = '<div class="leader-row">SYNCING GLOBAL STATS...</div>';

    try {
        const response = await fetch(`${WORKER_URL}?leaderboard=true&format=json`);
        const stats = await response.json();

        listEl.innerHTML = `
            <div class="leader-row"><span>SHINIES FOUND</span> <span class="leader-count">${stats.shinies || 0}</span></div>
            <div class="leader-row"><span>LEGENDARIES</span> <span class="leader-count">${stats.legends || 0}</span></div>
            <div class="leader-row"><span>HUNDOS (100%)</span> <span class="leader-count">${stats.hundos || 0}</span></div>
            <div class="leader-row"><span>NUNDOS (0%)</span> <span class="leader-count">${stats.nundos || 0}</span></div>
            <div class="leader-row"><span>SHUNDOS</span> <span class="leader-count" style="color: gold;">${stats.shundos || 0}</span></div>
        `;
    } catch (e) {
        listEl.innerHTML = '<div class="leader-row" style="color: red;">SERVER ERROR</div>';
    }
}

// --- 6. EVENT LISTENERS ---

// Search Button Click
document.getElementById('search-btn').addEventListener('click', () => {
    const val = document.getElementById('username-input').value.trim();
    if (val) fetchTrainerData(val);
});

// Search on Enter Key
document.getElementById('username-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (val) fetchTrainerData(val);
    }
});

// Filter Collection as you type
document.getElementById('pokemon-filter').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = fullCollection.filter(item => item.toLowerCase().includes(term));
    renderSprites(filtered);
});

// Sort Order Dropdown
document.getElementById('sort-order').addEventListener('change', (e) => {
    const val = e.target.value;
    let sorted = [...fullCollection];

    if (val === "oldest") {
        // Since we reverse() in renderSprites, we pass them as-is to get oldest first
        renderSprites(sorted); 
        return; 
    } 
    
    if (val === "alpha") {
        sorted.sort((a, b) => a.localeCompare(b));
    } else if (val === "shiny") {
        sorted.sort((a, b) => b.includes('✨') - a.includes('✨'));
    }

    // Default "newest" or sorted lists are reversed inside renderSprites
    renderSprites(sorted);
});

// --- 7. INITIAL LOAD ---
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const user = urlParams.get('user') || 'dranben';
    fetchTrainerData(user);
};
