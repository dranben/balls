const CLIENT_ID = "oqdrp3gkw3lczkb14z6h74ycboupib"; 
const REDIRECT_URI = "https://dranben.com";
const WORKER_URL = "https://pokemon.brandenkenn.workers.dev";

let fullCollection = []; 

// --- 1. INITIALIZATION ---
window.onload = async () => {
    // 1. Handle Twitch redirect/session
    await handleTwitchRedirect();

    const urlParams = new URLSearchParams(window.location.search);
    const urlUser = urlParams.get('user');
    const loggedInUser = localStorage.getItem('twitch_user');

    // 2. DATA LOGIC
    const userToLoad = urlUser || loggedInUser || 'dranben';

    // 3. INPUT LOGIC
    const inputField = document.getElementById('username-input');
    if (inputField) {
        inputField.value = urlUser || loggedInUser || "";
    }

    // NEW: Load saved sort preference
    const savedSort = localStorage.getItem('preferred_sort') || 'newest';
    const sortDropdown = document.getElementById('sort-order');
    if (sortDropdown) {
        sortDropdown.value = savedSort;
    }

    // 4. Load the actual Pokemon
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

        // 1. Load the master list
        fullCollection = (data.collection || []).filter(Boolean);
        
        // 2. Update Favorites (now that collection is in memory)
        updateFavoriteUI(data.favorites);

        // 3. Handle the Sorting & Initial Draw
        const sortOrder = document.getElementById('sort-order');
        const currentSort = sortOrder ? sortOrder.value : 'newest';
        
        // This function handles both the mapping and the final renderSprites call!
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
            
            // Smart Search: Find this exact Pokemon in the master list using its 'fav' tag
            const pokeIndex = fullCollection.findIndex(p => p.fav === i);

            slotDiv.innerHTML = `
                ${isOwner ? `<button class="fav-btn active" title="Remove Favorite" onclick="toggleFavoriteDialog(${pokeIndex})">★</button>` : ''}
                <div class="fav-name ${isShiny ? 'shiny-text' : ''}">${name.toUpperCase()}</div>
                <img src="${imgSrc}" alt="${name}">
                <div class="fav-stats">
                    <span class="${atk === 15 ? 'perfect-stat' : ''}">${atk}</span>/<span class="${def === 15 ? 'perfect-stat' : ''}">${def}</span>/<span class="${hp === 15 ? 'perfect-stat' : ''}">${hp}</span>
                </div>
            `;
        } else {
            slotDiv.innerHTML = `
                <div class="fav-name">EMPTY</div>
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" alt="Empty">
                <div class="fav-stats">-/-/-</div>
            `;
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

    // Attach ownership class to the body so CSS can reveal buttons
    if (isOwner) document.body.classList.add('is-owner');
    else document.body.classList.remove('is-owner');

    list.forEach((item) => {
        // Use the originalIndex we mapped in fetchTrainerData, or default to indexOf for legacy arrays
        const actualIndex = item.originalIndex !== undefined ? item.originalIndex : fullCollection.indexOf(item);
        
        let name, isShiny, atk, def, hp, hasPokerus;

        if (typeof item === 'object' && item.n) {
            name = item.n;
            isShiny = item.s === 1;
            hasPokerus = item.p === 1;
            [atk, def, hp] = item.iv || [0, 0, 0];
        } else if (typeof item === 'string') {
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
        card.className = `pokemon-card ${isShiny ? 'shiny-card' : ''}`;
        
        // Update the button to use the 'active' class 
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
        // ---> NEW: Add the click event to open the Pokedex <---
        card.onclick = (e) => {
            // Ignore the click if they clicked a button (like favorite or release)
            if (e.target.tagName.toLowerCase() === 'button') return;
            openDetailModal(item);
        };
        display.appendChild(card);
    });
}

// --- 6. USER ACTIONS (Release & Favorite) ---
async function releasePokemon(index, name) {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('twitch_user');

    if (!token || token === "undefined") {
        alert("Authentication required. Please login with Twitch.");
        return;
    }

    const isSure = await customConfirm(`Are you sure you want to release ${name}? This cannot be undone.`);
    if (!isSure) return;

    try {
        const res = await fetch(`${WORKER_URL}?user=${user}&release_index=${index}&token=${token}`);
        const result = await res.text();
        
        alert(result);
        fetchTrainerData(user); 
    } catch (e) {
        alert("Server communication failed.");
    }
}

async function toggleFavoriteDialog(index) {
    if (index === -1) return; 
    const poke = fullCollection[index];

    // 1. CHECK IF ALREADY FAVORITED (The Un-favorite trigger)
    if (poke.fav !== undefined && poke.fav >= 0 && poke.fav <= 3) {
        
        // ---> THIS IS THE NEW CUSTOM BOX <---
        const isSure = await customConfirm(`Are you sure you want to unfavorite ${poke.n}?`);
        
        if (isSure) {
            updateFavorite(-1, index);
        }
        return; 
    }
    // 2. ADD NEW FAVORITE LOGIC
    let availableSlot = -1;

    for (let i = 0; i < 4; i++) {
        const img = document.querySelector(`#fav-${i} img`);
        if (img && img.src.includes('poke-ball.png')) {
            availableSlot = i;
            break; 
        }
    }

    // If we found an empty slot, auto-fill it!
    if (availableSlot !== -1) {
        updateFavorite(availableSlot, index);
    } 
    // If all 4 are full, trigger our sleek new custom modal
    else {
        // ---> THIS IS THE NEW CUSTOM PROMPT <---
        const slotNum = await customPromptSlot();
        
        // If they hit Cancel, slotNum is null, so we just stop.
        if (!slotNum) return; 
        
        // Arrays start at 0, so we subtract 1 from their choice
        updateFavorite(slotNum - 1, index);
    }
}
// --- 6.1 DATABASE ACTION: UPDATE FAVORITE ---
async function updateFavorite(slot, pokeIndex) {
    const user = localStorage.getItem('twitch_user');
    const token = localStorage.getItem('auth_token');
    
    // --- 1. OPTIMISTIC UI UPDATE ---
    // Get the specific Pokemon from our local memory
    const targetPoke = fullCollection[pokeIndex];

    if (slot === -1) {
        // UNFAVORITE: Just remove the tag
        delete targetPoke.fav; 
    } else {
        // FAVORITE: 
        // A. Strip this specific slot (0-3) from any other Pokemon that has it
        fullCollection.forEach(p => { 
            if (p.fav === slot) delete p.fav; 
        });
        // B. Assign the tag to our target Pokemon
        targetPoke.fav = slot;
    }

    // --- 2. RE-DRAW THE UI INSTANTLY ---
    // Build a temporary Top 4 array for the header
    const tempFavorites = [null, null, null, null];
    fullCollection.forEach(p => {
        if (p.fav !== undefined && p.fav >= 0 && p.fav <= 3) {
            tempFavorites[p.fav] = p;
        }
    });
    
    // Update the top 4 bar
    updateFavoriteUI(tempFavorites);

    // Update the main grid (handles the yellow stars and current sort)
    const sortOrder = document.getElementById('sort-order');
    const currentSort = sortOrder ? sortOrder.value : "newest";
    applySortAndRender(currentSort); 

    // --- 3. BACKGROUND DATABASE SAVE ---
    try {
        const res = await fetch(`${WORKER_URL}?user=${user}&set_favorite=true&slot=${slot}&index=${pokeIndex}&token=${token}`);
        
        if (!res.ok) {
            console.error("Server rejected favorite save. Reverting UI...");
            // If the server fails (e.g., token expired), we force a full refresh to fix the UI
            fetchTrainerData(user); 
        }
    } catch (e) {
        console.error("Network error while saving favorite:", e);
        // Optional: notify user that save failed
    }
}
    
    renderSprites(displayList); // Re-draws the grid with updated yellow stars

    // --- 2. BACKGROUND DATABASE SAVE ---
    try {
        const res = await fetch(`${WORKER_URL}?user=${user}&set_favorite=true&slot=${slot}&index=${pokeIndex}&token=${token}`);
        if (!res.ok) {
            console.error("Server rejected favorite save.");
            fetchTrainerData(currentUserView); // Hard refresh if it fails
        }
    } catch (e) {
        console.error("Network error while saving favorite:", e);
    }
}

