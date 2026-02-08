require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*", // Use env var or allow all
        methods: ["GET", "POST"]
    }
});

// Game Rooms State
// { roomId: { fen: string, turn: 'w'|'b', players: { w: socketId, b: socketId } } }
const rooms = new Map();

io.on('connection', (socket) => {

    // Join Room
    socket.on('join_room', ({ roomId, username }) => {
        socket.join(roomId);

        let room = rooms.get(roomId);
        if (!room) {
            room = {
                fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                turn: 'w',
                players: {}
            };
            rooms.set(roomId, room);
        }

        // Assign color if available
        let color = null;
        if (!room.players.w) {
            room.players.w = socket.id;
            color = 'w';
        } else if (!room.players.b) {
            room.players.b = socket.id;
            color = 'b';
        } else {
            // Spectator
            color = 's';
        }

        // Notify user of their role and current state
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
    });

    // Make Move
    socket.on('make_move', ({ roomId, move, fen, turn }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.fen = fen;
            room.turn = turn;
            // Record move for undo (simplified history)
            if (!room.history) room.history = [];
            room.history.push({ move, fen, turn }); // Need previous fen actually

            socket.to(roomId).emit('game_state_update', { move, fen, turn });
        }
    });

    // Game Controls
    socket.on('request_rematch', ({ roomId }) => {
        const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;

        if (roomSize <= 1) {
            // Auto-accept if opponent left
            const room = rooms.get(roomId);
            if (room) {
                room.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
                room.turn = 'w';
                room.history = [];
                io.to(roomId).emit('game_reset', {
                    fen: room.fen,
                    turn: room.turn
                });
            }
        } else {
            // Ask for consent if opponent is present
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
                io.to(roomId).emit('game_reset', {
                    fen: room.fen,
                    turn: room.turn
                });
            }
        } else {
            socket.to(roomId).emit('rematch_rejected');
        }
    });

    socket.on('resign', ({ roomId }) => {
        // Sender loses. Opponent wins.
        // We can identify winner by "not socket.id", but easier to just tell room "Opponent Resigned"
        // Or send specific game_over event
        socket.to(roomId).emit('game_over', { reason: 'opponent_resigned', winner: 'you' }); // To opponent
        socket.emit('game_over', { reason: 'resignation', winner: 'opponent' }); // To self
    });

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

    socket.on('disconnect', () => {


        // Find room user was in
        for (const [roomId, room] of rooms.entries()) {
            let found = false;

            if (room.players.w === socket.id) {
                room.players.w = null;
                found = true;
            } else if (room.players.b === socket.id) {
                room.players.b = null;
                found = true;
            }

            // Note: Socket.IO automatically leaves the room, so adapter.rooms size updates
            // But we need to update our internal state too (above)

            if (found) {
                // Notify remaining players
                io.to(roomId).emit('player_update', {
                    playerCount: io.sockets.adapter.rooms.get(roomId)?.size || 0
                });

                // Cleanup empty rooms (optional but good)
                if ((!io.sockets.adapter.rooms.get(roomId)?.size) || (io.sockets.adapter.rooms.get(roomId)?.size === 0)) {
                    rooms.delete(roomId);
                }
                break; // User usually in 1 room
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Socket server running on port ${PORT}`);
});
