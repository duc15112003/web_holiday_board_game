
// Xiangqi Logic & AI
// Representations:
// Board: 10x9 grid
// Pieces: Red (uppercase), Black (lowercase)
// R/r: Rook (Chariot), N/n: Knight (Horse), B/b: Bishop (Elephant), A/a: Advisor, K/k: King, C/c: Cannon, P/p: Pawn (Soldier)
// .: Empty

const INITIAL_BOARD = [
    ['r', 'n', 'b', 'a', 'k', 'a', 'b', 'n', 'r'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['.', 'c', '.', '.', '.', '.', '.', 'c', '.'],
    ['p', '.', 'p', '.', 'p', '.', 'p', '.', 'p'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['P', '.', 'P', '.', 'P', '.', 'P', '.', 'P'],
    ['.', 'C', '.', '.', '.', '.', '.', 'C', '.'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['R', 'N', 'B', 'A', 'K', 'A', 'B', 'N', 'R']
];

const PIECE_VALUES = {
    'k': 10000, 'a': 20, 'b': 20, 'n': 40, 'r': 90, 'c': 45, 'p': 10,
    'K': 10000, 'A': 20, 'B': 20, 'N': 40, 'R': 90, 'C': 45, 'P': 10
};

export class XiangqiLogic {
    constructor() {
        this.board = JSON.parse(JSON.stringify(INITIAL_BOARD));
        this.turn = 'red'; // 'red' or 'black'
        this.gameOver = false;
        this.winner = null;
        this.history = [];
    }

    reset() {
        this.board = JSON.parse(JSON.stringify(INITIAL_BOARD));
        this.turn = 'red';
        this.gameOver = false;
        this.winner = null;
        this.history = [];
    }

    // Helper: partial deep copy for AI
    cloneBoard(board) {
        return board.map(row => [...row]);
    }

    isRed(piece) { return piece >= 'A' && piece <= 'Z'; }
    isBlack(piece) { return piece >= 'a' && piece <= 'z'; }
    isEmpty(piece) { return piece === '.'; }
    getSide(piece) {
        if (this.isEmpty(piece)) return null;
        return this.isRed(piece) ? 'red' : 'black';
    }

    isValidMove(r1, c1, r2, c2, board = this.board, turn = this.turn) {
        if (r1 < 0 || r1 > 9 || c1 < 0 || c1 > 8) return false;
        if (r2 < 0 || r2 > 9 || c2 < 0 || c2 > 8) return false;
        if (r1 === r2 && c1 === c2) return false;

        const piece = board[r1][c1];
        const target = board[r2][c2];

        if (this.isEmpty(piece)) return false;
        if (this.getSide(piece) !== turn) return false; // Not your piece
        if (!this.isEmpty(target) && this.getSide(piece) === this.getSide(target)) return false; // Friendly fire

        const lowerPiece = piece.toLowerCase();
        const dr = r2 - r1;
        const dc = c2 - c1;

        switch (lowerPiece) {
            case 'k': // King (General)
                // Orthogonal 1 step, must stay in palace
                if (Math.abs(dr) + Math.abs(dc) !== 1) return false;
                if (c2 < 3 || c2 > 5) return false;
                if (this.isRed(piece)) { if (r2 > 9 || r2 < 7) return false; }
                else { if (r2 < 0 || r2 > 2) return false; }
                // Flying General rule (kings facing each other) - simplified check usually done separately
                return true;

            case 'a': // Advisor
                // Diagonal 1 step, stay in palace
                if (Math.abs(dr) !== 1 || Math.abs(dc) !== 1) return false;
                if (c2 < 3 || c2 > 5) return false;
                if (this.isRed(piece)) { if (r2 > 9 || r2 < 7) return false; }
                else { if (r2 < 0 || r2 > 2) return false; }
                return true;

            case 'b': // Bishop (Elephant)
                // Diagonal 2 steps, cannot cross river, blocking eye
                if (Math.abs(dr) !== 2 || Math.abs(dc) !== 2) return false;
                // Blocked eye
                if (board[r1 + dr / 2][c1 + dc / 2] !== '.') return false;
                // Cannot cross river
                if (this.isRed(piece)) { if (r2 < 5) return false; }
                else { if (r2 > 4) return false; }
                return true;

            case 'n': // Knight (Horse)
                // L shape, check blocking leg
                if (!((Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2))) return false;
                // Check block
                if (Math.abs(dr) === 2) {
                    if (board[r1 + (dr > 0 ? 1 : -1)][c1] !== '.') return false;
                } else {
                    if (board[r1][c1 + (dc > 0 ? 1 : -1)] !== '.') return false;
                }
                return true;

            case 'r': // Rook (Chariot)
                // Orthogonal any distance, no jump
                if (dr !== 0 && dc !== 0) return false;
                return this.countObstacles(r1, c1, r2, c2, board) === 0;

            case 'c': // Cannon
                // Move like rook, capture requires 1 hurdle
                if (dr !== 0 && dc !== 0) return false;
                const obstacles = this.countObstacles(r1, c1, r2, c2, board);
                if (this.isEmpty(target)) {
                    return obstacles === 0; // Move
                } else {
                    return obstacles === 1; // Capture
                }

            case 'p': // Pawn (Soldier)
                // Forward 1 step. After crossing river, also sideways.
                // Red moves UP (-row), Black moves DOWN (+row)
                if (this.isRed(piece)) {
                    if (r2 > r1) return false; // Cannot move backward
                    if (r1 >= 5) { // Before river
                        return r1 - r2 === 1 && c1 === c2;
                    } else { // After river
                        return (r1 - r2 === 1 && c1 === c2) || (r1 === r2 && Math.abs(c1 - c2) === 1);
                    }
                } else {
                    if (r2 < r1) return false;
                    if (r1 <= 4) { // Before river
                        return r2 - r1 === 1 && c1 === c2;
                    } else {
                        return (r2 - r1 === 1 && c1 === c2) || (r1 === r2 && Math.abs(c1 - c2) === 1);
                    }
                }
        }
        return false;
    }

    countObstacles(r1, c1, r2, c2, board) {
        let count = 0;
        if (r1 === r2) { // Horizontal
            const minC = Math.min(c1, c2);
            const maxC = Math.max(c1, c2);
            for (let c = minC + 1; c < maxC; c++) {
                if (board[r1][c] !== '.') count++;
            }
        } else { // Vertical
            const minR = Math.min(r1, r2);
            const maxR = Math.max(r1, r2);
            for (let r = minR + 1; r < maxR; r++) {
                if (board[r][c1] !== '.') count++;
            }
        }
        return count;
    }

    getAllMoves(turn, board = this.board) {
        const moves = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = board[r][c];
                if (this.isEmpty(piece)) continue;
                if (this.getSide(piece) === turn) {
                    // Check all convenient targets for efficiency? No, just scan relevant area or all board
                    // Optimized scanning based on piece type
                    // For simplicity, scan all board for targets (slow but ok for JS)
                    // Better: scan logical moves based on piece type
                    const possibleMoves = this.getPotentialMoves(r, c, piece, board);
                    possibleMoves.forEach(m => {
                        if (this.isValidMove(r, c, m.r, m.c, board, turn)) {
                            // Also check for Flying General? 
                            // And checking if King is in check after move? (Crucial)
                            if (!this.causesSelfCheck(r, c, m.r, m.c, board, turn)) {
                                moves.push({ r1: r, c1: c, r2: m.r, c2: m.c });
                            }
                        }
                    });
                }
            }
        }
        return moves;
    }

    getPotentialMoves(r, c, piece, board) {
        // Returns list of {r, c} that are geometrically plausible
        // Logic similar to isValidMove checks but generating
        const lower = piece.toLowerCase();
        const moves = [];
        const tryAdd = (nr, nc) => {
            if (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) moves.push({ r: nr, c: nc });
        };

        if (lower === 'k' || lower === 'a') {
            // Palace bounds logic handled in isValid
            const deltas = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
            deltas.forEach(d => tryAdd(r + d[0], c + d[1]));
        } else if (lower === 'b') {
            [[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(d => tryAdd(r + d[0], c + d[1]));
        } else if (lower === 'n') {
            [[1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]].forEach(d => tryAdd(r + d[0], c + d[1]));
        } else if (lower === 'r' || lower === 'c') {
            // Scan lines
            for (let i = 0; i < 10; i++) if (i !== r) tryAdd(i, c);
            for (let i = 0; i < 9; i++) if (i !== c) tryAdd(r, i);
        } else if (lower === 'p') {
            [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(d => tryAdd(r + d[0], c + d[1]));
        }
        return moves;
    }

    causesSelfCheck(r1, c1, r2, c2, board, turn) {
        // Make move on tmp board
        const tmpBoard = this.cloneBoard(board);
        tmpBoard[r2][c2] = tmpBoard[r1][c1];
        tmpBoard[r1][c1] = '.';

        // Find my King
        let kingPos = null;
        const kingChar = turn === 'red' ? 'K' : 'k';
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (tmpBoard[r][c] === kingChar) kingPos = { r, c };
            }
        }
        if (!kingPos) return true; // King eaten (shouldnt happen)

        // Check if flying general
        // Check if any enemy piece can attack kingPos
        const enemy = turn === 'red' ? 'black' : 'red';

        // 1. Flying General
        const enemyKingChar = turn === 'red' ? 'k' : 'K';
        let enemyKingPos = null;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (tmpBoard[r][c] === enemyKingChar) enemyKingPos = { r, c };
            }
        }
        if (enemyKingPos && kingPos.c === enemyKingPos.c) {
            let obstacles = this.countObstacles(kingPos.r, kingPos.c, enemyKingPos.r, enemyKingPos.c, tmpBoard);
            if (obstacles === 0) return true;
        }

        // 2. Normal attacks
        // Optimization: Checking isAttacked is hard, easier to just iterate all enemy moves?
        // Or reverse check: can a Knight attack King from here?
        // Let's iterate all enemy pieces for correctness first
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = tmpBoard[r][c];
                if (!this.isEmpty(p) && this.getSide(p) === enemy) {
                    if (this.isValidMove(r, c, kingPos.r, kingPos.c, tmpBoard, enemy)) return true;
                }
            }
        }
        return false;
    }

    move(r1, c1, r2, c2) {
        if (this.gameOver) return false;
        if (!this.isValidMove(r1, c1, r2, c2)) return false;
        if (this.causesSelfCheck(r1, c1, r2, c2, this.board, this.turn)) return false;

        // Execute
        const captured = this.board[r2][c2];
        this.board[r2][c2] = this.board[r1][c1];
        this.board[r1][c1] = '.';

        // Record
        this.history.push({
            from: { r: r1, c: c1 },
            to: { r: r2, c: c2 },
            piece: this.board[r2][c2],
            captured: captured
        });

        // Check win (King captured? usually checkmate logic, but simple capture ok for now if missed check)
        if (captured.toLowerCase() === 'k') {
            this.gameOver = true;
            this.winner = this.turn;
            return true;
        }

        // Switch turn
        this.turn = this.turn === 'red' ? 'black' : 'red';

        // Check Mate / Stalemate logic could go here
        return true;
    }

    // AI Section
    evaluateBoard(board) {
        let score = 0;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p === '.') continue;
                const val = PIECE_VALUES[p];
                // Positional Bonuses could be added here
                if (this.isRed(p)) score += val;
                else score -= val;
            }
        }
        return score; // Positive = Red advantage
    }

    minimax(depth, isMaximizing, alpha, beta, board) {
        if (depth === 0) return this.evaluateBoard(board);

        const possibleMoves = this.getAllMoves(isMaximizing ? 'red' : 'black', board);
        if (possibleMoves.length === 0) return isMaximizing ? -100000 : 100000; // Checkmate/Stalemate

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (let move of possibleMoves) {
                const newBoard = this.cloneBoard(board);
                // Apply move
                const captured = newBoard[move.r2][move.c2];
                newBoard[move.r2][move.c2] = newBoard[move.r1][move.c1];
                newBoard[move.r1][move.c1] = '.';
                // King capture check for safety
                if (captured === 'k') return 100000;

                const evalScore = this.minimax(depth - 1, false, alpha, beta, newBoard);
                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (let move of possibleMoves) {
                const newBoard = this.cloneBoard(board);
                const captured = newBoard[move.r2][move.c2];
                newBoard[move.r2][move.c2] = newBoard[move.r1][move.c1];
                newBoard[move.r1][move.c1] = '.';
                if (captured === 'K') return -100000;

                const evalScore = this.minimax(depth - 1, true, alpha, beta, newBoard);
                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    getBestMove(depth = 2) {
        const moves = this.getAllMoves(this.turn);
        if (moves.length === 0) return null;

        let bestMove = null;
        let bestValue = this.turn === 'red' ? -Infinity : Infinity;

        // Randomize moves to avoid same game every time
        moves.sort(() => Math.random() - 0.5);

        for (let move of moves) {
            const newBoard = this.cloneBoard(this.board);
            newBoard[move.r2][move.c2] = newBoard[move.r1][move.c1];
            newBoard[move.r1][move.c1] = '.';

            // If captures king, take it immediately
            if (this.board[move.r2][move.c2].toLowerCase() === 'k') return move;

            const boardValue = this.minimax(depth - 1, this.turn === 'red' ? false : true, -Infinity, Infinity, newBoard);

            if (this.turn === 'red') {
                if (boardValue > bestValue) {
                    bestValue = boardValue;
                    bestMove = move;
                }
            } else {
                if (boardValue < bestValue) {
                    bestValue = boardValue;
                    bestMove = move;
                }
            }
        }
        return bestMove;
    }
}