// --- 7. SEARCH & SORT LISTENERS ---
const filterInput = document.getElementById('pokemon-filter');
if (filterInput) {
    filterInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = fullCollection.filter(i => {
            const name = typeof i === 'object' ? i.n : i;
            return name.toLowerCase().includes(term);
        });
        
        // Map original index to preserve functionality during filtering
        const displayList = filtered.map((poke) => {
             const originalIdx = fullCollection.indexOf(poke);
             return { ...poke, originalIndex: originalIdx };
        });
        renderSprites(displayList);
    });
}

if (sortOrder) {
    sortOrder.addEventListener('change', (e) => {
        const val = e.target.value;
        // Save the choice!
        localStorage.setItem('preferred_sort', val);
        applySortAndRender(val);
    });
}

function applySortAndRender(val) {
    // Map array with original indexes so Favorite/Release buttons still work
    let displayList = fullCollection.map((poke, index) => {
         return { ...poke, originalIndex: index };
    });

    if (val === "newest") {
        displayList.reverse();
    } else if (val === "pokedex") {
        displayList.sort((a, b) => (a.id || 0) - (b.id || 0));
    } else if (val === "alpha") {
        displayList.sort((a, b) => {
            const nameA = (a.n || "").toLowerCase();
            const nameB = (b.n || "").toLowerCase();
            return nameA.localeCompare(nameB);});
    } else if (val === "shiny") {
        displayList.sort((a, b) => b.s - a.s);
    }
    
    renderSprites(displayList);
}

// --- CUSTOM MODAL ENGINE ---
function customConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-modal');
        const modalText = document.getElementById('modal-text');
        const btnYes = document.getElementById('modal-btn-yes');
        const btnNo = document.getElementById('modal-btn-no');

        // Set the text and show the box
        modalText.innerText = message;
        modal.classList.remove('hidden');

        // Cleanup function hides the box after a click
        const cleanup = () => {
            modal.classList.add('hidden');
            btnYes.onclick = null;
            btnNo.onclick = null;
        };

        // If they click YES, resolve true. If NO, resolve false.
        btnYes.onclick = () => { cleanup(); resolve(true); };
        btnNo.onclick = () => { cleanup(); resolve(false); };
    });
}

