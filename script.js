const CLIENT_ID = "oqdrp3gkw3lczkb14z6h74ycboupib"; 
const REDIRECT_URI = "https://dranben.com";
const WORKER_URL = "https://pokemon.brandenkenn.workers.dev";

let fullCollection = []; 

// --- 1. INITIALIZATION ---
let isSavingFavorite = false;

window.onload = async () => {
    console.log("OS Initializing...");
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

    // 1. Start the data fetch
    fetchTrainerData(userToLoad);
    
    // 2. WAKE UP THE BUTTONS
    initTabs(); 
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
        
        if (statTotal) statTotal.innerText = (data.collection ? data.collection.length : 0);
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

    const loggedInUser = localStorage.getItem('twitch_user');
    const trainerNameSpan = document.getElementById('trainer-name');
    const currentTrainer = trainerNameSpan ? trainerNameSpan.innerText.toLowerCase() : '';
    const isOwner = loggedInUser && loggedInUser.toLowerCase() === currentTrainer;

    if (isOwner) document.body.classList.add('is-owner');
    else document.body.classList.remove('is-owner');

    list.forEach((item) => {
        const actualIndex = item.originalIndex !== undefined ? item.originalIndex : fullCollection.indexOf(item);
        
        let name, isShiny, atk, def, hp, hasPokerus;

        if (typeof item === 'object' && item.n) {
            name = item.n;
            isShiny = item.s === 1;
            hasPokerus = item.p === 1;
            [atk, def, hp] = item.iv || [0, 0, 0];
        } 
        else if (typeof item === 'string') {
            isShiny = item.includes('✨');
            hasPokerus = false;
            name = item.split('(')[0].replace('✨', '').trim();
            const ivMatch = item.match(/\((.*?)\)/);
            [atk, def, hp] = ivMatch ? ivMatch[1].split('/').map(Number) : [0, 0, 0];
        } else {
            return; 
        }

        const isFavorited = (item.fav !== undefined && item.fav >= 0 && item.fav <= 3);

        const card = document.createElement('div');
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

        card.onclick = (e) => {
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
        const slotDiv = document.getElementById(`fav-${i}`);
        if (slotDiv && slotDiv.innerHTML.includes('EMPTY')) { slot = i; break; }
    }
    if (slot !== -1) updateFavorite(slot, index);
    else {
        const chosen = await customPromptSlot();
        if (chosen) updateFavorite(chosen - 1, index);
    }
}

let isBusyUpdating = false; 

async function updateFavorite(slot, pokeIndex) {
    if (isBusyUpdating) return; 
    isBusyUpdating = true;

    try {
        const rawUser = localStorage.getItem('twitch_user') || "";
        const user = rawUser.toLowerCase(); 
        const token = localStorage.getItem('auth_token');
        const targetPoke = fullCollection[pokeIndex];

        if (!targetPoke) return;

        if (slot === -1) {
            delete targetPoke.fav; 
        } else {
            fullCollection.forEach(p => { if (p.fav === slot) delete p.fav; });
            targetPoke.fav = slot;
        }

        const tempFavorites = [null, null, null, null];
        fullCollection.forEach(p => {
            if (p.fav !== undefined && p.fav >= 0 && p.fav <= 3) {
                tempFavorites[p.fav] = p;
            }
        });
        
        updateFavoriteUI(tempFavorites);
        applySortAndRender(document.getElementById('sort-order').value);

        const res = await fetch(`${WORKER_URL}?user=${user}&set_favorite=true&slot=${slot}&index=${pokeIndex}&token=${token}`);
        if (!res.ok) { fetchTrainerData(user); }
    } catch (e) {
        console.error("Network error:", e);
    } finally {
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
    const modal = document.getElementById('detail-modal');
    const innerCard = document.getElementById('detail-card-inner');
    const dexElement = document.getElementById('detail-dex-entry');
    const typesContainer = document.getElementById('detail-types');
    const closeBtn = document.getElementById('close-detail');

    if (!modal || !innerCard) return;

    const close = () => {
        innerCard.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 400);
    };
    closeBtn.onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    const isShiny = pokeData.s === 1;
    const name = pokeData.n || "Unknown";
    const id = pokeData.id || 0;

    if (isShiny) innerCard.classList.add('is-shiny');
    else innerCard.classList.remove('is-shiny');

    document.getElementById('detail-name').innerText = name.toUpperCase() + (isShiny ? " ✨" : "");
    document.getElementById('detail-img').src = `https://img.pokemondb.net/sprites/home/${isShiny ? 'shiny' : 'normal'}/${name.toLowerCase()}.png`;
    
    const [atk, def, hp] = pokeData.iv || [0, 0, 0];
    document.getElementById('detail-atk').innerText = atk;
    document.getElementById('detail-def').innerText = def;
    document.getElementById('detail-hp').innerText = hp;
    
    if (dexElement) dexElement.innerText = "Accessing global Pokédex...";
    if (typesContainer) typesContainer.innerHTML = "";

    modal.classList.remove('hidden');
    setTimeout(() => innerCard.classList.add('show'), 10);

    try {
        const query = id || name.toLowerCase();
        const [speciesRes, pokemonRes] = await Promise.all([
            fetch(`https://pokeapi.co/api/v2/pokemon-species/${query}`),
            fetch(`https://pokeapi.co/api/v2/pokemon/${query}`)
        ]);
        const speciesData = await speciesRes.json();
        const pokemonData = await pokemonRes.json();
        if (typesContainer) {
            typesContainer.innerHTML = "";
            pokemonData.types.forEach(t => {
                typesContainer.innerHTML += `<span class="type-bubble type-${t.type.name}">${t.type.name}</span>`;
            });
        }
        const entry = speciesData.flavor_text_entries.find(f => f.language.name === "en");
        if (dexElement) dexElement.innerText = entry ? `"${entry.flavor_text.replace(/\f|\n/g, ' ')}"` : "No entry found.";
    } catch (e) {
        if (dexElement) dexElement.innerText = "Error: Database connection lost.";
    }
}

document.getElementById('open-drawer').onclick = () => document.getElementById('info-drawer').classList.remove('hidden');
document.getElementById('close-drawer').onclick = () => document.getElementById('info-drawer').classList.add('hidden');

// --- SYSTEM REPAIR ENGINE ---
const repairBtn = document.getElementById('repair-btn');
if (repairBtn) {
    repairBtn.onclick = async () => {
        const isSure = await customConfirm("This will log you out and reset your settings. Repair now?");
        if (isSure) {
            localStorage.clear();
            window.location.href = window.location.pathname;
        }
    };
}

// --- 9. TAB CONTROLLER (Updated Fix) ---
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    console.log("Found tabs:", tabs.length); // Should say 3

    tabs.forEach(button => {
        button.onclick = () => { // Using .onclick directly is more reliable for debugging
            const targetTab = button.getAttribute('data-tab');
            console.log("Switching to tab:", targetTab);

            // 1. Reset Buttons
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // 2. Reset Content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
                content.style.display = 'none';
            });

            // 3. Show Target
            const targetEl = document.getElementById(`${targetTab}-tab`);
            if (targetEl) {
                targetEl.classList.add('active');
                targetEl.style.display = 'block';
            }

            // 4. Load Data
            if (targetTab === 'market') loadMarket();
            if (targetTab === 'inventory') loadInventory();
            if (targetTab === 'collection') fetchTrainerData(document.getElementById('trainer-name').innerText.toLowerCase());
        };
    });
}

