// Loto Game Socket Handlers
const { generateLotoTicket, verifyLotoWin } = require('./lotoHelpers');

/**
 * Register Loto game handlers for a socket
 */
function registerLotoHandlers(io, socket, rooms) {

    // Handle Loto join (called from main join_room)
    function handleLotoJoin(roomId, username) {
        let room = rooms.get(roomId);

        // Create room if not exists
        if (!room) {
            room = {
                type: 'loto',
                host: socket.id,
                players: [],
                gameState: 'waiting',
                drawnNumbers: [],
                winner: null
            };
            rooms.set(roomId, room);
            console.log(`[LOTO] Created room: ${roomId}`);
        }

        // Add player if not already in
        const existingPlayer = room.players.find(p => p.id === socket.id);
        if (!existingPlayer) {
            // Pass existing tickets to avoid duplicates
            const existingTickets = room.players.map(p => p.ticket);
            const ticket = generateLotoTicket(existingTickets);
            room.players.push({
                id: socket.id,
                username: username || `Player ${socket.id.substr(0, 4)}`,
                ticket: ticket,
                marked: []
            });
            console.log(`[LOTO] Player ${socket.id} joined room ${roomId}`);
        }

        // Broadcast room update
        broadcastRoomUpdate(io, roomId, room);
    }

    // Start game
    socket.on('loto_start', ({ roomId }) => {
        console.log(`[LOTO_START] ${socket.id} in room ${roomId}`);
        const room = rooms.get(roomId);
        if (room && room.type === 'loto' && room.host === socket.id) {
            room.gameState = 'playing';
            room.drawnNumbers = [];
            room.winner = null;
            io.to(roomId).emit('loto_game_started', { room });
        }
    });

    // Draw number
    socket.on('loto_draw_number', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room && room.type === 'loto' && room.host === socket.id && room.gameState === 'playing') {
            let number;
            let attempts = 0;
            do {
                number = Math.floor(Math.random() * 90) + 1;
                attempts++;
            } while (room.drawnNumbers.includes(number) && attempts < 100);

            if (room.drawnNumbers.length < 90) {
                room.drawnNumbers.push(number);
                console.log(`[LOTO_DRAW] Number: ${number}, Total: ${room.drawnNumbers.length}`);
                io.to(roomId).emit('loto_number_drawn', { number, drawnNumbers: room.drawnNumbers });
            }
        }
    });

    // Check win
    socket.on('loto_check_win', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room && room.type === 'loto' && room.gameState === 'playing') {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                const isWinner = verifyLotoWin(player.ticket, room.drawnNumbers);
                if (isWinner) {
                    room.gameState = 'ended';
                    room.winner = player.username;
                    console.log(`[LOTO] Winner: ${player.username}`);
                    io.to(roomId).emit('loto_game_over', { winner: player.username });
                } else {
                    socket.emit('loto_claim_failed', { message: 'Chưa đủ điều kiện kinh!' });
                }
            }
        }
    });

    // Reset game
    socket.on('loto_reset', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room && room.type === 'loto' && room.host === socket.id) {
            room.gameState = 'waiting';
            room.drawnNumbers = [];
            room.winner = null;

            // Regenerate tickets without duplicates
            const newTickets = [];
            room.players.forEach(p => {
                const ticket = generateLotoTicket(newTickets);
                newTickets.push(ticket);
                p.ticket = ticket;
            });

            broadcastRoomUpdate(io, roomId, room);
        }
    });

    // Handle disconnect
    function handleLotoDisconnect(roomId, room) {
        const idx = room.players.findIndex(p => p.id === socket.id);
        if (idx !== -1) {
            room.players.splice(idx, 1);
            console.log(`[LOTO] Player ${socket.id} left room ${roomId}`);

            if (room.players.length === 0) {
                rooms.delete(roomId);
                console.log(`[LOTO] Room ${roomId} deleted (empty)`);
            } else {
                if (room.host === socket.id) {
                    room.host = room.players[0].id;
                    console.log(`[LOTO] New host: ${room.host}`);
                }
                broadcastRoomUpdate(io, roomId, room);
            }
            return true;
        }
        return false;
    }

    return { handleLotoJoin, handleLotoDisconnect };
}

function broadcastRoomUpdate(io, roomId, room) {
    io.to(roomId).emit('loto_room_update', {
        room: {
            ...room,
            // Don't expose all tickets to all players (for anti-cheat)
            // Actually for simplicity we do, but in production filter this
        }
    });
}

module.exports = { registerLotoHandlers };
