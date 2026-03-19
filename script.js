const CLIENT_ID = "oqdrp3gkw3lczkb14z6h74ycboupib"; 
const REDIRECT_URI = "https://dranben.com";
const WORKER_URL = "https://pokemon.brandenkenn.workers.dev";

let fullCollection = []; 

// --- 1. INITIALIZATION ---
let isSavingFavorite = false;

window.onload = async () => {
    await handleTwitchRedirect();

    const urlParams = new URLSearchParams(window.location.search);
    const urlUser = urlParams.get('user');
    const loggedInUser = localStorage.getItem('twitch_user');

    const userToLoad = urlUser || loggedInUser || 'dranben';

    const inputField = document.getElementById('username-input');
    if (inputField) {
        inputField.value = urlUser || loggedInUser || "";
    }

    const savedSort = localStorage.getItem('preferred_sort') || 'newest';
    const sortDropdown = document.getElementById('sort-order');
    if (sortDropdown) {
        sortDropdown.value = savedSort;
    }

    fetchTrainerData(userToLoad);
};

// --- 2. TWITCH AUTH & SESSION MANAGEMENT ---
async function handleTwitchRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        try {
            const res = await fetch(`${WORKER_URL}?login_code=${code}`);
            const authData = await res.json();

            if (authData.status === "success") {
                localStorage.setItem('twitch_user', authData.user);
                localStorage.setItem('auth_token', authData.token);
                window.history.replaceState({}, document.title, window.location.pathname);
                updateAuthUI(authData.user);
            }
        } catch (e) {
            console.error("Auth Handshake Failed:", e);
        }
    } else {
        checkSession();
    }
}

function checkSession() {
    const savedUser = localStorage.getItem('twitch_user');
    const savedToken = localStorage.getItem('auth_token');
    if (savedUser && savedToken && savedToken !== "undefined") {
        updateAuthUI(savedUser);
    }
}

function updateAuthUI(username) {
    const loginBtn = document.getElementById('login-btn');
    const userDisplay = document.getElementById('user-display');
    if (loginBtn && userDisplay) {
        loginBtn.style.display = 'none';
        userDisplay.innerText = `TRAINER: ${username.toUpperCase()}`;
        userDisplay.style.display = 'inline-block';
    }
}

// --- 3. DATA FETCHING ---
async function fetchTrainerData(username) {
    const display = document.getElementById('pokemon-display');
    const trainerNameSpan = document.getElementById('trainer-name');
    const statTotal = document.getElementById('stat-total');
    const statBalance = document.getElementById('stat-balance');
    
    if (trainerNameSpan) trainerNameSpan.innerText = username.toUpperCase();
    if (display) display.innerHTML = "<p class='loading'>Scanning Storage Units...</p>";

    try {
        const res = await fetch(`${WORKER_URL}?user=${username}&userstats=true`);
        const data = await res.json();
        
        if (statTotal) statTotal.innerText = data.total || 0;
        if (statBalance) statBalance.innerText = data.balance?.toLocaleString() || 0;

        fullCollection = (data.collection || []).filter(Boolean);
        updateFavoriteUI(data.favorites);

        const sortOrder = document.getElementById('sort-order');
        const currentSort = sortOrder ? sortOrder.value : 'newest';
        applySortAndRender(currentSort);
        
    } catch (e) {
        if (display) display.innerHTML = "<p>Error: Storage unit is offline.</p>";
    }
}

