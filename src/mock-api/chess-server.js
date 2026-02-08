import { Chess } from 'chess.js';

// In-memory store for game states (mock database)
const games = new Map();

export const chessApi = {
    // Create or get existing game
    getGame: (gameId = 'local-match') => {
        if (!games.has(gameId)) {
            games.set(gameId, new Chess());
        }
        const chess = games.get(gameId);
        return {
            fen: chess.fen(),
            turn: chess.turn(), // 'w' or 'b'
            isGameOver: chess.isGameOver(),
            isCheck: chess.isCheck(),
            isCheckmate: chess.isCheckmate(),
            isDraw: chess.isDraw(),
            history: chess.history({ verbose: true })
        };
    },

    // Make a move
    move: (gameId = 'local-match', from, to, promotion = 'q') => {
        const chess = games.get(gameId);
        if (!chess) throw new Error("Game not found");

        try {
            const move = chess.move({ from, to, promotion }); // Returns move object or null
            if (!move) throw new Error("Invalid move");

            return {
                success: true,
                fen: chess.fen(),
                turn: chess.turn(),
                isGameOver: chess.isGameOver(),
                isCheck: chess.isCheck(),
                isCheckmate: chess.isCheckmate(),
                isDraw: chess.isDraw(),
                history: chess.history({ verbose: true }),
                lastMove: move
            };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    // Reset game
    reset: (gameId = 'local-match') => {
        games.set(gameId, new Chess());
        return chessApi.getGame(gameId);
    }
};
