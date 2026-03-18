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

        fullCollection = (data.collection || []).filter(Boolean);
        updateFavoriteUI(data.favorites);
        
        // Use mapping to preserve original index before reversing
        const displayList = fullCollection.map((poke, index) => {
            return { ...poke, originalIndex: index };
        }).reverse();
        
        renderSprites(displayList);
        
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
async function updateFavorite(slot, pokeIndex) {
    const user = localStorage.getItem('twitch_user');
    const token = localStorage.getItem('auth_token');
    
    // --- 1. OPTIMISTIC UI UPDATE ---
    const targetPoke = fullCollection[pokeIndex];

    if (slot === -1) {
        delete targetPoke.fav; // Remove favorite
    } else {
        // Strip this slot from anyone else, then assign it
        fullCollection.forEach(p => { if (p.fav === slot) delete p.fav; });
        targetPoke.fav = slot;
    }

    const tempFavorites = [null, null, null, null];
    fullCollection.forEach(p => {
        if (p.fav !== undefined && p.fav >= 0 && p.fav <= 3) {
            tempFavorites[p.fav] = p;
        }
    });
    
    // Instantly Redraw the Top Bar
    updateFavoriteUI(tempFavorites);

    // ---> NEW: Instantly Redraw the Main Grid <---
    // We grab the current search term and sort order so the grid doesn't reset wildly
    const filterInput = document.getElementById('pokemon-filter');
    const term = filterInput ? filterInput.value.toLowerCase() : "";
    
    let displayList = fullCollection.map((poke, idx) => ({ ...poke, originalIndex: idx }));
    
    if (term) {
        displayList = displayList.filter(i => {
            const name = typeof i === 'object' ? i.n : i;
            return name.toLowerCase().includes(term);
        });
    }
    
    const sortOrder = document.getElementById('sort-order');
    const val = sortOrder ? sortOrder.value : "newest";
    
    if (val === "newest") {
        displayList.reverse();
    } else if (val === "pokedex") {
        displayList.sort((a, b) => (a.id || 0) - (b.id || 0));
    } else if (val === "alpha") {
        displayList.sort((a, b) => {
            const nameA = typeof a === 'object' ? a.n : a;
            const nameB = typeof b === 'object' ? b.n : b;
            return nameA.localeCompare(nameB);
        });
    } else if (val === "shiny") {
        displayList.sort((a, b) => {
            const sA = typeof a === 'object' ? a.s : (a.includes('✨') ? 1 : 0);
            const sB = typeof b === 'object' ? b.s : (b.includes('✨') ? 1 : 0);
            return sB - sA;
        });
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

const sortOrder = document.getElementById('sort-order');
if (sortOrder) {
    sortOrder.addEventListener('change', (e) => {
        const val = e.target.value;
        
        // Map array with original indexes before sorting
        let sorted = fullCollection.map((poke, index) => {
             return { ...poke, originalIndex: index };
        });

        if (val === "newest") {
            sorted.reverse();
        } else if (val === "pokedex") {
            sorted.sort((a, b) => (a.id || 0) - (b.id || 0));
        } else if (val === "alpha") {
            sorted.sort((a, b) => {
                const nameA = typeof a === 'object' ? a.n : a;
                const nameB = typeof b === 'object' ? b.n : b;
                return nameA.localeCompare(nameB);
            });
        } else if (val === "shiny") {
            sorted.sort((a, b) => {
                const sA = typeof a === 'object' ? a.s : (a.includes('✨') ? 1 : 0);
                const sB = typeof b === 'object' ? b.s : (b.includes('✨') ? 1 : 0);
                return sB - sA;
            });
        }
        renderSprites(sorted);
    });
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
