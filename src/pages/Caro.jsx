import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { socketService } from '../services/socket';

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
    const { user, loading } = useAuth();
    const [board, setBoard] = useState(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)));
    const [isXNext, setIsXNext] = useState(true);
    const [winner, setWinner] = useState(null); // 'X' or 'O' or 'Draw'
    const [winningCells, setWinningCells] = useState([]); // Array of {row, col}

    // Online Mode State
    const [mode, setMode] = useState('menu'); // 'menu', 'local', 'online'
    const [roomId, setRoomId] = useState('');
    const [playerSymbol, setPlayerSymbol] = useState(null); // 'X', 'O', or 'S'
    const [players, setPlayers] = useState({ X: null, O: null });
    const [statusMsg, setStatusMsg] = useState('');
    const [joinRequest, setJoinRequest] = useState(null);

    // Socket Connection
    useEffect(() => {
        if (mode === 'online') {
            const socket = socketService.connect();

            socket.on('room_joined', (data) => {
                console.log('Joined room:', data);
                setPlayerSymbol(data.symbol);
                setBoard(data.board);
                setIsXNext(data.turn === 'X');
                setWinner(data.winner);
                setPlayers(data.players || { X: null, O: null });
                setStatusMsg(`Room: ${data.roomId}`);
                if (data.symbol === 'S') alert("Room full! You are watching.");
            });

            socket.on('game_state_update', (data) => {
                setBoard(data.board);
                setIsXNext(data.turn === 'X');
            });

            socket.on('game_reset', (data) => {
                setBoard(data.board);
                setIsXNext(data.turn === 'X');
                setWinner(null);
                setWinningCells([]);
                alert("Game Restarted!");
            });

            socket.on('game_over', (data) => {
                setWinner(data.winner);
            });

            socket.on('player_update', (data) => {
                setPlayers(data.players || { X: null, O: null });
            });

            return () => {
                socketService.disconnect();
            };
        }
    }, [mode]);

    // Handle Join Request
    useEffect(() => {
        if (mode === 'online' && joinRequest && !loading) {
            const socket = socketService.connect();
            const performJoin = () => {
                socket.emit('join_room', {
                    roomId: joinRequest.roomId,
                    username: user?.username || 'Guest_' + Math.floor(Math.random() * 1000),
                    gameType: 'caro'
                });
                setJoinRequest(null);
            };

            if (socket.connected) performJoin();
            else socket.once('connect', performJoin);

            return () => {
                socket.off('connect', performJoin);
            };
        }
    }, [joinRequest, mode, user, loading]);

    const handleJoinRoom = (idToJoin) => {
        const targetId = idToJoin || roomId;
        if (!targetId.trim()) return alert("Enter Room ID");
        setRoomId(targetId);
        setMode('online');
        setJoinRequest({ roomId: targetId });
    };

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

        if (mode === 'online') {
            if (playerSymbol !== (isXNext ? 'X' : 'O')) return; // Not your turn

            socketService.emit('make_move', {
                roomId,
                row,
                col
            });
            return;
        }

        // Local Logic
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
        if (mode === 'online') {
            socketService.emit('restart_game', { roomId });
            return;
        }
        setBoard(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)));
        setIsXNext(true);
        setWinner(null);
        setWinningCells([]);
    };

    if (mode === 'menu') {
        return (
            <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center font-sans p-4">
                <h1 className="text-4xl font-bold mb-8 text-blue-800">⭕ Cờ Caro Online ❌</h1>
                <div className="flex flex-col gap-4 w-full max-w-sm">
                    <button onClick={() => setMode('local')} className="bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 shadow-lg transform transition hover:scale-105">
                        🤝 Chơi 2 Người (Local)
                    </button>

                    <div className="bg-white p-6 rounded-xl text-center shadow-xl border border-blue-100">
                        <h3 className="font-bold mb-4 text-xl text-gray-800">🌍 Chơi Online</h3>

                        {/* Create Room */}
                        <button
                            onClick={() => {
                                const newId = Math.random().toString(36).substring(2, 6).toUpperCase();
                                setRoomId(newId);
                                setMode('online');
                                handleJoinRoom(newId);
                            }}
                            className="w-full bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 mb-6 flex items-center justify-center gap-2 shadow-md"
                        >
                            <span>⚡</span> Tạo Phòng Mới
                        </button>

                        <div className="relative flex py-2 items-center mb-4">
                            <div className="flex-grow border-t border-gray-300"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">Hoặc vào phòng</span>
                            <div className="flex-grow border-t border-gray-300"></div>
                        </div>

                        <div className="flex gap-2">
                            <input
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                                placeholder="ID PHÒNG"
                                className="w-full p-2 border border-gray-300 rounded font-mono text-center font-bold uppercase tracking-widest text-gray-800"
                            />
                            <button
                                onClick={() => { if (roomId) { setMode('online'); handleJoinRoom(roomId); } }}
                                className="bg-green-600 text-white px-4 rounded font-bold hover:bg-green-700 shadow-md"
                            >
                                GO
                            </button>
                        </div>
                    </div>
                    <button onClick={() => navigate('/hub')} className="text-gray-500 mt-4 underline hover:text-gray-800">Quay lại Hub</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-blue-50 flex flex-col items-center py-6 font-sans">
            {/* Header */}
            <div className="flex justify-between items-center w-full max-w-2xl px-4 mb-4">
                <button
                    onClick={() => setMode('menu')}
                    className="text-gray-600 hover:text-blue-600 font-bold flex items-center gap-2"
                >
                    ⬅ Menu
                </button>
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-800">Cờ Caro (Gomoku)</h1>
                    {mode === 'online' && <div className="text-sm text-green-600 font-bold">Online Room: {roomId}</div>}
                    <div className="text-xs text-gray-500">{statusMsg}</div>
                </div>
                <div className="w-20"></div> {/* Spacer */}
            </div>

            {/* Status Bar */}
            <div className="bg-white px-8 py-3 rounded-full shadow-md mb-6 flex items-center gap-6">
                <div className={`flex items-center gap-2 ${isXNext ? 'font-bold opacity-100' : 'opacity-40'}`}>
                    <span className="text-blue-600 text-2xl">X</span>
                    <span>{players.X?.username || (mode === 'online' && playerSymbol === 'X' ? user?.username : 'Waiting...')}</span>
                    {mode === 'online' && playerSymbol === 'X' && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-200">YOU</span>}
                </div>
                <div className="text-gray-300">|</div>
                <div className={`flex items-center gap-2 ${!isXNext ? 'font-bold opacity-100' : 'opacity-40'}`}>
                    <span className="text-red-500 text-2xl">O</span>
                    <span>{players.O?.username || (mode === 'online' && playerSymbol === 'O' ? user?.username : 'Waiting...')}</span>
                    {mode === 'online' && playerSymbol === 'O' && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full border border-red-200">YOU</span>}
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
                            {winner === 'X' ?
                                <span className="text-blue-600">{players.X?.username || 'Player X'} Wins!</span> :
                                <span className="text-red-500">{players.O?.username || 'Player O'} Wins!</span>
                            }
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
