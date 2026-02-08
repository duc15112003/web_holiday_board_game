// Chess Game Socket Handlers

/**
 * Register Chess game handlers for a socket
 */
function registerChessHandlers(io, socket, rooms) {

    // Handle Chess join (called from main join_room)
    function handleChessJoin(roomId, username) {
        let room = rooms.get(roomId);

        // Create room if not exists
        if (!room) {
            room = {
                type: 'chess',
                fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                turn: 'w',
                players: {},
                history: []
            };
            rooms.set(roomId, room);
            console.log(`[CHESS] Created room: ${roomId}`);
        }

        // Assign color
        let color = null;
        if (!room.players.w) {
            room.players.w = socket.id;
            color = 'w';
        } else if (!room.players.b) {
            room.players.b = socket.id;
            color = 'b';
        } else {
            color = 's'; // Spectator
        }

        console.log(`[CHESS] Player ${socket.id} joined as ${color}`);

        // Notify user
        socket.emit('room_joined', {
            roomId,
            color,
            fen: room.fen,
            turn: room.turn,
            playerCount: io.sockets.adapter.rooms.get(roomId)?.size || 0
        });

        // Notify room
        io.to(roomId).emit('player_update', {
            playerCount: io.sockets.adapter.rooms.get(roomId)?.size || 0
        });
    }

    // Make move
    socket.on('make_move', ({ roomId, move, fen, turn }) => {
        const room = rooms.get(roomId);
        if (room && room.type === 'chess') {
            room.fen = fen;
            room.turn = turn;
            if (!room.history) room.history = [];
            room.history.push({ move, fen, turn });
            socket.to(roomId).emit('game_state_update', { move, fen, turn });
        }
    });

    // Rematch
    socket.on('request_rematch', ({ roomId }) => {
        const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
        const room = rooms.get(roomId);

        if (roomSize <= 1 && room) {
            room.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
            room.turn = 'w';
            room.history = [];
            io.to(roomId).emit('game_reset', { fen: room.fen, turn: room.turn });
        } else {
            socket.to(roomId).emit('rematch_requested');
        }
    });

    socket.on('respond_rematch', ({ roomId, accepted }) => {
        if (accepted) {
            const room = rooms.get(roomId);
            if (room) {
                room.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
                room.turn = 'w';
                room.history = [];
                io.to(roomId).emit('game_reset', { fen: room.fen, turn: room.turn });
            }
        } else {
            socket.to(roomId).emit('rematch_rejected');
        }
    });

    // Resign
    socket.on('resign', ({ roomId }) => {
        socket.to(roomId).emit('game_over', { reason: 'opponent_resigned', winner: 'you' });
        socket.emit('game_over', { reason: 'resignation', winner: 'opponent' });
    });

    // Draw
    socket.on('offer_draw', ({ roomId }) => {
        socket.to(roomId).emit('draw_offered');
    });

    socket.on('respond_draw', ({ roomId, accepted }) => {
        if (accepted) {
            io.to(roomId).emit('game_over', { reason: 'draw_agreed' });
        } else {
            socket.to(roomId).emit('draw_rejected');
        }
    });

    // Handle disconnect
    function handleChessDisconnect(roomId, room) {
        let found = false;
        if (room.players.w === socket.id) {
            room.players.w = null;
            found = true;
        } else if (room.players.b === socket.id) {
            room.players.b = null;
            found = true;
        }

        if (found) {
            io.to(roomId).emit('player_update', {
                playerCount: io.sockets.adapter.rooms.get(roomId)?.size || 0
            });

            const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
            if (roomSize === 0) {
                rooms.delete(roomId);
                console.log(`[CHESS] Room ${roomId} deleted (empty)`);
            }
        }
        return found;
    }

    return { handleChessJoin, handleChessDisconnect };
}

module.exports = { registerChessHandlers };
