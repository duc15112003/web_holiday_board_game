const { io } = require("socket.io-client");

const socket = io("http://localhost:3001");

socket.on("connect", () => {
    console.log("Connected:", socket.id);

    // Join Loto Room
    socket.emit("join_room", {
        roomId: "loto-test-room",
        username: "TestRunner",
        gameType: "loto"
    });
});

socket.on("loto_room_update", (data) => {
    console.log("Room Update Received:", JSON.stringify(data, null, 2));

    if (data.room.players.length > 0) {
        const me = data.room.players.find(p => p.id === socket.id);
        if (me && me.ticket) {
            console.log("Ticket received successfully!");
            // Try starting game if host
            if (data.room.host === socket.id) {
                console.log("I am host, starting game...");
                socket.emit("loto_start", { roomId: "loto-test-room" });
            }
        } else {
            console.error("No ticket found for me!");
        }
    }
});

socket.on("loto_game_started", () => {
    console.log("Game Started!");
    // Draw number
    setInterval(() => {
        socket.emit("loto_draw_number", { roomId: "loto-test-room" });
    }, 1000);
});

socket.on("loto_number_drawn", ({ number }) => {
    console.log("Number drawn:", number);
});

socket.on("connect_error", (err) => {
    console.error("Connection Error:", err.message);
    process.exit(1);
});

// Timeout
setTimeout(() => {
    console.log("Test finished (timeout)");
    process.exit(0);
}, 5000);
