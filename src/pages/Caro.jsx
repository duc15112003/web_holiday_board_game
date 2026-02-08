import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GRID_SIZE = 15;
const WIN_COUNT = 5;

// Directions to check for win: [dx, dy]
const DIRECTIONS = [
    [1, 0],  // Horizontal
    [0, 1],  // Vertical
    [1, 1],  // Diagonal \
    [1, -1]  // Diagonal /
];

export default function Caro() {
    const navigate = useNavigate();
    const [board, setBoard] = useState(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)));
    const [isXNext, setIsXNext] = useState(true);
    const [winner, setWinner] = useState(null); // 'X' or 'O' or 'Draw'
    const [winningCells, setWinningCells] = useState([]); // Array of {row, col}

    const checkWin = (row, col, player, boardState) => {
        for (const [dx, dy] of DIRECTIONS) {
            let count = 1;
            const currentWinning = [{ r: row, c: col }];

            // Check forward
            for (let i = 1; i < WIN_COUNT; i++) {
                const r = row + dy * i;
                const c = col + dx * i;
                if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && boardState[r][c] === player) {
                    count++;
                    currentWinning.push({ r, c });
                } else break;
            }

            // Check backward
            for (let i = 1; i < WIN_COUNT; i++) {
                const r = row - dy * i;
                const c = col - dx * i;
                if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && boardState[r][c] === player) {
                    count++;
                    currentWinning.push({ r, c });
                } else break;
            }

            if (count >= WIN_COUNT) {
                return currentWinning;
            }
        }
        return null;
    };

    const handleCellClick = (row, col) => {
        if (winner || board[row][col]) return;

        const newBoard = board.map(r => [...r]);
        const currentPlayer = isXNext ? 'X' : 'O';
        newBoard[row][col] = currentPlayer;
        setBoard(newBoard);

        const winCells = checkWin(row, col, currentPlayer, newBoard);
        if (winCells) {
            setWinner(currentPlayer);
            setWinningCells(winCells);
        } else {
            setIsXNext(!isXNext);
        }
    };

    const resetGame = () => {
        setBoard(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)));
        setIsXNext(true);
        setWinner(null);
        setWinningCells([]);
    };

    return (
        <div className="min-h-screen bg-blue-50 flex flex-col items-center py-6 font-sans">
            {/* Header */}
            <div className="flex justify-between items-center w-full max-w-2xl px-4 mb-4">
                <button
                    onClick={() => navigate('/hub')}
                    className="text-gray-600 hover:text-blue-600 font-bold flex items-center gap-2"
                >
                    ⬅ Game Hub
                </button>
                <h1 className="text-2xl font-bold text-gray-800">Cờ Caro (Gomoku)</h1>
                <div className="w-20"></div> {/* Spacer */}
            </div>

            {/* Status Bar */}
            <div className="bg-white px-8 py-3 rounded-full shadow-md mb-6 flex items-center gap-6">
                <div className={`flex items-center gap-2 ${isXNext ? 'font-bold opacity-100' : 'opacity-40'}`}>
                    <span className="text-blue-600 text-2xl">X</span>
                    <span>Player 1</span>
                </div>
                <div className="text-gray-300">|</div>
                <div className={`flex items-center gap-2 ${!isXNext ? 'font-bold opacity-100' : 'opacity-40'}`}>
                    <span className="text-red-500 text-2xl">O</span>
                    <span>Player 2</span>
                </div>
            </div>

            {/* Board */}
            <div className="bg-white p-2 rounded-lg shadow-xl border border-gray-300 overflow-x-auto max-w-full">
                <div
                    className="grid gap-[1px] bg-gray-200"
                    style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(30px, 1fr))` }}
                >
                    {board.map((rowArr, r) => (
                        rowArr.map((cell, c) => {
                            const isWinCell = winningCells.some(wc => wc.r === r && wc.c === c);
                            return (
                                <div
                                    key={`${r}-${c}`}
                                    onClick={() => handleCellClick(r, c)}
                                    className={`
                                        w-8 h-8 sm:w-10 sm:h-10 bg-white flex items-center justify-center text-xl sm:text-2xl cursor-pointer hover:bg-gray-50
                                        ${isWinCell ? 'bg-green-200' : ''}
                                    `}
                                >
                                    {cell === 'X' && <span className="text-blue-600 font-bold">X</span>}
                                    {cell === 'O' && <span className="text-red-500 font-bold">O</span>}
                                </div>
                            );
                        })
                    ))}
                </div>
            </div>

            {/* Winner Overlay */}
            {winner && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl text-center transform scale-110">
                        <h2 className="text-3xl font-bold mb-2">
                            {winner === 'X' ? <span className="text-blue-600">Player X Wins!</span> : <span className="text-red-500">Player O Wins!</span>}
                        </h2>
                        <div className="text-6xl mb-6">🏆</div>
                        <button
                            onClick={resetGame}
                            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition"
                        >
                            Chơi lại
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
