// Xiangqi Game Socket Handlers

/**
 * Register Xiangqi game handlers for a socket
 */
function registerXiangqiHandlers(io, socket, rooms) {

    // Handle Xiangqi join (called from main join_room)
    function handleXiangqiJoin(roomId, username) {
        let room = rooms.get(roomId);

        // Create room if not exists
        if (!room) {
            room = {
                type: 'xiangqi',
                board: null, // Initial board state is managed by client logic usually, or we can init here
                turn: 'red',
                players: {}, // red: {id, username}, black: {id, username}
                history: []
            };
            rooms.set(roomId, room);
            console.log(`[XIANGQI] Created room: ${roomId}`);
        }

        // Assign color (Red goes first)
        let color = null;
        if (!room.players.red) {
            room.players.red = { id: socket.id, username };
            color = 'red';
        } else if (!room.players.black) {
            room.players.black = { id: socket.id, username };
            color = 'black';
        } else {
            color = 'spectator';
        }

        console.log(`[XIANGQI] Player ${socket.id} joined as ${color}`);

        // Notify user
        socket.emit('room_joined', {
            roomId,
            color,
            turn: room.turn,
            players: room.players,
            playerCount: io.sockets.adapter.rooms.get(roomId)?.size || 0
        });

        // Notify room
        io.to(roomId).emit('player_update', {
            players: room.players,
            playerCount: io.sockets.adapter.rooms.get(roomId)?.size || 0
        });

        // If rejoining or joining active game, send state?
        if (room.board) {
            socket.emit('game_state_update', { board: room.board, turn: room.turn });
        }
    }

    // Make move
    socket.on('make_move', ({ roomId, move, board, turn }) => {
        const room = rooms.get(roomId);
        if (room && room.type === 'xiangqi') {
            room.board = board;
            room.turn = turn;
            if (!room.history) room.history = [];
            room.history.push({ move, turn });

            // Broadcast to opponent
            socket.to(roomId).emit('game_state_update', { move, board, turn });
        }
    });

    // Handle disconnect
    function handleXiangqiDisconnect(roomId, room) {
        let found = false;
        if (room.players.red?.id === socket.id) {
            room.players.red = null;
            found = true;
        } else if (room.players.black?.id === socket.id) {
            room.players.black = null;
            found = true;
        }

        if (found) {
            io.to(roomId).emit('player_update', {
                players: room.players,
                playerCount: io.sockets.adapter.rooms.get(roomId)?.size || 0
            });
            // Auto game over logic? Or wait for reconnect?
            // For now just notify leaves

            const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
            if (roomSize === 0) {
                rooms.delete(roomId);
                console.log(`[XIANGQI] Room ${roomId} deleted (empty)`);
            }
        }
        return found;
    }

    return { handleXiangqiJoin, handleXiangqiDisconnect };
}

module.exports = { registerXiangqiHandlers };
