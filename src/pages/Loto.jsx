import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { socketService } from '../services/socket';
import { useNavigate } from 'react-router-dom';

export default function Loto() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [socket, setSocket] = useState(null);

    // Lobby State
    const [screen, setScreen] = useState('lobby'); // lobby, game
    const [roomIdInput, setRoomIdInput] = useState('');
    const [error, setError] = useState('');

    // Game State
    const [roomId, setRoomId] = useState(null);
    const [gameState, setGameState] = useState('waiting');
    const [players, setPlayers] = useState([]);
    const [hostId, setHostId] = useState(null);
    const [myTicket, setMyTicket] = useState(null);
    const [drawnNumbers, setDrawnNumbers] = useState([]);
    const [currentNumber, setCurrentNumber] = useState(null);
    const [isHost, setIsHost] = useState(false);
    const [winner, setWinner] = useState(null);
    const [markedNumbers, setMarkedNumbers] = useState(new Set());

    // Connect socket on mount
    useEffect(() => {
        if (!user) {
            navigate('/');
            return;
        }
        const s = socketService.connect();
        setSocket(s);

        return () => {
            // Don't disconnect here, let the service manage it
        };
    }, [user, navigate]);

    // Setup socket listeners when we have a socket and roomId
    useEffect(() => {
        if (!socket || !roomId) return;

        const onRoomUpdate = ({ room }) => {
            console.log('Room Update:', room);
            setPlayers(room.players || []);
            setGameState(room.gameState || 'waiting');
            setDrawnNumbers(room.drawnNumbers || []);
            setHostId(room.host);
            setIsHost(room.host === socket.id);
            if (room.winner) setWinner(room.winner);

            // Find my ticket
            const me = room.players?.find(p => p.id === socket.id);
            if (me && me.ticket) {
                setMyTicket(me.ticket);
            }
        };

        const onGameStarted = ({ room }) => {
            console.log('Game Started:', room);
            setGameState('playing');
            setDrawnNumbers([]);
            setCurrentNumber(null);
            setMarkedNumbers(new Set());
            setWinner(null);
        };

        const onNumberDrawn = ({ number, drawnNumbers: allDrawn }) => {
            console.log('Number Drawn:', number);
            setCurrentNumber(number);
            setDrawnNumbers(allDrawn);
        };

        const onGameOver = ({ winner: w }) => {
            setGameState('ended');
            setWinner(w);
            alert(`KINH! ${w} chiến thắng!`);
        };

        const onClaimFailed = ({ message }) => {
            alert(message);
        };

        socket.on('loto_room_update', onRoomUpdate);
        socket.on('loto_game_started', onGameStarted);
        socket.on('loto_number_drawn', onNumberDrawn);
        socket.on('loto_game_over', onGameOver);
        socket.on('loto_claim_failed', onClaimFailed);

        return () => {
            socket.off('loto_room_update', onRoomUpdate);
            socket.off('loto_game_started', onGameStarted);
            socket.off('loto_number_drawn', onNumberDrawn);
            socket.off('loto_game_over', onGameOver);
            socket.off('loto_claim_failed', onClaimFailed);
        };
    }, [socket, roomId]);

    // --- Lobby Handlers ---
    const handleCreateRoom = () => {
        const newRoomId = `loto-${Date.now().toString(36)}`;
        joinRoom(newRoomId);
    };

    const handleJoinRoom = () => {
        if (!roomIdInput.trim()) {
            setError('Vui lòng nhập mã phòng');
            return;
        }
        joinRoom(roomIdInput.trim());
    };

    const joinRoom = (id) => {
        if (!socket) {
            setError('Đang kết nối, vui lòng chờ...');
            return;
        }
        setRoomId(id);
        socket.emit('join_room', {
            roomId: id,
            username: user.username,
            gameType: 'loto'
        });
        setScreen('game');
        setError('');
    };

    const handleLeaveRoom = () => {
        setScreen('lobby');
        setRoomId(null);
        setMyTicket(null);
        setPlayers([]);
        setDrawnNumbers([]);
        setCurrentNumber(null);
        setWinner(null);
        setMarkedNumbers(new Set());
        // Optionally emit leave event
    };

    // --- Game Handlers ---
    const handleStartGame = () => {
        socket.emit('loto_start', { roomId });
    };

    const handleDrawNumber = () => {
        socket.emit('loto_draw_number', { roomId });
    };

    const handleReset = () => {
        socket.emit('loto_reset', { roomId });
    };

    const handleClaimWin = () => {
        socket.emit('loto_check_win', { roomId });
    };

    const toggleMark = (num) => {
        if (num === 0) return;
        setMarkedNumbers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(num)) {
                newSet.delete(num);
            } else {
                newSet.add(num);
            }
            return newSet;
        });
    };

    // --- Render: Lobby Screen ---
    const renderLobby = () => (
        <div className="min-h-screen bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="text-6xl mb-4">🎲</div>
                    <h1 className="text-3xl font-extrabold text-gray-800">LÔ TÔ</h1>
                    <p className="text-gray-500">Trò chơi dân gian Việt Nam</p>
                </div>

                {error && (
                    <div className="bg-red-100 text-red-600 p-3 rounded-lg mb-4 text-sm">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <button
                        onClick={handleCreateRoom}
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl text-lg transition-all transform hover:scale-105 shadow-lg"
                    >
                        🏠 Tạo Phòng Mới
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">hoặc</span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={roomIdInput}
                            onChange={(e) => setRoomIdInput(e.target.value)}
                            placeholder="Nhập mã phòng..."
                            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors"
                        />
                        <button
                            onClick={handleJoinRoom}
                            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors"
                        >
                            Vào
                        </button>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <button
                        onClick={() => navigate('/hub')}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        ← Quay lại Game Hub
                    </button>
                </div>
            </div>
        </div>
    );

    // --- Render: Ticket ---
    const renderTicket = () => {
        if (!myTicket) {
            return (
                <div className="bg-yellow-100 p-8 rounded-lg shadow-lg border-2 border-yellow-600 max-w-2xl mx-auto text-center">
                    <div className="animate-spin inline-block w-8 h-8 border-4 border-yellow-600 border-t-transparent rounded-full mb-4"></div>
                    <p className="text-yellow-800 font-bold">Đang lấy vé số...</p>
                    <p className="text-yellow-600 text-sm mt-2">Socket: {socket?.id || 'Connecting...'}</p>
                </div>
            );
        }

        return (
            <div className="bg-yellow-100 p-4 rounded-lg shadow-lg border-2 border-yellow-600 max-w-2xl mx-auto">
                <h3 className="text-center font-bold text-yellow-800 mb-2 uppercase tracking-wide">Vé Số Đại Cát</h3>
                <div className="grid grid-rows-3 gap-1 bg-yellow-600 p-1 rounded">
                    {myTicket.map((row, rIdx) => (
                        <div key={rIdx} className="grid grid-cols-9 gap-1">
                            {row.map((num, cIdx) => {
                                const isMarked = markedNumbers.has(num);
                                const isDrawn = drawnNumbers.includes(num);
                                const isHit = isMarked && isDrawn;

                                return (
                                    <button
                                        key={`${rIdx}-${cIdx}`}
                                        disabled={num === 0}
                                        onClick={() => toggleMark(num)}
                                        className={`
                                            h-12 flex items-center justify-center text-lg font-bold rounded
                                            ${num === 0 ? 'bg-yellow-200' : 'bg-white hover:bg-yellow-50'}
                                            ${isMarked ? 'ring-2 ring-red-500' : ''}
                                            ${isDrawn && !isMarked ? 'bg-blue-100 text-blue-600' : ''} 
                                            ${isHit ? 'bg-red-500 text-white' : ''}
                                            transition-all
                                        `}
                                    >
                                        {num !== 0 ? num : ''}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
                <div className="mt-4 text-center">
                    <button
                        onClick={handleClaimWin}
                        disabled={gameState !== 'playing'}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-3 px-8 rounded-full shadow-lg text-xl"
                    >
                        KINH RỒI! 🎉
                    </button>
                </div>
            </div>
        );
    };

    // --- Render: Board ---
    const renderBoard = () => {
        const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);

        return (
            <div className="bg-white p-4 rounded-xl shadow-md">
                <h3 className="font-bold text-gray-700 mb-2">Bảng Số ({drawnNumbers.length}/90)</h3>
                <div className="flex flex-wrap gap-1 justify-center">
                    {allNumbers.map(num => (
                        <div
                            key={num}
                            className={`
                                w-8 h-8 flex items-center justify-center text-xs font-bold rounded-full
                                ${drawnNumbers.includes(num)
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-400'}
                            `}
                        >
                            {num}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // --- Render: Game Screen ---
    const renderGame = () => (
        <div className="min-h-screen bg-green-50 p-4">
            <header className="max-w-6xl mx-auto flex justify-between items-center mb-6">
                <button
                    onClick={handleLeaveRoom}
                    className="text-gray-600 hover:text-gray-900 font-bold flex items-center gap-2"
                >
                    ⬅ Rời phòng
                </button>
                <div className="text-center">
                    <h1 className="text-3xl font-extrabold text-green-700">LÔ TÔ TRUYỀN THỐNG</h1>
                    <div className="flex items-center justify-center gap-2 mt-1">
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-mono">
                            {roomId}
                        </span>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(roomId);
                                alert('Đã sao chép mã phòng!');
                            }}
                            className="text-green-600 hover:text-green-800"
                            title="Sao chép mã phòng"
                        >
                            📋
                        </button>
                    </div>
                    <p className="text-green-600 text-sm">{players.length} người chơi</p>
                </div>
                <div className="w-20"></div>
            </header>

            <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Game Status & Ticket */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Current Number Display */}
                    <div className="flex justify-center items-center py-8">
                        {currentNumber ? (
                            <div className="relative">
                                <div className="text-9xl font-black text-blue-600 drop-shadow-xl">
                                    {currentNumber}
                                </div>
                                <div className="absolute -top-4 -right-4 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full font-bold shadow animate-bounce">
                                    Mới ra!
                                </div>
                            </div>
                        ) : (
                            <div className="text-4xl text-gray-300 font-bold">
                                {gameState === 'waiting' ? 'Chờ bắt đầu...' : 'Chờ quay số...'}
                            </div>
                        )}
                    </div>

                    {/* Ticket Area */}
                    {renderTicket()}

                    {winner && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg text-center text-2xl font-bold animate-pulse">
                            🏆 {winner} ĐÃ CHIẾN THẮNG! 🏆
                        </div>
                    )}
                </div>

                {/* Right: Controls & Board */}
                <div className="space-y-6">
                    {/* Host Controls */}
                    {isHost && (
                        <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-blue-100">
                            <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
                                👑 Bảng Điều Khiển (Host)
                            </h3>
                            <div className="space-y-3">
                                {gameState === 'waiting' || gameState === 'ended' ? (
                                    <button
                                        onClick={handleStartGame}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors"
                                    >
                                        Bắt đầu ván mới
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleDrawNumber}
                                        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg shadow-md active:transform active:translate-y-1 transition-all"
                                    >
                                        Quay Số 🎲
                                    </button>
                                )}

                                {gameState === 'ended' && (
                                    <button
                                        onClick={handleReset}
                                        className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 rounded-lg"
                                    >
                                        Reset Game
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* All Numbers Board */}
                    {renderBoard()}

                    {/* Players List */}
                    <div className="bg-white p-4 rounded-xl shadow-md">
                        <h3 className="font-bold text-gray-700 mb-2">Người chơi ({players.length})</h3>
                        <ul className="space-y-2 max-h-48 overflow-y-auto">
                            {players.map(p => (
                                <li key={p.id} className="flex items-center gap-2 text-sm text-gray-600">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    <span className={p.id === socket?.id ? 'font-bold' : ''}>
                                        {p.username} {p.id === hostId ? '👑' : ''}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </main>

            {/* Debug Info */}
            <div className="fixed bottom-0 right-0 bg-black text-white p-2 text-xs opacity-50 hover:opacity-100">
                <p>Status: {gameState}</p>
                <p>Me: {socket?.id || 'Connecting...'}</p>
                <p>Host: {hostId}</p>
                <p>IsHost: {isHost ? 'Yes' : 'No'}</p>
                <p>Players: {players.length}</p>
                <p>Ticket: {myTicket ? 'Yes' : 'No'}</p>
            </div>
        </div>
    );

    // --- Main Render ---
    if (!user) return null;

    return screen === 'lobby' ? renderLobby() : renderGame();
}
