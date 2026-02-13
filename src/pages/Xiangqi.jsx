import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { XiangqiLogic } from '../utils/XiangqiLogic';
import { socketService } from '../services/socket';

const CELL_SIZE = 50;

const PIECE_MAP = {
    'r': '車', 'n': '馬', 'b': '象', 'a': '士', 'k': '將', 'c': '砲', 'p': '卒',
    'R': '俥', 'N': '傌', 'B': '相', 'A': '仕', 'K': '帥', 'C': '炮', 'P': '兵'
};

export default function Xiangqi() {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Game Modes: 'menu', 'bot', 'online_lobby', 'online_play'
    const [mode, setMode] = useState('menu');

    // Game Logic
    const [game] = useState(new XiangqiLogic());
    const [board, setBoard] = useState(game.board);
    const [turn, setTurn] = useState(game.turn);
    const [selected, setSelected] = useState(null);
    const [validMoves, setValidMoves] = useState([]);
    const [gameOver, setGameOver] = useState(false);
    const [winner, setWinner] = useState(null);

    // Bot State
    const [difficulty, setDifficulty] = useState('normal');
    const [aiThinking, setAiThinking] = useState(false);

    // Online State
    const [socket, setSocket] = useState(null);
    const [roomId, setRoomId] = useState('');
    const [myColor, setMyColor] = useState(null); // 'red' or 'black'
    const [opponentName, setOpponentName] = useState(null);
    const [playerCount, setPlayerCount] = useState(0);

    // Auth check
    useEffect(() => {
        if (!user) navigate('/');
    }, [user, navigate]);

    // Socket Setup
    useEffect(() => {
        if (mode === 'online_lobby' || mode === 'online_play') {
            const s = socketService.connect();
            setSocket(s);

            const handleRoomJoined = (data) => {
                setMyColor(data.color);
                setTurn(data.turn);
                setPlayerCount(data.playerCount);
                if (data.players.red && data.players.black) {
                    setMode('online_play');
                    const opp = data.color === 'red' ? data.players.black : data.players.red;
                    setOpponentName(opp.username);
                }
            };

            const handlePlayerUpdate = (data) => {
                setPlayerCount(data.playerCount);
                if (data.players.red && data.players.black) {
                    setMode('online_play');
                } else {
                    // Opponent left?
                    if (mode === 'online_play' && playerCount > 1) {
                        alert('Opponent disconnected');
                        setMode('online_lobby');
                        setOpponentName(null);
                        resetGame();
                    }
                }
            };

            const handleGameState = (data) => {
                game.board = data.board;
                game.turn = data.turn;
                setBoard([...game.board]);
                setTurn(game.turn);
            };

            s.on('room_joined', handleRoomJoined);
            s.on('player_update', handlePlayerUpdate);
            s.on('game_state_update', handleGameState);

            return () => {
                s.off('room_joined', handleRoomJoined);
                s.off('player_update', handlePlayerUpdate);
                s.off('game_state_update', handleGameState);
            }
        }
    }, [mode, game, playerCount]);

    // AI Turn Effect
    useEffect(() => {
        if (mode === 'bot' && turn === 'black' && !gameOver && !aiThinking) {
            setAiThinking(true);
            setTimeout(() => {
                let depth = 2; // Normal
                if (difficulty === 'medium') depth = 3;
                if (difficulty === 'hard') depth = 4;

                const move = game.getBestMove(depth);
                if (move) {
                    game.move(move.r1, move.c1, move.r2, move.c2);
                    setBoard([...game.board]);
                    setTurn(game.turn);
                    setGameOver(game.gameOver);
                    setWinner(game.winner);
                }
                setAiThinking(false);
            }, 500);
        }
    }, [turn, gameOver, difficulty, game, mode]);

    const handleSquareClick = (r, c) => {
        if (gameOver || aiThinking) return;

        // Online Restriction
        if (mode === 'online_play') {
            if (turn !== myColor) return; // Not my turn
        } else if (mode === 'bot') {
            if (turn === 'black') return; // Bot's turn
        }

        const piece = board[r][c];
        const isMyPiece = game.getSide(piece) === (mode === 'online_play' ? myColor : 'red');

        if (selected) {
            // Try to move
            if (selected.r === r && selected.c === c) {
                setSelected(null);
                setValidMoves([]);
                return;
            }

            // Check if clicked valid move
            const move = validMoves.find(m => m.r2 === r && m.c2 === c);
            if (move) {
                // Execute Move
                const success = game.move(selected.r, selected.c, r, c);
                if (success) {
                    setBoard([...game.board]);
                    setTurn(game.turn);
                    setGameOver(game.gameOver);
                    setWinner(game.winner);

                    // Send to Socket if Online
                    if (mode === 'online_play' && socket) {
                        socket.emit('make_move', {
                            roomId,
                            move: { r1: selected.r, c1: selected.c, r2: r, c2: c },
                            board: game.board,
                            turn: game.turn
                        });
                    }
                }

                setSelected(null);
                setValidMoves([]);
            } else if (isMyPiece) {
                // Change selection
                selectPiece(r, c);
            } else {
                setSelected(null);
                setValidMoves([]);
            }
        } else {
            if (isMyPiece) {
                selectPiece(r, c);
            }
        }
    };

    const selectPiece = (r, c) => {
        if (mode === 'online_play' && turn !== myColor) return;

        setSelected({ r, c });
        const moves = game.getAllMoves(mode === 'online_play' ? myColor : 'red');
        const myMoves = moves.filter(m => m.r1 === r && m.c1 === c);
        setValidMoves(myMoves);
    };

    const createRoom = () => {
        const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        setRoomId(newRoomId);
        // Direct join with new ID
        if (socket) {
            socket.emit('join_room', {
                roomId: newRoomId,
                username: user.username,
                gameType: 'xiangqi'
            });
            setMode('online_lobby');
        } else {
            const s = socketService.connect();
            setSocket(s);
            setTimeout(() => {
                s.emit('join_room', {
                    roomId: newRoomId,
                    username: user.username,
                    gameType: 'xiangqi'
                });
                setMode('online_lobby');
            }, 300);
        }
    };

    const joinRoom = () => {
        if (!roomId.trim()) return;
        if (socket) {
            socket.emit('join_room', {
                roomId,
                username: user.username,
                gameType: 'xiangqi'
            });
            setMode('online_lobby');
        } else {
            const s = socketService.connect();
            setSocket(s);
            setTimeout(() => {
                s.emit('join_room', {
                    roomId,
                    username: user.username,
                    gameType: 'xiangqi'
                });
                setMode('online_lobby');
            }, 300);
        }
    };

    const getPieceStyle = (piece) => {
        if (piece === '.') return null;
        const isRed = game.isRed(piece);
        return {
            color: isRed ? '#c00' : '#000',
            backgroundColor: '#f0d9b5',
            border: `3px solid ${isRed ? '#c00' : '#000'}`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
        };
    };

    const resetGame = () => {
        game.reset();
        setBoard([...game.board]);
        setTurn('red');
        setGameOver(false);
        setWinner(null);
        setSelected(null);
        setValidMoves([]);
    };

    // --- RENDER HELPERS ---

    if (mode === 'menu') {
        return (
            <div className="min-h-screen bg-stone-100 font-sans flex flex-col items-center pt-20">
                <h1 className="text-4xl font-bold text-red-800 mb-10 mt-10">🧓 Cờ Tướng Online</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl w-full px-4">
                    {/* Bot Mode */}
                    <div className="bg-white p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all cursor-pointer border-2 border-transparent hover:border-red-500"
                        onClick={() => setMode('bot')}
                    >
                        <div className="text-6xl mb-4 text-center">🤖</div>
                        <h2 className="text-2xl font-bold text-center mb-2">Đấu với Máy</h2>
                        <p className="text-gray-500 text-center">Luyện tập chiến thuật với AI thông minh.</p>
                    </div>

                    {/* Online Mode */}
                    <div className="bg-white p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all border-2 border-transparent hover:border-blue-500">
                        <div className="text-6xl mb-4 text-center">⚔️</div>
                        <h2 className="text-2xl font-bold text-center mb-4">Đấu Online</h2>
                        <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                placeholder="Nhập Mã Phòng..."
                                className="border p-2 rounded text-center font-bold uppercase"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={createRoom}
                                    className="flex-1 bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700"
                                >
                                    Tạo Phòng
                                </button>
                                <button
                                    onClick={joinRoom}
                                    className="flex-1 bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700"
                                >
                                    Vào Phòng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <button onClick={() => navigate('/hub')} className="mt-10 text-gray-500 hover:text-gray-800 underline">
                    Quay lại GameHub
                </button>
            </div>
        );
    }

    if (mode === 'online_lobby') {
        return (
            <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center">
                <div className="bg-white p-10 rounded-2xl shadow-2xl text-center">
                    <h2 className="text-2xl font-bold mb-4">Phòng: {roomId}</h2>
                    <div className="text-6xl mb-4 animate-bounce">⏳</div>
                    <p className="text-xl mb-6">Đang chờ đối thủ...</p>
                    <p className="text-gray-500">Chia sẻ mã phòng này cho bạn bè để cùng chơi!</p>
                    <button onClick={() => { setMode('menu'); if (socket) socket.disconnect(); }} className="mt-8 text-red-500 hover:underline">
                        Hủy bỏ
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-stone-100 font-sans flex flex-col items-center">
            {/* Navbar */}
            <div className="w-full bg-red-900 text-white p-4 shadow-lg flex justify-between items-center fixed top-0 z-20">
                <div className="font-bold text-xl flex items-center gap-2">
                    <span className="text-2xl">🧓</span>
                    {mode === 'bot' ? 'Cờ Tướng vs Máy' : `Phòng ${roomId}`}
                </div>
                <div className="flex items-center gap-4 text-sm font-medium">
                    <button onClick={() => { setMode('menu'); if (socket) socket.disconnect(); }} className="hover:text-yellow-400 transition-colors">
                        Thoát
                    </button>
                    <div className="bg-white/20 px-3 py-1 rounded-full">
                        💰 {user?.balance ? user.balance.toLocaleString() : 0}
                    </div>
                </div>
            </div>

            <div className="mt-24 mb-10 flex flex-col items-center justify-center p-4">

                {/* Controls */}
                <div className="mb-6 flex gap-4 items-center bg-white p-4 rounded-xl shadow-md min-w-[500px] justify-between">
                    <div>
                        {mode === 'bot' ? (
                            <select
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value)}
                                className="p-2 border rounded-md"
                                disabled={aiThinking}
                            >
                                <option value="normal">Bình thường</option>
                                <option value="medium">Khó</option>
                                <option value="hard">Thử thách</option>
                            </select>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${myColor === 'red' ? 'bg-red-600' : 'bg-black'}`}></span>
                                <span className="font-bold">Bạn là: {myColor === 'red' ? 'Đỏ (Đi trước)' : 'Đen'}</span>
                            </div>
                        )}
                    </div>

                    <div className="font-bold text-lg">
                        {gameOver ? (
                            <span className={winner === (mode === 'online_play' ? myColor : 'red') ? 'text-red-600' : 'text-black'}>
                                {winner === (mode === 'online_play' ? myColor : 'red') ? 'BẠN THẮNG! 🎉' : 'BẠN THUA 😭'}
                            </span>
                        ) : (
                            <span className={turn === 'red' ? 'text-red-600' : 'text-black'}>
                                {mode === 'online_play'
                                    ? (turn === myColor ? 'Lượt của bạn' : 'Đối thủ đang nghĩ...')
                                    : (turn === 'red' ? 'Lượt của bạn' : 'Máy đang nghĩ...')
                                }
                            </span>
                        )}
                    </div>

                    {mode === 'bot' && (
                        <button
                            onClick={resetGame}
                            className="ml-4 px-4 py-2 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600"
                        >
                            Ván Mới
                        </button>
                    )}
                </div>

                {/* BOARD */}
                <div
                    className={`relative bg-[#e6cca0] shadow-2xl border-4 border-[#8b5a2b] select-none ${turn !== (mode === 'online_play' ? myColor : 'red') ? 'cursor-wait' : ''}`}
                    style={{
                        width: 450,
                        height: 500,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(9, 1fr)',
                        gridTemplateRows: 'repeat(10, 1fr)',
                        padding: 2
                    }}
                >
                    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 p-[25px]">
                        {[...Array(10)].map((_, i) => (
                            <line key={`h${i}`} x1="0" y1={i * 50} x2="400" y2={i * 50} stroke="#8b5a2b" strokeWidth="2" />
                        ))}
                        {[...Array(9)].map((_, i) => (
                            <React.Fragment key={`v${i}`}>
                                {i !== 0 && i !== 8 && (
                                    <>
                                        <line x1={i * 50} y1="0" x2={i * 50} y2="200" stroke="#8b5a2b" strokeWidth="2" />
                                        <line x1={i * 50} y1="250" x2={i * 50} y2="450" stroke="#8b5a2b" strokeWidth="2" />
                                    </>
                                )}
                                {(i === 0 || i === 8) && (
                                    <line x1={i * 50} y1="0" x2={i * 50} y2="450" stroke="#8b5a2b" strokeWidth="2" />
                                )}
                            </React.Fragment>
                        ))}
                        <line x1="150" y1="0" x2="250" y2="100" stroke="#8b5a2b" strokeWidth="2" />
                        <line x1="250" y1="0" x2="150" y2="100" stroke="#8b5a2b" strokeWidth="2" />
                        <line x1="150" y1="350" x2="250" y2="450" stroke="#8b5a2b" strokeWidth="2" />
                        <line x1="250" y1="350" x2="150" y2="450" stroke="#8b5a2b" strokeWidth="2" />
                        <text x="80" y="235" fill="#8b5a2b" fontSize="24" fontFamily="serif">楚 河</text>
                        <text x="260" y="235" fill="#8b5a2b" fontSize="24" fontFamily="serif">漢 界</text>
                    </svg>

                    {board.map((row, r) => (
                        row.map((piece, c) => {
                            const isSelected = selected && selected.r === r && selected.c === c;
                            const isTarget = validMoves.some(m => m.r2 === r && m.c2 === c);

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    onClick={() => handleSquareClick(r, c)}
                                    className={`
                                        z-10 flex items-center justify-center cursor-pointer relative
                                        ${isTarget ? 'bg-green-500/30 rounded-full' : ''}
                                    `}
                                    style={{ width: '100%', height: '100%' }}
                                >
                                    {piece !== '.' && (
                                        <div
                                            className={`
                                                w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl
                                                transition-transform hover:scale-110 shadow-md
                                                ${isSelected ? 'ring-4 ring-blue-500 scale-110' : ''}
                                            `}
                                            style={getPieceStyle(piece)}
                                        >
                                            {PIECE_MAP[piece]}
                                        </div>
                                    )}
                                    {isTarget && piece === '.' && (
                                        <div className="w-4 h-4 bg-green-500 rounded-full opacity-50"></div>
                                    )}
                                </div>
                            );
                        })
                    ))}
                </div>
            </div>
        </div>
    );
}
