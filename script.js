const CLIENT_ID = "oqdrp3gkw3lczkb14z6h74ycboupib"; 
const REDIRECT_URI = "https://dranben.com";
const WORKER_URL = "https://pokemon.brandenkenn.workers.dev";

let fullCollection = []; // The master list of Pokemon objects/strings

// --- 1. INITIALIZATION ---
window.onload = async () => {
    // 1. Handle Twitch redirect/session
    await handleTwitchRedirect();

    const urlParams = new URLSearchParams(window.location.search);
    const urlUser = urlParams.get('user');
    const loggedInUser = localStorage.getItem('twitch_user');

    // 2. DATA LOGIC: What should the page actually show?
    // We default to 'dranben' for the CONTENT so the page isn't blank.
    const userToLoad = urlUser || loggedInUser || 'dranben';

    // 3. INPUT LOGIC: What should the SEARCH BOX show?
    // We ONLY fill the box if there is a specific user in the URL or a login.
    // If it's a fresh visit (no URL user, no login), we leave it "" (empty).
    const inputField = document.getElementById('username-input');
    inputField.value = urlUser || loggedInUser || "";

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
                // Save credentials to browser memory
                localStorage.setItem('twitch_user', authData.user);
                localStorage.setItem('auth_token', authData.token);
                
                // Clean the URL (removes the ?code=...)
                window.history.replaceState({}, document.title, "/");
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
    
    // Ensure the token isn't the literal string "undefined"
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
    
    trainerNameSpan.innerText = username.toUpperCase();
    display.innerHTML = "<p class='loading'>Scanning Storage Units...</p>";

    try {
        const res = await fetch(`${WORKER_URL}?user=${username}&userstats=true`);
        const data = await res.json();
        
        // 1. Update Stats
        statTotal.innerText = data.total || 0;
        statBalance.innerText = data.balance?.toLocaleString() || 0;
        
        // ---> 2. CALL THE FAVORITES FUNCTION HERE <---
        updateFavoriteUI(data.favorites);
        
        // 3. Process the main Collection
        fullCollection = (data.collection || []).filter(Boolean);
        renderSprites([...fullCollection].reverse());
        
    } catch (e) {
        display.innerHTML = "<p>Error: Storage unit is offline.</p>";
    }
}

// --- 4. THE RENDERING ENGINE (RECTANGULAR CARDS) ---
function toggleFavoriteDialog(index) {
    const slot = prompt("Which Favorite Slot? (1, 2, 3, or 4)");
    if (!slot || slot < 1 || slot > 4) return;
    updateFavorite(slot - 1, index);
}

async function updateFavorite(slot, pokeIndex) {
    const user = localStorage.getItem('twitch_user');
    const token = localStorage.getItem('auth_token');
    
    const res = await fetch(`${WORKER_URL}?user=${user}&set_favorite=true&slot=${slot}&index=${pokeIndex}&token=${token}`);
    if (res.ok) {
        alert("Favorite set!");
        fetchTrainerData(user); // Refresh page
    }
}

function renderSprites(list) {
    const display = document.getElementById('pokemon-display');
    display.innerHTML = "";
    if (!list) return;

    // Security Check: Only show the "Release" X if the logged-in user matches the trainer
    const loggedInUser = localStorage.getItem('twitch_user');
    const currentTrainer = document.getElementById('trainer-name').innerText.toLowerCase();
    const isOwner = loggedInUser && loggedInUser.toLowerCase() === currentTrainer;

    if (isOwner) display.classList.add('is-owner');
    else display.classList.remove('is-owner');

    list.forEach((entry) => {
        // CRITICAL: Find the true index in fullCollection so we delete the right Pokemon
        const actualIndex = fullCollection.indexOf(entry);
        
        let name, isShiny, atk, def, hp;

        // Modern Object Format
        if (typeof entry === 'object' && entry.n) {
            name = entry.n;
            isShiny = entry.s === 1;
            [atk, def, hp] = entry.iv || [0, 0, 0];
        } 
        // Legacy String Format (Fallback)
        else if (typeof entry === 'string') {
            isShiny = entry.includes('✨');
            name = entry.split('(')[0].replace('✨', '').trim();
            const ivMatch = entry.match(/\((.*?)\)/);
            [atk, def, hp] = ivMatch ? ivMatch[1].split('/').map(Number) : [0, 0, 0];
        } else {
            return; // Skip if data is corrupted
        }

        const card = document.createElement('div');
        card.className = `pokemon-card ${isShiny ? 'shiny-card' : ''}`;
        
        card.innerHTML = `
            <button class="release-btn" title="Release ${name}" 
                    onclick="releasePokemon(${actualIndex}, '${name}')">×</button>
            
            <div class="pokemon-name">${name.toUpperCase()}</div>
            
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

// --- 5. USER ACTIONS ---
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
        fetchTrainerData(user); // Force-refresh the storage units
    } catch (e) {
        alert("Server communication failed.");
    }
}

// --- 6. SEARCH & SORT LISTENERS ---
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
    // "oldest" is the default array order
    renderSprites(sorted);
});

// --- 7. WEBSITE DATA (JSON) ---
    if (searchParams.get('userstats') === 'true') {
      // Create a temporary clone to send to the frontend
      const frontendData = { ...userData, favorites: [null, null, null, null] };
      
      // Look for any Pokémon with a 'fav' tag and slot them into the array
      if (frontendData.collection) {
          frontendData.collection.forEach(p => {
              if (p.fav !== undefined && p.fav >= 0 && p.fav <= 3) {
                  frontendData.favorites[p.fav] = p;
              }
          });
      }
    
      return new Response(JSON.stringify(frontendData), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

function updateFavoriteUI(favorites) {
    for (let i = 0; i < 4; i++) {
        const slotImg = document.querySelector(`#fav-${i} img`);
        const data = favorites && favorites[i];
        
        if (data) {
            const isShiny = data.s === 1;
            slotImg.src = `https://img.pokemondb.net/sprites/home/${isShiny ? 'shiny' : 'normal'}/${data.n.toLowerCase()}.png`;
        } else {
            slotImg.src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png";
        }
    }
}
