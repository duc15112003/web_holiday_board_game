const { io } = require("socket.io-client");

// Test UNO Game with 4 players
const players = [];
const ROOM_ID = "uno-test-4p";
const PLAYER_COUNT = 4;

// Create 4 players
for (let i = 1; i <= PLAYER_COUNT; i++) {
    const socket = io("http://localhost:3001");
    players.push({
        id: i,
        socket,
        name: `Player${i}`,
        cards: 0
    });
}

let gameStarted = false;
let playersJoined = 0;

players.forEach((player, idx) => {
    player.socket.on("connect", () => {
        console.log(`[P${player.id}] Connected: ${player.socket.id}`);

        // Stagger joins
        setTimeout(() => {
            player.socket.emit("join_room", {
                roomId: ROOM_ID,
                username: player.name,
                gameType: "uno",
                mode: "classic"
            });
        }, idx * 300);
    });

    player.socket.on("uno_room_update", (data) => {
        const playerCount = data.room.players.length;
        player.cards = data.room.myCards?.length || 0;

        if (data.room.players.find(p => p.id === player.socket.id)) {
            if (!player.joined) {
                player.joined = true;
                playersJoined++;
                console.log(`[P${player.id}] Joined! Total players: ${playerCount}`);
            }
        }

        // Host starts game when all players joined
        if (idx === 0 && playerCount === PLAYER_COUNT && data.room.gameState === "waiting" && !gameStarted) {
            gameStarted = true;
            console.log(`\n[P1 HOST] Starting game with ${playerCount} players...`);
            player.socket.emit("uno_start", { roomId: ROOM_ID, mode: "classic" });
        }

        if (data.room.gameState === "playing" && player.cards > 0) {
            console.log(`[P${player.id}] Has ${player.cards} cards`);
        }
    });

    player.socket.on("uno_game_started", () => {
        if (idx === 0) {
            console.log("\n=== GAME STARTED ===");
        }
    });

    player.socket.on("connect_error", (err) => {
        console.error(`[P${player.id}] Connection Error:`, err.message);
    });
});

// Timeout and results
setTimeout(() => {
    console.log("\n=== TEST COMPLETE ===");
    console.log(`Players connected: ${players.filter(p => p.socket.connected).length}/${PLAYER_COUNT}`);
    console.log(`Players joined room: ${playersJoined}/${PLAYER_COUNT}`);
    console.log(`Game started: ${gameStarted ? 'Yes' : 'No'}`);

    const cardCounts = players.map(p => p.cards);
    console.log(`Cards per player: ${cardCounts.join(', ')}`);

    if (cardCounts.every(c => c === 7)) {
        console.log("✓ All players received 7 cards correctly!");
    }

    process.exit(0);
}, 6000);
