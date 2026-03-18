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
        
        updateFavoriteUI(data.favorites);
        
        fullCollection = (data.collection || []).filter(Boolean);
        
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
    for (let i = 0; i < 4; i++) {
        const slotImg = document.querySelector(`#fav-${i} img`);
        if (!slotImg) continue;

        const data = favorites && favorites[i];
        
        if (data) {
            const isShiny = data.s === 1;
            slotImg.src = `https://img.pokemondb.net/sprites/home/${isShiny ? 'shiny' : 'normal'}/${data.n.toLowerCase()}.png`;
            slotImg.title = data.n;
        } else {
            slotImg.src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png";
            slotImg.title = "Empty Slot";
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

        const card = document.createElement('div');
        card.className = `pokemon-card ${isShiny ? 'shiny-card' : ''}`;
        
        card.innerHTML = `
            <button class="release-btn" title="Release ${name}" 
                    onclick="releasePokemon(${actualIndex}, '${name}')">×</button>
            
            <button class="fav-btn" title="Set Favorite"
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

    if (!confirm(`Are you sure you want to release your ${name}? This cannot be undone.`)) return;

    try {
        const res = await fetch(`${WORKER_URL}?user=${user}&release_index=${index}&token=${token}`);
        const result = await res.text();
        
        alert(result);
        fetchTrainerData(user); 
    } catch (e) {
        alert("Server communication failed.");
    }
}

function toggleFavoriteDialog(index) {
    let availableSlot = -1;

    // 1. Check all 4 slots to see if any are holding the default Poke-ball
    for (let i = 0; i < 4; i++) {
        const img = document.querySelector(`#fav-${i} img`);
        if (img && img.src.includes('poke-ball.png')) {
            availableSlot = i;
            break; // Stop looking once we find the first empty one
        }
    }

    // 2. If we found an empty slot, automatically use it!
    if (availableSlot !== -1) {
        updateFavorite(availableSlot, index);
    } 
    // 3. If all 4 are full, fall back to asking them which one to overwrite
    else {
        const slotInput = prompt("Your favorites are full! Which slot (1, 2, 3, or 4) would you like to replace?");
        if (!slotInput) return; // User cancelled
        
        const slotNum = parseInt(slotInput);
        if (isNaN(slotNum) || slotNum < 1 || slotNum > 4) {
            alert("Invalid slot. Please enter a number between 1 and 4.");
            return;
        }
        
        updateFavorite(slotNum - 1, index);
    }
}
async function updateFavorite(slot, pokeIndex) {
    const user = localStorage.getItem('twitch_user');
    const token = localStorage.getItem('auth_token');
    
    try {
        const res = await fetch(`${WORKER_URL}?user=${user}&set_favorite=true&slot=${slot}&index=${pokeIndex}&token=${token}`);
        if (res.ok) {
            alert("Favorite set!");
            const currentTrainer = document.getElementById('trainer-name').innerText.toLowerCase();
            fetchTrainerData(currentTrainer); 
        }
    } catch (e) {
        console.error("Favorite setting failed:", e);
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
