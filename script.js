async function fetchTrainerData(username) {
    const workerUrl = `https://pokemon.brandenkenn.workers.dev?user=${username}&userstats=true&format=json`;

    try {
        const response = await fetch(workerUrl);
        if (!response.ok) throw new Error("Trainer not found");
        
        const data = await response.json();

        // Update Text Elements
        document.getElementById('trainer-name').innerText = username.toUpperCase();
        document.getElementById('trainer-balance').innerText = `₽${data.balance.toLocaleString()}`;
        document.getElementById('trainer-total').innerText = data.total;

        const display = document.getElementById('pokemon-display');
        display.innerHTML = ""; // Clear loading state

        // Render Pokémon Sprites
        data.collection.slice(-20).reverse().forEach(entry => {
            // Entry format: "✨Pikachu(15/15/15)🦠"
            const isShiny = entry.includes('✨');
            const hasPokerus = entry.includes('🦠');
            
            // Extract just the name (lowercase for API)
            let name = entry.split('(')[0].replace('✨', '').toLowerCase();

            // Create image element
            const img = document.createElement('img');
            const spriteType = isShiny ? 'shiny' : 'normal';
            
            // Using PokeAPI GitHub assets for high-quality sprites
            img.src = `https://img.pokemondb.net/sprites/home/${spriteType}/${name}.png`;
            img.alt = name;
            img.style.width = "80px";
            img.title = entry; // Shows full stats on hover

            // Add a visual glow for Shinies or Pokerus
            if (isShiny) img.style.filter = "drop-shadow(0 0 5px gold)";
            if (hasPokerus) img.style.border = "2px solid purple";

            display.appendChild(img);
        });

    } catch (error) {
        console.error("Error fetching trainer:", error);
        document.getElementById('trainer-name').innerText = "Trainer Not Found";
    }
}

// Example: Load Branden's data when the page loads
fetchTrainerData('dranben');
