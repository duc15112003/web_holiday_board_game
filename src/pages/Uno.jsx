import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { socketService } from '../services/socket';
import { useNavigate } from 'react-router-dom';

// Card styling
const CARD_COLORS = {
    light: {
        red: { bg: '#ef4444', text: 'white' },
        yellow: { bg: '#eab308', text: 'black' },
        green: { bg: '#22c55e', text: 'white' },
        blue: { bg: '#3b82f6', text: 'white' },
        wild: { bg: 'linear-gradient(135deg, #ef4444, #eab308, #22c55e, #3b82f6)', text: 'white' }
    },
    dark: {
        pink: { bg: '#ec4899', text: 'white' },
        orange: { bg: '#f97316', text: 'white' },
        purple: { bg: '#a855f7', text: 'white' },
        teal: { bg: '#14b8a6', text: 'white' },
        wild: { bg: 'linear-gradient(135deg, #ec4899, #f97316, #a855f7, #14b8a6)', text: 'white' }
    }
};

const VALUE_ICONS = {
    'skip': '⊘', 'reverse': '⇄', 'draw2': '+2', 'draw1': '+1',
    'draw5': '+5', 'skipAll': '⊘⊘', 'wild': '★', 'wild4': '+4',
    'wild2': '+2', 'wildColor': '+?', 'flip': '🔄'
};