// --- CUSTOM SLOT SELECTOR ENGINE ---
function customPromptSlot() {
    return new Promise((resolve) => {
        const modal = document.getElementById('slot-modal');
        const cancelBtn = document.getElementById('slot-cancel');
        const slotBtns = document.querySelectorAll('.slot-btn');

        // Show the box
        modal.classList.remove('hidden');

        // Cleanup function
        const cleanup = () => {
            modal.classList.add('hidden');
            cancelBtn.onclick = null;
            slotBtns.forEach(b => b.onclick = null);
        };

        // If they click cancel, return null
        cancelBtn.onclick = () => { 
            cleanup(); 
            resolve(null); 
        };

        // Loop through all 4 buttons and attach a click listener to each
        slotBtns.forEach(btn => {
            btn.onclick = (e) => {
                cleanup();
                // Grabs the number from the data-slot="X" attribute we put in the HTML
                resolve(parseInt(e.target.getAttribute('data-slot')));
            };
        });
    });
}

// --- POKEDEX DETAIL ENGINE ---
async function openDetailModal(pokeData) {
    const modal = document.getElementById('detail-modal');
    const innerCard = document.getElementById('detail-card-inner');
    const dexElement = document.getElementById('detail-dex-entry');
    const typesContainer = document.getElementById('detail-types'); // Added this missing line!
    const closeBtn = document.getElementById('close-detail');

    // 1. SETUP CLOSING LOGIC FIRST (So the X always works)
    const close = () => {
        innerCard.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 400);
    };
    closeBtn.onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    // 2. POPULATE BASIC DATA
    const isShiny = pokeData.s === 1;
    document.getElementById('detail-name').innerText = pokeData.n.toUpperCase() + (isShiny ? " ✨" : "");
    document.getElementById('detail-img').src = `https://img.pokemondb.net/sprites/home/${isShiny ? 'shiny' : 'normal'}/${pokeData.n.toLowerCase()}.png`;
    
    const [atk, def, hp] = pokeData.iv || [0,0,0];
    document.getElementById('detail-atk').innerText = atk;
    document.getElementById('detail-atk').className = `stat-value ${atk === 15 ? 'perfect-stat' : ''}`;
    document.getElementById('detail-def').innerText = def;
    document.getElementById('detail-def').className = `stat-value ${def === 15 ? 'perfect-stat' : ''}`;
    document.getElementById('detail-hp').innerText = hp;
    document.getElementById('detail-hp').className = `stat-value ${hp === 15 ? 'perfect-stat' : ''}`;
    
    dexElement.innerText = "Accessing global Pokédex...";
    typesContainer.innerHTML = ""; // Clear old types

    // 3. TRIGGER ANIMATION
    modal.classList.remove('hidden');
    setTimeout(() => innerCard.classList.add('show'), 10);

    // 4. FETCH API DATA
    try {
        const query = pokeData.id ? pokeData.id : pokeData.n.toLowerCase();
        
        const [speciesRes, pokemonRes] = await Promise.all([
            fetch(`https://pokeapi.co/api/v2/pokemon-species/${query}`),
            fetch(`https://pokeapi.co/api/v2/pokemon/${query}`)
        ]);
        
        const speciesData = await speciesRes.json();
        const pokemonData = await pokemonRes.json();
        
        // Build the Type Bubbles
        typesContainer.innerHTML = "";
        pokemonData.types.forEach(t => {
            const typeName = t.type.name;
            const span = document.createElement('span');
            span.className = `type-bubble type-${typeName}`;
            span.innerText = typeName;
            typesContainer.appendChild(span);
        });

        // Find the first English Pokedex entry
        const entry = speciesData.flavor_text_entries.find(e => e.language.name === "en");
        if (entry) {
            dexElement.innerText = `"${entry.flavor_text.replace(/\f|\n/g, ' ')}"`;
        } else {
            dexElement.innerText = "Data corrupted. No Pokédex entry found.";
        }
    } catch (e) {
        console.error("Dex Fetch Error:", e);
        dexElement.innerText = "Connection lost. Could not load Pokédex entry.";
        if (typesContainer) typesContainer.innerHTML = `<span class="type-bubble" style="background:#ff3333">ERROR</span>`;
    }
}

// --- INFO DRAWER LOGIC ---
document.getElementById('open-drawer').onclick = () => {
    document.getElementById('info-drawer').classList.remove('hidden');
};

document.getElementById('close-drawer').onclick = () => {
    document.getElementById('info-drawer').classList.add('hidden');
};

// Close drawer if clicking outside of it
window.addEventListener('click', (e) => {
    const drawer = document.getElementById('info-drawer');
    const fab = document.getElementById('open-drawer');
    if (!drawer.contains(e.target) && e.target !== fab && !drawer.classList.contains('hidden')) {
        drawer.classList.add('hidden');
    }
});