// --- 4. FAVORITES UI UPDATER ---
function updateFavoriteUI(favorites) {
    const loggedInUser = localStorage.getItem('twitch_user');
    const trainerNameSpan = document.getElementById('trainer-name');
    const currentTrainer = trainerNameSpan ? trainerNameSpan.innerText.toLowerCase() : '';
    const isOwner = loggedInUser && loggedInUser.toLowerCase() === currentTrainer;

    for (let i = 0; i < 4; i++) {
        const slotDiv = document.getElementById(`fav-${i}`);
        if (!slotDiv) continue;
        const data = favorites && favorites[i];
        
        if (data) {
            const isShiny = data.s === 1;
            const name = data.n;
            const [atk, def, hp] = data.iv || [0, 0, 0];
            const imgSrc = `https://img.pokemondb.net/sprites/home/${isShiny ? 'shiny' : 'normal'}/${name.toLowerCase()}.png`;
            const pokeIndex = fullCollection.findIndex(p => p.fav === i);

            slotDiv.innerHTML = `
                ${isOwner ? `<button class="fav-btn active" title="Remove" onclick="toggleFavoriteDialog(${pokeIndex})">★</button>` : ''}
                <div class="fav-name ${isShiny ? 'shiny-text' : ''}">${name.toUpperCase()}</div>
                <img src="${imgSrc}" alt="${name}">
                <div class="fav-stats">
                    <span class="${atk === 15 ? 'perfect-stat' : ''}">${atk}</span>/<span class="${def === 15 ? 'perfect-stat' : ''}">${def}</span>/<span class="${hp === 15 ? 'perfect-stat' : ''}">${hp}</span>
                </div>
            `;
        } else {
            slotDiv.innerHTML = `<div class="fav-name">EMPTY</div><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" alt="Empty"><div class="fav-stats">-/-/-</div>`;
        }
    }
}

// --- 5. THE RENDERING ENGINE ---
function renderSprites(list) {
    const display = document.getElementById('pokemon-display');
    if (!display) return;
    
    display.innerHTML = "";
    if (!list || list.length === 0) {
        display.innerHTML = "<p>No Pokémon found in this storage unit.</p>";
        return;
    }

    // Check if the person viewing is the owner of this collection
    const loggedInUser = localStorage.getItem('twitch_user');
    const trainerNameSpan = document.getElementById('trainer-name');
    const currentTrainer = trainerNameSpan ? trainerNameSpan.innerText.toLowerCase() : '';
    const isOwner = loggedInUser && loggedInUser.toLowerCase() === currentTrainer;

    // Attach ownership class to the body so CSS can reveal buttons
    if (isOwner) document.body.classList.add('is-owner');
    else document.body.classList.remove('is-owner');

    list.forEach((item) => {
        // Use the originalIndex we mapped in fetchTrainerData or sorting
        const actualIndex = item.originalIndex !== undefined ? item.originalIndex : fullCollection.indexOf(item);
        
        let name, isShiny, atk, def, hp, hasPokerus;

        // Modern Object Handling
        if (typeof item === 'object' && item.n) {
            name = item.n;
            isShiny = item.s === 1;
            hasPokerus = item.p === 1;
            [atk, def, hp] = item.iv || [0, 0, 0];
        } 
        // Legacy String Handling
        else if (typeof item === 'string') {
            isShiny = item.includes('✨');
            hasPokerus = false;
            name = item.split('(')[0].replace('✨', '').trim();
            const ivMatch = item.match(/\((.*?)\)/);
            [atk, def, hp] = ivMatch ? ivMatch[1].split('/').map(Number) : [0, 0, 0];
        } else {
            return; 
        }

        // Check if this Pokemon is a favorite 
        const isFavorited = (item.fav !== undefined && item.fav >= 0 && item.fav <= 3);

        const card = document.createElement('div');
        // Adds 'shiny-card' class for the holographic CSS effect
        card.className = `pokemon-card ${isShiny ? 'shiny-card' : ''}`;
        
        card.innerHTML = `
            <button class="release-btn" title="Release ${name}" 
                    onclick="releasePokemon(${actualIndex}, '${name}')">×</button>
            
            <button class="fav-btn ${isFavorited ? 'active' : ''}" title="${isFavorited ? 'Remove Favorite' : 'Set Favorite'}"
                    onclick="toggleFavoriteDialog(${actualIndex})">★</button>
            
            <div class="pokemon-name">${name.toUpperCase()}</div>
            ${hasPokerus ? '<div class="pokerus-tag">🧬 POKERUS</div>' : ''}
            
            <img src="https://img.pokemondb.net/sprites/home/${isShiny ? 'shiny' : 'normal'}/${name.toLowerCase()}.png" 
                 alt="${name}"
                 onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'">
            
            <div class="stats-box">
                <div class="stat-row">
                    <span class="stat-label">ATK</span>
                    <span class="stat-value ${atk === 15 ? 'perfect-stat' : ''}">${atk}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">DEF</span>
                    <span class="stat-value ${def === 15 ? 'perfect-stat' : ''}">${def}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">STA</span>
                    <span class="stat-value ${hp === 15 ? 'perfect-stat' : ''}">${hp}</span>
                </div>
            </div>
        `;

        // Handle the flip animation / Pokedex detail view
        card.onclick = (e) => {
            // Do not flip if they clicked a button
            if (e.target.tagName.toLowerCase() === 'button') return;
            openDetailModal(item);
        };

        display.appendChild(card);
    });
}

