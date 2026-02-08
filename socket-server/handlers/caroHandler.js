// Caro Game Socket Handlers

const GRID_SIZE = 15;
const WIN_COUNT = 5;

// Directions to check for win: [dx, dy]
const DIRECTIONS = [
    [1, 0],  // Horizontal
    [0, 1],  // Vertical
    [1, 1],  // Diagonal \
    [1, -1]  // Diagonal /
];

/**
 * Check win condition on the server side
 */
function toIndex(row, col) {
    return row * GRID_SIZE + col;
}

function checkWin(board, row, col, player) {
    // board is 15x15 array
    for (const [dx, dy] of DIRECTIONS) {
        let count = 1;

        // Check forward
        for (let i = 1; i < WIN_COUNT; i++) {
            const r = row + dy * i;
            const c = col + dx * i;
            if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && board[r][c] === player) {
                count++;
            } else break;
        }

        // Check backward
        for (let i = 1; i < WIN_COUNT; i++) {
            const r = row - dy * i;
            const c = col - dx * i;
            if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && board[r][c] === player) {
                count++;
            } else break;
        }

        if (count >= WIN_COUNT) {
            return true;
        }
    }
    return false;
}

/**
 * Register Caro game handlers for a socket
 */
function registerCaroHandlers(io, socket, rooms) {

    // Handle Caro join
    function handleCaroJoin(roomId, username) {
        let room = rooms.get(roomId);

        // Create room if not exists
        if (!room) {
            room = {
                type: 'caro',
                board: Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)),
                turn: 'X', // X always starts
                players: {
                    X: null,
                    O: null
                },
                winner: null,
                winningCells: []
            };
            rooms.set(roomId, room);
            console.log(`[CARO] Created room: ${roomId}`);
        }

        // Assign symbol
        let symbol = null;
        if (!room.players.X) {
            room.players.X = { id: socket.id, username };
            symbol = 'X';
        } else if (!room.players.O) {
            room.players.O = { id: socket.id, username };
            symbol = 'O';
        } else {
            symbol = 'S'; // Spectator
        }

        console.log(`[CARO] Player ${socket.id} joined as ${symbol}`);

        // Notify user
        socket.emit('room_joined', {
            roomId,
            symbol,
            board: room.board,
            turn: room.turn,
            winner: room.winner,
            players: room.players,
            playerCount: io.sockets.adapter.rooms.get(roomId)?.size || 0
        });

        // Notify room
        io.to(roomId).emit('player_update', {
            players: room.players,
            playerCount: io.sockets.adapter.rooms.get(roomId)?.size || 0
        });
    }

    // Make move
    socket.on('make_move', ({ roomId, row, col }) => {
        const room = rooms.get(roomId);

        if (!room || room.type !== 'caro' || room.winner) return;

        // Verify turn
        const isX = room.players.X?.id === socket.id;
        const isO = room.players.O?.id === socket.id;
        const playerSymbol = isX ? 'X' : (isO ? 'O' : null);

        if (!playerSymbol) return; // Spectator cannot move
        if (room.turn !== playerSymbol) return; // Not your turn

        // Verify valid move
        if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE || room.board[row][col]) return;

        // Update board
        room.board[row][col] = playerSymbol;

        // Check win
        if (checkWin(room.board, row, col, playerSymbol)) {
            room.winner = playerSymbol;
            // We could calculate winning cells here if we want to highlight them on all clients
            // For now, simpler to just declare winner
            io.to(roomId).emit('game_over', { winner: playerSymbol });
        } else {
            // Switch turn
            room.turn = room.turn === 'X' ? 'O' : 'X';
        }

        // Broadcast update
        io.to(roomId).emit('game_state_update', {
            board: room.board,
            turn: room.turn,
            lastMove: { row, col, player: playerSymbol }
        });
    });

    // Restart game
    socket.on('restart_game', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room && room.type === 'caro') {
            // Only players can restart? Or maybe just reset board
            room.board = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
            room.turn = 'X';
            room.winner = null;
            room.winningCells = [];

            io.to(roomId).emit('game_reset', {
                board: room.board,
                turn: room.turn
            });
        }
    });

    // Handle disconnect
    function handleCaroDisconnect(roomId, room) {
        let found = false;
        if (room.players.X?.id === socket.id) {
            room.players.X = null;
            found = true;
        } else if (room.players.O?.id === socket.id) {
            room.players.O = null;
            found = true;
        }

        if (found) {
            io.to(roomId).emit('player_update', {
                players: room.players,
                playerCount: io.sockets.adapter.rooms.get(roomId)?.size || 0
            });

            // Optional: If a player leaves, maybe just pause or notify?
            // For now, let's just leave it as is.
            const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
            if (roomSize === 0) {
                rooms.delete(roomId);
                console.log(`[CARO] Room ${roomId} deleted (empty)`);
            }
        }
        return found;
    }

    return { handleCaroJoin, handleCaroDisconnect };
}

module.exports = { registerCaroHandlers };
