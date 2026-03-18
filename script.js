const CLIENT_ID = "oqdrp3gkw3lczkb14z6h74ycboupib"; 
const REDIRECT_URI = "https://dranben.com";
const WORKER_URL = "https://pokemon.brandenkenn.workers.dev";

let fullCollection = []; 

// --- 1. INITIALIZATION ---
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

    // Load saved sort preference
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

// --- 5. RENDERING ---
function renderSprites(list) {
    const display = document.getElementById('pokemon-display');
    if (!display) return;
    display.innerHTML = "";

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
            name = item.n; isShiny = item.s === 1; hasPokerus = item.p === 1; [atk, def, hp] = item.iv || [0, 0, 0];
        } else {
            isShiny = item.includes('✨'); name = item.split('(')[0].replace('✨', '').trim();
            const ivMatch = item.match(/\((.*?)\)/); [atk, def, hp] = ivMatch ? ivMatch[1].split('/').map(Number) : [0, 0, 0];
        }

        const isFavorited = (item.fav !== undefined && item.fav >= 0 && item.fav <= 3);
        const card = document.createElement('div');
        card.className = `pokemon-card ${isShiny ? 'shiny-card' : ''}`;
        card.innerHTML = `
            ${isShiny ? '<div class="shiny-sparkle-1">✨</div><div class="shiny-sparkle-2">✨</div>' : ''}
            <button class="release-btn" onclick="releasePokemon(${actualIndex}, '${name}')">×</button>
            <button class="fav-btn ${isFavorited ? 'active' : ''}" onclick="toggleFavoriteDialog(${actualIndex})">★</button>
            <div class="pokemon-name">${name.toUpperCase()}</div>
            <img src="https://img.pokemondb.net/sprites/home/${isShiny ? 'shiny' : 'normal'}/${name.toLowerCase()}.png" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'">
            <div class="stats-box">
                <div class="stat-row"><span class="stat-label">ATK</span><span class="stat-value ${atk === 15 ? 'perfect-stat' : ''}">${atk}</span></div>
                <div class="stat-row"><span class="stat-label">DEF</span><span class="stat-value ${def === 15 ? 'perfect-stat' : ''}">${def}</span></div>
                <div class="stat-row"><span class="stat-label">STA</span><span class="stat-value ${hp === 15 ? 'perfect-stat' : ''}">${hp}</span></div>
            </div>`;
        card.onclick = (e) => { if (e.target.tagName !== 'BUTTON') openDetailModal(item); };
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
        alert(await res.text());
        fetchTrainerData(user); 
    } catch (e) { alert("Server error."); }
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

async function updateFavorite(slot, pokeIndex) {
    const user = localStorage.getItem('twitch_user');
    const token = localStorage.getItem('auth_token');
    const target = fullCollection[pokeIndex];
    if (slot === -1) delete target.fav;
    else {
        fullCollection.forEach(p => { if (p.fav === slot) delete p.fav; });
        target.fav = slot;
    }
    const temp = [null, null, null, null];
    fullCollection.forEach(p => { if (p.fav !== undefined) temp[p.fav] = p; });
    updateFavoriteUI(temp);
    applySortAndRender(document.getElementById('sort-order').value);
    try {
        const res = await fetch(`${WORKER_URL}?user=${user}&set_favorite=true&slot=${slot}&index=${pokeIndex}&token=${token}`);
        if (!res.ok) fetchTrainerData(user);
    } catch (e) { console.error(e); }
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

async function openDetailModal(poke) {
    const m = document.getElementById('detail-modal'), i = document.getElementById('detail-card-inner');
    const isShiny = poke.s === 1;
    document.getElementById('detail-name').innerText = poke.n.toUpperCase() + (isShiny ? " ✨" : "");
    document.getElementById('detail-img').src = `https://img.pokemondb.net/sprites/home/${isShiny ? 'shiny' : 'normal'}/${poke.n.toLowerCase()}.png`;
    const [a, d, h] = poke.iv || [0,0,0];
    document.getElementById('detail-atk').innerText = a; document.getElementById('detail-def').innerText = d; document.getElementById('detail-hp').innerText = h;
    m.classList.remove('hidden'); setTimeout(() => i.classList.add('show'), 10);
    try {
        const [sR, pR] = await Promise.all([fetch(`https://pokeapi.co/api/v2/pokemon-species/${poke.id || poke.n.toLowerCase()}`), fetch(`https://pokeapi.co/api/v2/pokemon/${poke.id || poke.n.toLowerCase()}`)]);
        const sD = await sR.json(), pD = await pR.json();
        const tC = document.getElementById('detail-types'); tC.innerHTML = "";
        pD.types.forEach(t => tC.innerHTML += `<span class="type-bubble type-${t.type.name}">${t.type.name}</span>`);
        const e = sD.flavor_text_entries.find(f => f.language.name === "en");
        document.getElementById('detail-dex-entry').innerText = e ? `"${e.flavor_text.replace(/\f|\n/g, ' ')}"` : "No data.";
    } catch { document.getElementById('detail-dex-entry').innerText = "Error loading dex."; }
    document.getElementById('close-detail').onclick = () => { i.classList.remove('show'); setTimeout(() => m.classList.add('hidden'), 400); };
}

document.getElementById('open-drawer').onclick = () => document.getElementById('info-drawer').classList.remove('hidden');
document.getElementById('close-drawer').onclick = () => document.getElementById('info-drawer').classList.add('hidden');

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