// --- 6. ACTIONS ---
async function releasePokemon(index, name) {
    const isSure = await customConfirm(`Release ${name}? This cannot be undone.`);
    if (!isSure) return;
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('twitch_user');
    
    try {
        const res = await fetch(`${WORKER_URL}?user=${user}&release_index=${index}&token=${token}`);
        if (res.ok) {
            await showSuccessModal(`${name.toUpperCase()} has been released into the wild!`);
            fetchTrainerData(user); 
        } else {
            alert("Server rejected the release.");
        }
    } catch (e) { 
        alert("Server communication error."); 
    }
}

async function toggleFavoriteDialog(index) {
    const poke = fullCollection[index];
    if (poke.fav !== undefined && poke.fav >= 0 && poke.fav <= 3) {
        if (await customConfirm(`Unfavorite ${poke.n}?`)) updateFavorite(-1, index);
        return; 
    }
    let slot = -1;
    for (let i = 0; i < 4; i++) {
        const img = document.querySelector(`#fav-${i} img`);
        if (img && img.src.includes('poke-ball.png')) { slot = i; break; }
    }
    if (slot !== -1) updateFavorite(slot, index);
    else {
        const chosen = await customPromptSlot();
        if (chosen) updateFavorite(chosen - 1, index);
    }
}

let isBusyUpdating = false; // Internal lock

async function updateFavorite(slot, pokeIndex) {
    if (isBusyUpdating) return; 
    isBusyUpdating = true;

    try {
        const user = localStorage.getItem('twitch_user');
        const token = localStorage.getItem('auth_token');
        const targetPoke = fullCollection[pokeIndex];

        // 1. OPTIMISTIC UI (Instant change for the user)
        if (slot === -1) {
            delete targetPoke.fav; 
        } else {
            // Remove this slot from any other mon first
            fullCollection.forEach(p => { if (p.fav === slot) delete p.fav; });
            targetPoke.fav = slot;
        }

        // 2. REDRAW UI IMMEDIATELY
        const tempFavorites = [null, null, null, null];
        fullCollection.forEach(p => {
            if (p.fav !== undefined && p.fav >= 0 && p.fav <= 3) {
                tempFavorites[p.fav] = p;
            }
        });
        
        updateFavoriteUI(tempFavorites);
        applySortAndRender(document.getElementById('sort-order').value);

        // 3. BACKGROUND SAVE
        const res = await fetch(`${WORKER_URL}?user=${user}&set_favorite=true&slot=${slot}&index=${pokeIndex}&token=${token}`);
        
        if (!res.ok) {
            console.error("Server rejected save. Syncing...");
            fetchTrainerData(user); // If it failed, pull the "truth" from the DB
        }
    } catch (e) {
        console.error("Network error during favorite update:", e);
    } finally {
        // This line is CRITICAL. It runs no matter what happens above.
        isBusyUpdating = false; 
    }
}

// --- 7. LISTENERS ---
const filterInput = document.getElementById('pokemon-filter');
if (filterInput) {
    filterInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = fullCollection.map((p, i) => ({...p, originalIndex: i}))
                         .filter(p => p.n.toLowerCase().includes(term));
        renderSprites(filtered);
    });
}

const sortOrder = document.getElementById('sort-order');
if (sortOrder) {
    sortOrder.addEventListener('change', (e) => {
        localStorage.setItem('preferred_sort', e.target.value);
        applySortAndRender(e.target.value);
    });
}

function applySortAndRender(val) {
    let list = fullCollection.map((p, i) => ({ ...p, originalIndex: i }));
    if (val === "newest") list.reverse();
    else if (val === "pokedex") list.sort((a, b) => (a.id || 0) - (b.id || 0));
    else if (val === "alpha") list.sort((a, b) => a.n.localeCompare(b.n));
    else if (val === "shiny") list.sort((a, b) => b.s - a.s);
    renderSprites(list);
}