export default function Uno() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [socket, setSocket] = useState(null);

    // States
    const [screen, setScreen] = useState('lobby');
    const [roomIdInput, setRoomIdInput] = useState('');
    const [selectedMode, setSelectedMode] = useState('classic');
    const [error, setError] = useState('');
    const [roomId, setRoomId] = useState(null);
    const [gameMode, setGameMode] = useState('classic');
    const [gameState, setGameState] = useState('waiting');
    const [players, setPlayers] = useState([]);
    const [myCards, setMyCards] = useState([]);
    const [discardPile, setDiscardPile] = useState([]);
    const [currentColor, setCurrentColor] = useState(null);
    const [currentSide, setCurrentSide] = useState('light');
    const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
    const [direction, setDirection] = useState(1);
    const [isHost, setIsHost] = useState(false);
    const [winner, setWinner] = useState(null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [pendingCardIndex, setPendingCardIndex] = useState(null);
    const [deckCount, setDeckCount] = useState(0);

    useEffect(() => {
        if (!user) { navigate('/'); return; }
        setSocket(socketService.connect());
    }, [user, navigate]);

    useEffect(() => {
        if (!socket || !roomId) return;

        const onRoomUpdate = ({ room }) => {
            setPlayers(room.players || []);
            setGameState(room.gameState || 'waiting');
            setGameMode(room.mode || 'classic');
            setCurrentColor(room.currentColor);
            setCurrentSide(room.currentSide || 'light');
            setCurrentPlayerIdx(room.currentPlayerIdx);
            setDirection(room.direction);
            setIsHost(room.host === socket.id);
            setDeckCount(room.deck?.count || 0);
            if (room.discardPile) setDiscardPile(room.discardPile);
            if (room.myCards) setMyCards(room.myCards);
            if (room.winner) setWinner(room.winner);
        };

        const onGameStarted = () => { setGameState('playing'); setWinner(null); };
        const onGameOver = ({ winner: w }) => { setGameState('ended'); setWinner(w); };
        const onFlipped = ({ side }) => setCurrentSide(side);
        const onError = ({ message }) => alert(message);
        const onUnoCaught = ({ catcher, target }) => alert(`${catcher} bắt được ${target}! +2 lá`);

        socket.on('uno_room_update', onRoomUpdate);
        socket.on('uno_game_started', onGameStarted);
        socket.on('uno_game_over', onGameOver);
        socket.on('uno_flipped', onFlipped);
        socket.on('uno_error', onError);
        socket.on('uno_caught', onUnoCaught);

        return () => {
            socket.off('uno_room_update', onRoomUpdate);
            socket.off('uno_game_started', onGameStarted);
            socket.off('uno_game_over', onGameOver);
            socket.off('uno_flipped', onFlipped);
            socket.off('uno_error', onError);
            socket.off('uno_caught', onUnoCaught);
        };
    }, [socket, roomId]);

    // Handlers
    const joinRoom = (id) => {
        if (!socket) return;
        setRoomId(id);
        socket.emit('join_room', { roomId: id, username: user.username, gameType: 'uno', mode: selectedMode });
        setScreen('game');
    };

    const getCardFace = (card) => gameMode === 'flip' && card.side ? card[card.side] : card;
    const isMyTurn = () => players.findIndex(p => p.id === socket?.id) === currentPlayerIdx;
    const getMyIdx = () => players.findIndex(p => p.id === socket?.id);

    const handlePlayCard = (idx) => {
        const face = getCardFace(myCards[idx]);
        if (face.type === 'wild') {
            setPendingCardIndex(idx);
            setShowColorPicker(true);
        } else {
            socket.emit('uno_play_card', { roomId, cardIndex: idx });
        }
    };

    const handleColorChosen = (color) => {
        setShowColorPicker(false);
        if (pendingCardIndex !== null) {
            socket.emit('uno_play_card', { roomId, cardIndex: pendingCardIndex, chosenColor: color });
            setPendingCardIndex(null);
        }
    };

    // Get player positions (relative to me)
    const getPlayerPositions = () => {
        const myIdx = getMyIdx();
        if (myIdx === -1) return { bottom: null, left: null, top: null, right: null };

        const positions = ['bottom', 'left', 'top', 'right'];
        const result = {};

        players.forEach((p, idx) => {
            const relativePos = (idx - myIdx + players.length) % players.length;
            const pos = positions[relativePos % 4];
            result[pos] = { ...p, isCurrentTurn: idx === currentPlayerIdx };
        });

        return result;
    };

    // Card Component
    const Card = ({ card, size = 'md', onClick, disabled, showBack = false }) => {
        const face = getCardFace(card);
        const colors = CARD_COLORS[gameMode === 'flip' ? currentSide : 'light'];
        const colorStyle = colors[face.color] || colors.wild;
        const value = VALUE_ICONS[face.value] || face.value;

        const sizes = {
            sm: 'w-8 h-12 text-xs',
            md: 'w-14 h-20 text-lg',
            lg: 'w-20 h-28 text-2xl'
        };

        if (showBack) {
            return (
                <div className={`${sizes[size]} rounded-lg bg-gray-800 border-2 border-gray-600 flex items-center justify-center`}>
                    <span className="text-white font-bold">UNO</span>
                </div>
            );
        }

        return (
            <button
                onClick={onClick}
                disabled={disabled}
                className={`${sizes[size]} rounded-lg shadow-lg flex items-center justify-center font-black
                    border-4 border-white/50 transition-all duration-200
                    ${!disabled ? 'hover:scale-110 hover:-translate-y-2 cursor-pointer' : 'cursor-default'}
                `}
                style={{
                    background: colorStyle.bg,
                    color: colorStyle.text
                }}
            >
                <span className="drop-shadow-md">{value}</span>
            </button>
        );
    };

    // Player Area Component
    const PlayerArea = ({ player, position }) => {
        if (!player) return null;

        const isMe = player.id === socket?.id;
        const isTurn = player.isCurrentTurn;

        const positionStyles = {
            bottom: 'bottom-0 left-1/2 -translate-x-1/2 flex-col',
            top: 'top-0 left-1/2 -translate-x-1/2 flex-col-reverse',
            left: 'left-0 top-1/2 -translate-y-1/2 flex-row',
            right: 'right-0 top-1/2 -translate-y-1/2 flex-row-reverse'
        };

        const cardContainerStyles = {
            bottom: 'flex-row',
            top: 'flex-row',
            left: 'flex-col',
            right: 'flex-col'
        };

        if (isMe) {
            // My cards at bottom
            return (
                <div className={`absolute ${positionStyles[position]} flex items-center gap-2 p-4`}>
                    <div className={`flex ${cardContainerStyles[position]} gap-1 items-center`}>
                        {myCards.map((card, idx) => (
                            <div key={idx} style={{ marginLeft: idx > 0 && position !== 'left' && position !== 'right' ? '-30px' : '0' }}>
                                <Card
                                    card={card}
                                    size="lg"
                                    onClick={() => handlePlayCard(idx)}
                                    disabled={!isMyTurn() || gameState !== 'playing'}
                                />
                            </div>
                        ))}
                    </div>
                    <div className={`flex items-center gap-2 ${isTurn ? 'animate-pulse' : ''}`}>
                        <span className={`px-3 py-1 rounded-full font-bold text-sm ${isTurn ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white'}`}>
                            {player.username} (Bạn) {isTurn ? '👈' : ''}
                        </span>
                        {myCards.length <= 2 && gameState === 'playing' && (
                            <button
                                onClick={() => socket.emit('uno_say_uno', { roomId })}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full font-bold animate-bounce"
                            >
                                UNO!
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        // Other players
        return (
            <div className={`absolute ${positionStyles[position]} flex items-center gap-2 p-4`}>
                <div className={`flex items-center gap-2 ${isTurn ? 'animate-pulse' : ''}`}>
                    <span className={`px-3 py-1 rounded-full font-bold text-sm ${isTurn ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white'}`}>
                        {player.username} {isTurn ? '👈' : ''} ({player.cardCount}🃏)
                    </span>
                    {player.cardCount === 1 && !player.saidUno && (
                        <button
                            onClick={() => socket.emit('uno_catch', { roomId, targetId: player.id })}
                            className="bg-red-500 hover:bg-red-600 text-white px-2 py-0.5 rounded text-xs animate-pulse"
                        >
                            Bắt!
                        </button>
                    )}
                </div>
                <div className={`flex ${cardContainerStyles[position]} gap-0.5`}>
                    {Array.from({ length: Math.min(player.cardCount, 7) }).map((_, i) => (
                        <div key={i} style={{
                            marginLeft: i > 0 && (position === 'top' || position === 'bottom') ? '-15px' : '0',
                            marginTop: i > 0 && (position === 'left' || position === 'right') ? '-20px' : '0'
                        }}>
                            <Card card={{}} size="sm" showBack disabled />
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Lobby Screen
    if (screen === 'lobby') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-600 via-yellow-500 to-blue-600 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                    <div className="text-center mb-8">
                        <div className="text-6xl mb-4">🃏</div>
                        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 bg-clip-text text-transparent">UNO</h1>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Chế độ:</label>
                        <div className="flex gap-2">
                            {['classic', 'flip'].map(mode => (
                                <button key={mode} onClick={() => setSelectedMode(mode)}
                                    className={`flex-1 py-3 rounded-lg font-bold transition-all ${selectedMode === mode ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                                        }`}>
                                    {mode === 'classic' ? '🎴 Classic' : '🔄 Flip'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <div className="bg-red-100 text-red-600 p-3 rounded-lg mb-4">{error}</div>}

                    <button onClick={() => joinRoom(`uno-${Date.now().toString(36)}`)}
                        className="w-full bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 text-white font-bold py-4 rounded-xl mb-4 hover:scale-105 transition-transform">
                        🏠 Tạo Phòng
                    </button>

                    <div className="flex gap-2">
                        <input type="text" value={roomIdInput} onChange={e => setRoomIdInput(e.target.value)}
                            placeholder="Mã phòng..." className="flex-1 px-4 py-3 border-2 rounded-xl" />
                        <button onClick={() => roomIdInput && joinRoom(roomIdInput)}
                            className="px-6 py-3 bg-blue-500 text-white font-bold rounded-xl">Vào</button>
                    </div>

                    <button onClick={() => navigate('/hub')} className="mt-6 text-gray-500 w-full">← Quay lại</button>
                </div>
            </div>
        );
    }

    // Game Screen
    const positions = getPlayerPositions();
    const topCard = discardPile[discardPile.length - 1];

    return (
        <div className={`h-screen ${currentSide === 'dark' ? 'bg-gray-900' : 'bg-green-800'} relative overflow-hidden transition-colors duration-500`}>

            {/* Header */}
            <div className="absolute top-2 left-2 z-20 flex gap-2">
                <button onClick={() => { setScreen('lobby'); setRoomId(null); }}
                    className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg text-sm">
                    ← Rời phòng
                </button>
                <span className="bg-white/20 text-white px-3 py-1 rounded-lg text-sm font-mono">{roomId}</span>
            </div>

            <div className="absolute top-2 right-2 z-20 flex gap-2 items-center">
                <span className="text-white text-2xl">{direction === 1 ? '↻' : '↺'}</span>
                {gameMode === 'flip' && (
                    <span className="bg-white/20 text-white px-2 py-1 rounded text-sm">
                        {currentSide === 'dark' ? '🌙 Dark' : '☀️ Light'}
                    </span>
                )}
            </div>

            {/* Center Play Area */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-8">
                {/* Deck */}
                <button onClick={() => socket.emit('uno_draw_card', { roomId })}
                    disabled={!isMyTurn() || gameState !== 'playing'}
                    className={`w-20 h-28 rounded-xl bg-gray-800 border-4 border-gray-600 flex flex-col items-center justify-center text-white
                        ${isMyTurn() && gameState === 'playing' ? 'hover:scale-105 cursor-pointer ring-2 ring-yellow-400' : 'opacity-60'}`}>
                    <span className="text-2xl">🂠</span>
                    <span className="text-xs">{deckCount}</span>
                </button>

                {/* Discard Pile */}
                <div className="relative">
                    {topCard && <Card card={topCard} size="lg" disabled />}
                    {currentColor && (
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white"
                            style={{ background: CARD_COLORS[gameMode === 'flip' ? currentSide : 'light'][currentColor]?.bg }}>
                            {currentColor}
                        </div>
                    )}
                </div>
            </div>

            {/* Players at 4 corners */}
            <PlayerArea player={positions.bottom} position="bottom" />
            <PlayerArea player={positions.left} position="left" />
            <PlayerArea player={positions.top} position="top" />
            <PlayerArea player={positions.right} position="right" />

            {/* Waiting / Winner Overlay */}
            {gameState === 'waiting' && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-10 text-center shadow-2xl max-w-sm w-full mx-4 border-4 border-yellow-400">
                        <div className="text-5xl mb-4">🚪</div>
                        <h2 className="text-3xl font-black mb-2 text-gray-800">Phòng Chờ</h2>
                        <div className="bg-gray-100 rounded-xl p-4 mb-6">
                            <p className="text-xs text-gray-500 uppercase font-bold mb-1">Mã phòng</p>
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-2xl font-mono font-bold text-blue-600">{roomId}</span>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(roomId);
                                        alert('Đã sao chép mã phòng!');
                                    }}
                                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                    title="Copy mã phòng"
                                >
                                    📋
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-2 mb-8 text-gray-600">
                            <div className="flex -space-x-2">
                                {players.map((p, i) => (
                                    <div key={i} className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white text-xs font-bold">
                                        {p.username[0].toUpperCase()}
                                    </div>
                                ))}
                            </div>
                            <span className="font-bold">{players.length} người đã sẵn sàng</span>
                        </div>

                        {isHost ? (
                            <button
                                onClick={() => socket.emit('uno_start', { roomId, mode: gameMode })}
                                disabled={players.length < 2}
                                className={`w-full font-black py-4 rounded-2xl text-xl shadow-lg transition-all transform hover:scale-105 active:scale-95
                                    ${players.length >= 2
                                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                            >
                                {players.length >= 2 ? 'BẮT ĐẦU CHƠI! 🚀' : 'Cần 2+ người chơi'}
                            </button>
                        ) : (
                            <div className="animate-pulse text-blue-500 font-bold">
                                Đang chờ chủ phòng bắt đầu...
                            </div>
                        )}
                    </div>
                </div>
            )}

            {gameState === 'ended' && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-30">
                    <div className="bg-white rounded-2xl p-8 text-center">
                        <div className="text-6xl mb-4">🏆</div>
                        <h2 className="text-3xl font-bold mb-2">{winner} Thắng!</h2>
                        {isHost && (
                            <button onClick={() => socket.emit('uno_reset', { roomId })}
                                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-xl">
                                Chơi lại
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Color Picker */}
            {showColorPicker && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-center mb-4">Chọn màu</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {(gameMode === 'flip' && currentSide === 'dark'
                                ? ['pink', 'orange', 'purple', 'teal']
                                : ['red', 'yellow', 'green', 'blue']
                            ).map(color => (
                                <button key={color} onClick={() => handleColorChosen(color)}
                                    className="w-16 h-16 rounded-xl hover:scale-110 transition-transform"
                                    style={{ background: CARD_COLORS[gameMode === 'flip' ? currentSide : 'light'][color].bg }} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