// Add this line inside your window.onload function at the very bottom
// window.onload = async () => { ... initTabs(); }
// --- 10. LOAD MARKET (POKÉ MART) ---
async function loadMarket() {
    const marketList = document.getElementById('market-list');
    marketList.innerHTML = "<p class='section-title'>CONNECTING TO MART...</p>";

    try {
        const res = await fetch(`${WORKER_URL}?get_market=true`);
        const items = await res.json();
        marketList.innerHTML = ""; 

        Object.values(items).forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <div class="item-icon">${item.icon}</div>
                <div class="item-name">${item.name.toUpperCase()}</div>
                <div class="item-desc">${item.desc}</div>
                <div class="item-price">₽${item.price.toLocaleString()}</div>
                <button class="buy-btn" onclick="buyItem('${item.id}')">PURCHASE</button>
            `;
            marketList.appendChild(card);
        });
    } catch (err) {
        marketList.innerHTML = "<p class='section-title' style='color:red;'>MART OFFLINE</p>";
    }
}

// --- 11. LOAD INVENTORY (MY BAG) ---
async function loadInventory() {
    const invList = document.getElementById('inventory-list');
    const trainerName = document.getElementById('trainer-name').innerText.toLowerCase();
    invList.innerHTML = "<p class='section-title'>OPENING BAG...</p>";

    try {
        const res = await fetch(`${WORKER_URL}?user=${trainerName}`);
        const data = await res.json();
        const inventory = data.inventory || {};
        
        const marketRes = await fetch(`${WORKER_URL}?get_market=true`);
        const catalog = await marketRes.json();

        invList.innerHTML = ""; 

        const itemKeys = Object.keys(inventory);
        if (itemKeys.length === 0) {
            invList.innerHTML = "<p class='section-title' style='color:#555;'>YOUR BAG IS EMPTY</p>";
            return;
        }

        itemKeys.forEach(itemId => {
            const count = inventory[itemId];
            const itemInfo = catalog[itemId];
            if (!itemInfo || count <= 0) return;

            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <div class="item-icon">${itemInfo.icon}</div>
                <div class="item-name">${itemInfo.name.toUpperCase()} (x${count})</div>
                <div class="item-desc">${itemInfo.desc}</div>
                <button class="use-btn" onclick="useItem('${itemId}')">USE ITEM</button>
            `;
            invList.appendChild(card);
        });
    } catch (err) {
        invList.innerHTML = "<p class='section-title' style='color:red;'>ERROR ACCESSING BAG</p>";
    }
}

// --- 12. BUY ITEM LOGIC ---
async function buyItem(itemId) {
    const token = localStorage.getItem('auth_token'); // Standardized to match handleTwitchRedirect
    const trainerName = document.getElementById('trainer-name').innerText.toLowerCase();

    if (!token) {
        alert("Please login with Twitch to purchase items!");
        return;
    }

    try {
        const res = await fetch(`${WORKER_URL}?buy_item_id=${itemId}&user=${trainerName}&token=${token}`);
        const result = await res.json();

        if (result.error) {
            alert(result.error);
        } else {
            alert(`Successfully purchased ${itemId}!`);
            if (document.getElementById('stat-balance')) {
                document.getElementById('stat-balance').innerText = result.balance.toLocaleString();
            }
            loadMarket(); 
        }
    } catch (err) {
        alert("Transaction failed.");
    }
}

// --- 13. USE ITEM (PLACEHOLDER) ---
async function useItem(itemId) {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('twitch_user');
    
    if (!token || !user) {
        alert("Authentication error.");
        return;
    }

    if (await customConfirm(`Do you want to use 1x ${itemId.replace('-', ' ').toUpperCase()}?`)) {
        alert("Using items is coming in the next update! Stay tuned.");
        // We'll build the backend for this in the next step
    }
}