// --- 8. MODALS & UI ---
function customConfirm(msg) {
    return new Promise(res => {
        const m = document.getElementById('custom-modal');
        document.getElementById('modal-text').innerText = msg;
        m.classList.remove('hidden');
        document.getElementById('modal-btn-yes').onclick = () => { m.classList.add('hidden'); res(true); };
        document.getElementById('modal-btn-no').onclick = () => { m.classList.add('hidden'); res(false); };
    });
}

function customPromptSlot() {
    return new Promise(res => {
        const m = document.getElementById('slot-modal');
        m.classList.remove('hidden');
        document.querySelectorAll('.slot-btn').forEach(b => b.onclick = (e) => { m.classList.add('hidden'); res(parseInt(e.target.dataset.slot)); });
        document.getElementById('slot-cancel').onclick = () => { m.classList.add('hidden'); res(null); };
    });
}

function showSuccessModal(message) {
    return new Promise(res => {
        const m = document.getElementById('success-modal');
        document.getElementById('success-text').innerText = message;
        m.classList.remove('hidden');
        document.getElementById('success-close').onclick = () => {
            m.classList.add('hidden');
            res();
        };
    });
}

async function openDetailModal(pokeData) {
    // 1. Get UI Elements
    const modal = document.getElementById('detail-modal');
    const innerCard = document.getElementById('detail-card-inner');
    const dexElement = document.getElementById('detail-dex-entry');
    const typesContainer = document.getElementById('detail-types');
    const closeBtn = document.getElementById('close-detail');

    if (!modal || !innerCard) {
        console.error("Modal elements not found in HTML!");
        return;
    }

    // 2. Setup Closing Logic (Safe & Early)
    const close = () => {
        innerCard.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 400);
    };
    closeBtn.onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    // 3. Populate Basic Data (Pre-Fetch)
    const isShiny = pokeData.s === 1;
    const name = pokeData.n || "Unknown";
    const id = pokeData.id || 0;

    // Apply the Shiny Glow class to the expanded card
    if (isShiny) {
        innerCard.classList.add('is-shiny');
    } else {
        innerCard.classList.remove('is-shiny');
    }

    document.getElementById('detail-name').innerText = name.toUpperCase() + (isShiny ? " ✨" : "");
    document.getElementById('detail-img').src = `https://img.pokemondb.net/sprites/home/${isShiny ? 'shiny' : 'normal'}/${name.toLowerCase()}.png`;
    
    const [atk, def, hp] = pokeData.iv || [0, 0, 0];
    document.getElementById('detail-atk').innerText = atk;
    document.getElementById('detail-def').innerText = def;
    document.getElementById('detail-hp').innerText = hp;
    
    // Set loading states
    if (dexElement) dexElement.innerText = "Accessing global Pokédex...";
    if (typesContainer) typesContainer.innerHTML = "";

    // 4. Trigger the Flip Animation
    modal.classList.remove('hidden');
    setTimeout(() => innerCard.classList.add('show'), 10);

    // 5. Fetch Live API Data (Types & Lore)
    try {
        const query = id || name.toLowerCase();
        const [speciesRes, pokemonRes] = await Promise.all([
            fetch(`https://pokeapi.co/api/v2/pokemon-species/${query}`),
            fetch(`https://pokeapi.co/api/v2/pokemon/${query}`)
        ]);
        
        const speciesData = await speciesRes.json();
        const pokemonData = await pokemonRes.json();
        
        // Build Type Bubbles
        if (typesContainer) {
            typesContainer.innerHTML = "";
            pokemonData.types.forEach(t => {
                typesContainer.innerHTML += `<span class="type-bubble type-${t.type.name}">${t.type.name}</span>`;
            });
        }

        // Find English Pokedex Entry
        const entry = speciesData.flavor_text_entries.find(f => f.language.name === "en");
        if (dexElement) {
            dexElement.innerText = entry ? `"${entry.flavor_text.replace(/\f|\n/g, ' ')}"` : "No entry found.";
        }
    } catch (e) {
        console.error("Dex Fetch Error:", e);
        if (dexElement) dexElement.innerText = "Error: Database connection lost.";
    }
}
document.getElementById('open-drawer').onclick = () => document.getElementById('info-drawer').classList.remove('hidden');
document.getElementById('close-drawer').onclick = () => document.getElementById('info-drawer').classList.add('hidden');
