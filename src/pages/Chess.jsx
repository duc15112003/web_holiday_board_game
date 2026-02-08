import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { chessApi } from '../mock-api/chess-server';
import { socketService } from '../services/socket';
import { Chess } from 'chess.js';

const PIECES = {
    'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚',
    'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔'
};

export default function ChessGame() {
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const [players, setPlayers] = useState({ w: null, b: null });

    // Game Mode State: 'menu', 'local', 'online'
    const [mode, setMode] = useState('menu');
    const [roomId, setRoomId] = useState('');
    const [playerColor, setPlayerColor] = useState('w'); // 'w', 'b', or 's' (spectator)
    const [statusMsg, setStatusMsg] = useState('');
    // New state to handle join requests safely after connection
    const [joinRequest, setJoinRequest] = useState(null); // { roomId: string }
    const [gameOverStatus, setGameOverStatus] = useState(null); // { result: 'win'|'lose'|'draw', reason: string }

    const [game, setGame] = useState(null);
    const [selectedSquare, setSelectedSquare] = useState(null);
    const [possibleMoves, setPossibleMoves] = useState([]);

    // Local chess instance for move validation
    const [localChess, setLocalChess] = useState(new Chess());

    // Refs for socket listeners to access latest state without re-binding
    const playerColorRef = useRef(playerColor);

    // Promotion State
    const [promotionMove, setPromotionMove] = useState(null); // { from, to }

    useEffect(() => {
        playerColorRef.current = playerColor;
    }, [playerColor]);

    // Helper to check game over from board state (Absolute Winner)
    const checkGameOver = (chessInstance) => {
        if (chessInstance.isCheckmate()) {
            // If it's White's turn and they are in checkmate, Black wins.
            const turn = chessInstance.turn();
            const winner = turn === 'w' ? 'b' : 'w';
            setGameOverStatus({ winner: winner, reason: 'Checkmate' });
        } else if (chessInstance.isDraw()) {
            setGameOverStatus({ winner: 'draw', reason: 'Stalemate/Repetition' });
        }
    };

    // Socket.io Connection & Listeners
    useEffect(() => {
        if (mode === 'online') {
            console.log("Connecting to socket...");
            const socket = socketService.connect();

            // Listeners
            socket.on('room_joined', (data) => {
                console.log('Joined room event received:', data);
                setPlayerColor(data.color);
                playerColorRef.current = data.color; // Update ref immediately for safety
                setPlayers(data.players || { w: null, b: null });
                setStatusMsg(`Room ${data.roomId}`);

                // Sync game state
                const newChess = new Chess(data.fen);
                setLocalChess(newChess);
                checkGameOver(newChess);

                setGame({
                    fen: data.fen,
                    turn: data.turn,
                    isGameOver: newChess.isGameOver(),
                    isCheck: newChess.isCheck(),
                    isCheckmate: newChess.isCheckmate(),
                    isDraw: newChess.isDraw()
                });
            });

            socket.on('game_state_update', (data) => {
                console.log('Opponent moved:', data);
                const newChess = new Chess(data.fen);
                setLocalChess(newChess);

                const isOver = newChess.isGameOver();
                setGame({
                    fen: data.fen,
                    turn: data.turn,
                    isGameOver: isOver,
                    isCheck: newChess.isCheck(),
                    isCheckmate: newChess.isCheckmate(),
                    isDraw: newChess.isDraw()
                });

                if (isOver) {
                    checkGameOver(newChess);
                }
            });

            socket.on('player_update', (data) => {
                setPlayers(data.players || { w: null, b: null });
            });

            socket.on('game_reset', (data) => {
                const newChess = new Chess(data.fen);
                setLocalChess(newChess);
                setGame({
                    fen: data.fen,
                    turn: data.turn,
                    isGameOver: false,
                    isCheck: false,
                    isCheckmate: false,
                    isDraw: false
                });
                setGameOverStatus(null);
                alert("Game Started!");
            });

            socket.on('rematch_requested', () => {
                const accept = window.confirm("Opponent wants a Rematch. Accept?");
                socket.emit('respond_rematch', { roomId, accepted: accept });
            });

            socket.on('rematch_rejected', () => {
                alert("Opponent declined rematch.");
            });

            socket.on('draw_offered', () => {
                const accept = window.confirm("Opponent offers a DRAW. Accept?");
                socket.emit('respond_draw', { roomId, accepted: accept });
            });

            socket.on('draw_rejected', () => {
                alert("Opponent declined draw.");
            });

            socket.on('game_over', (data) => {
                console.log("Game Over Event:", data);
                // Handle server-declared game overs
                if (data.reason === 'draw_agreed') {
                    setGameOverStatus({ winner: 'draw', reason: 'Agreement' });
                } else if (data.reason === 'opponent_resigned') {
                    // If opponent resigned, I win.
                    const myCol = playerColorRef.current;
                    setGameOverStatus({ winner: myCol, reason: 'Opponent Resigned' });
                } else if (data.reason === 'resignation') {
                    // If I resigned, Opponent (other color) wins.
                    const myCol = playerColorRef.current;
                    const winCol = myCol === 'w' ? 'b' : 'w';
                    setGameOverStatus({ winner: winCol, reason: 'You Resigned' });
                }
            });

            return () => {
                console.log("Disconnecting socket...");
                socketService.disconnect();
            };
        } else {
            // Local Mode Initial Load
            if (mode === 'local') {
                loadLocalGame();
            }
        }
    }, [mode]);

    // Handle Join Request
    useEffect(() => {
        if (mode === 'online' && joinRequest && !loading) {
            const socket = socketService.connect(); // Get instance

            const performJoin = () => {
                console.log("Emitting join_room for", joinRequest.roomId);
                socket.emit('join_room', {
                    roomId: joinRequest.roomId,
                    username: user?.username || 'Guest_' + Math.floor(Math.random() * 1000)
                });
                setJoinRequest(null);
            };

            if (socket.connected) {
                performJoin();
            } else {
                socket.once('connect', performJoin);
            }

            // Cleanup listener if component unmounts or request changes before connect
            return () => {
                socket.off('connect', performJoin);
            };
        }
    }, [joinRequest, mode, user, loading]);

    const loadLocalGame = () => {
        const state = chessApi.getGame();
        setGame(state);
        setLocalChess(new Chess(state.fen));
    };

    const handleJoinRoom = (idToJoin) => {
        const targetId = idToJoin || roomId;
        if (!targetId.trim()) return alert("Enter a Room ID");

        // Trigger mode change and set request
        setRoomId(targetId);
        setMode('online');
        setJoinRequest({ roomId: targetId });
    };

    const handleSquareClick = (square) => {
        if (!game || game.isGameOver) return;

        // Restriction for Online Mode: Can only move own pieces
        if (mode === 'online' && game.turn !== playerColor) return; // Not your turn logic
        // But also check if playerColor matches turn? 
        // Logic: if I am White, I can only select/move when it is White's turn. 
        // With 'game.turn !== playerColor' check above, we cover "Not your turn".
        // But we also need "Don't touch Opponent pieces".

        // ... handled below in selection logic ...

        // If selecting a piece to move
        if (!selectedSquare) {
            const piece = localChess.get(square);
            if (piece) {
                // Online Check: Can only select own color
                if (mode === 'online') {
                    if (piece.color !== playerColor) return; // Can't select opponent
                    if (game.turn !== playerColor) return; // Can't select if not my turn
                } else {
                    // Local mode: Can select active turn color
                    if (piece.color !== game.turn) return;
                }

                setSelectedSquare(square);
                // Get valid moves for this square
                const moves = localChess.moves({ square, verbose: true });
                setPossibleMoves(moves.map(m => m.to));
            }
        } else {
            // If clicking same square, deselect
            if (square === selectedSquare) {
                setSelectedSquare(null);
                setPossibleMoves([]);
                return;
            }

            // Attempt move
            if (possibleMoves.includes(square)) {

                // Check for Promotion FIRST
                const piece = localChess.get(selectedSquare);
                const isPromotion =
                    piece.type === 'p' &&
                    ((piece.color === 'w' && square[1] === '8') || (piece.color === 'b' && square[1] === '1'));

                if (isPromotion) {
                    setPromotionMove({ from: selectedSquare, to: square });
                    return; // Stop here, wait for user to select piece
                }

                executeMove(selectedSquare, square, 'q'); // Default to Queen if not promotion (or fail safe)
            } else {
                // Calculate if we should switch selection
                const piece = localChess.get(square);
                // Allow switch if it's our piece
                let isMyPiece = false;
                if (mode === 'online') isMyPiece = (piece && piece.color === playerColor);
                else isMyPiece = (piece && piece.color === game.turn);

                if (isMyPiece) {
                    setSelectedSquare(square);
                    const moves = localChess.moves({ square, verbose: true });
                    setPossibleMoves(moves.map(m => m.to));
                } else {
                    setSelectedSquare(null);
                    setPossibleMoves([]);
                }
            }
        }
    };

    const executeMove = (from, to, promotionPiece = 'q') => {
        let success = false;
        let newFen, newTurn;

        // 1. Move on Local Logic first to validate
        try {
            const moveResult = localChess.move({ from, to, promotion: promotionPiece });
            if (moveResult) {
                success = true;
                newFen = localChess.fen();
                newTurn = localChess.turn();
            }
        } catch (e) { console.log(e); }

        if (success) {
            const newState = {
                fen: newFen,
                turn: newTurn,
                isGameOver: localChess.isGameOver(),
                isCheck: localChess.isCheck(),
                isCheckmate: localChess.isCheckmate(),
                isDraw: localChess.isDraw()
            };
            setGame(newState);
            setSelectedSquare(null);
            setPossibleMoves([]);
            setPromotionMove(null); // Clear promotion state

            if (localChess.isGameOver()) {
                checkGameOver(localChess);
            }

            if (mode === 'local') {
                // Persist to Mock API
                chessApi.move('local-match', from, to);
            } else if (mode === 'online') {
                // Send to Socket
                socketService.emit('make_move', {
                    roomId,
                    move: { from, to, promotion: promotionPiece },
                    fen: newFen,
                    turn: newTurn
                });
            }
        }
    };

    const handlePromotionSelect = (pieceType) => {
        if (promotionMove) {
            executeMove(promotionMove.from, promotionMove.to, pieceType);
        }
    };

    const resetGame = () => {
        if (mode === 'online') return; // Reset not implemented for online yet
        const state = chessApi.reset();
        setGame(state);
        setLocalChess(new Chess(state.fen));
        setSelectedSquare(null);
        setPossibleMoves([]);
    };

    const handleResign = () => {
        if (window.confirm("Are you sure you want to RESIGN? (You will lose)")) {
            socketService.emit('resign', { roomId });
        }
    };

    const handleDraw = () => {
        if (window.confirm("Offer a DRAW to your opponent?")) {
            socketService.emit('offer_draw', { roomId });
        }
    };

    const handleReset = () => {
        if (window.confirm("Request a NEW GAME? (Opponent must agree)")) {
            socketService.emit('request_rematch', { roomId });
        }
    };

    const getBoardArray = () => {
        const board = [];
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
        // If playing Black online, maybe flip board? (TODO)

        for (let r of ranks) {
            const row = [];
            for (let f of files) {
                const square = `${f}${r}`;
                const piece = localChess.get(square);
                row.push({ square, piece });
            }
            board.push(row);
        }
        return board;
    };

    // --- MENU UI ---
    if (mode === 'menu') {
        return (
            <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center font-sans text-white p-4">
                <h1 className="text-4xl font-bold mb-8 text-yellow-400">♟️ Cờ Vua Online</h1>
                <div className="flex flex-col gap-4 w-full max-w-sm">
                    <button onClick={() => setMode('local')} className="bg-blue-600 p-4 rounded-xl font-bold hover:bg-blue-700 shadow-lg transform transition hover:scale-105">
                        🤝 Chơi 2 Người (Local)
                    </button>

                    <div className="bg-gray-700 p-6 rounded-xl text-center shadow-xl border border-gray-600">
                        <h3 className="font-bold mb-4 text-xl">🌍 Chơi Online</h3>

                        {/* Create Room */}
                        <button
                            onClick={() => {
                                const newId = Math.random().toString(36).substring(2, 6).toUpperCase();
                                setRoomId(newId);
                                setMode('online');
                                handleJoinRoom(newId);
                            }}
                            className="w-full bg-purple-600 p-3 rounded-lg font-bold hover:bg-purple-700 mb-6 flex items-center justify-center gap-2 shadow-md transform transition hover:scale-105"
                        >
                            <span>⚡</span> Tạo Phòng Mới
                        </button>

                        <div className="relative flex py-2 items-center mb-4">
                            <div className="flex-grow border-t border-gray-500"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">Hoặc vào phòng</span>
                            <div className="flex-grow border-t border-gray-500"></div>
                        </div>

                        <div className="flex gap-2">
                            <input
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                                placeholder="ID PHÒNG"
                                className="w-full p-2 text-black rounded font-mono text-center font-bold uppercase tracking-widest"
                            />
                            <button
                                onClick={() => { if (roomId) { setMode('online'); handleJoinRoom(roomId); } }}
                                className="bg-green-600 px-4 rounded font-bold hover:bg-green-700 shadow-md"
                            >
                                GO
                            </button>
                        </div>
                    </div>
                    <button onClick={() => navigate('/hub')} className="text-gray-400 mt-4 underline hover:text-white">Quay lại Hub</button>
                </div>
            </div>
        );
    }

    if (!game) return <div className="min-h-screen bg-gray-800 text-white flex items-center justify-center">Loading...</div>;

    const boardGrid = getBoardArray();

    return (
        <div className="min-h-screen bg-gray-800 flex flex-col items-center py-6 font-sans text-white transition-opacity duration-500">
            <div className="flex justify-between items-center w-full max-w-2xl px-4 mb-6">
                <button
                    onClick={() => setMode('menu')}
                    className="text-gray-400 hover:text-white font-bold flex items-center gap-2"
                >
                    ⬅ Menu
                </button>
                <h1 className="text-2xl font-bold text-gray-200">
                    {mode === 'online' ? `Online: Room ${roomId}` : 'Local Match'}
                </h1>
                <div className="text-xs text-gray-400">{statusMsg}</div>
            </div>

            {/* Status & Tags */}
            <div className="bg-gray-700 px-8 py-3 rounded-full shadow-lg mb-6 flex items-center gap-6 border border-gray-600">
                <div className={`flex items-center gap-2 ${game.turn === 'w' ? 'font-bold text-white' : 'text-gray-500'}`}>
                    <span className="text-2xl">♔</span> {players.w?.username || (mode === 'online' && playerColor === 'w' ? user?.username : 'Waiting...')}
                    {mode === 'online' && playerColor === 'w' && <span className="text-xs bg-blue-600 px-2 py-0.5 rounded text-white font-bold shadow">YOU</span>}
                    {gameOverStatus && (
                        (gameOverStatus.winner === 'w')
                            ? <span className="text-xs bg-green-500 text-white px-2 py-1 rounded font-bold animate-pulse">WINNER 🏆</span>
                            : (gameOverStatus.winner === 'b')
                                ? <span className="text-xs bg-red-500 text-white px-2 py-1 rounded font-bold">LOSER ❌</span>
                                : null
                    )}
                </div>
                <div className="text-gray-500">|</div>
                <div className={`flex items-center gap-2 ${game.turn === 'b' ? 'font-bold text-white' : 'text-gray-500'}`}>
                    <span className="text-2xl">♚</span> {players.b?.username || (mode === 'online' && playerColor === 'b' ? user?.username : 'Waiting...')}
                    {mode === 'online' && playerColor === 'b' && <span className="text-xs bg-blue-600 px-2 py-0.5 rounded text-white font-bold shadow">YOU</span>}
                    {gameOverStatus && (
                        (gameOverStatus.winner === 'b')
                            ? <span className="text-xs bg-green-500 text-white px-2 py-1 rounded font-bold animate-pulse">WINNER 🏆</span>
                            : (gameOverStatus.winner === 'w')
                                ? <span className="text-xs bg-red-500 text-white px-2 py-1 rounded font-bold">LOSER ❌</span>
                                : null
                    )}
                </div>
            </div>

            {/* Check/Mate Status - Only show if game NOT over or just check */}
            {(!gameOverStatus && game.isCheck) && (
                <div className="mb-4 text-red-400 font-bold text-xl animate-pulse">CHECK!</div>
            )}

            {/* Promotion Modal */}
            {promotionMove && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
                    <div className="bg-gray-800 p-6 rounded-2xl shadow-2xl border border-yellow-500 animate-bounce-in">
                        <h3 className="text-2xl font-bold text-white mb-6 text-center">Choose Promotion</h3>
                        <div className="flex gap-4">
                            {['q', 'r', 'b', 'n'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => handlePromotionSelect(p)}
                                    className="w-16 h-16 bg-gray-700 hover:bg-yellow-600 rounded-lg text-4xl flex items-center justify-center transition-all transform hover:scale-110 shadow-lg border border-gray-600"
                                >
                                    {PIECES[game.turn === 'w' ? p.toUpperCase() : p]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Game Over Modal */}
            {gameOverStatus && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
                    <div className="bg-gray-800 p-8 rounded-2xl border-2 border-yellow-400 shadow-2xl text-center transform scale-110">
                        <h2 className={`text-5xl font-black mb-2 ${gameOverStatus.winner === 'draw' ? 'text-gray-300' :
                            (mode === 'online' && gameOverStatus.winner !== playerColor) ? 'text-red-500' : 'text-yellow-400'
                            }`}>
                            {gameOverStatus.winner === 'draw' && "DRAW"}
                            {(mode === 'local') && (gameOverStatus.winner === 'w' ? "WHITE WINS!" : "BLACK WINS!")}
                            {(mode === 'online') && (
                                gameOverStatus.winner === playerColor ? "VICTORY!" :
                                    (gameOverStatus.winner === 'w' ? `${players.w?.username} WINS!` : `${players.b?.username} WINS!`)
                            )}
                        </h2>
                        <p className="text-xl text-gray-300 mb-8 font-mono">{gameOverStatus.reason}</p>

                        <div className="flex gap-4 justify-center">
                            {mode === 'online' ? (
                                <button
                                    onClick={handleReset}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg hover:shadow-blue-500/50 transition-all active:scale-95"
                                >
                                    🔄 New Game
                                </button>
                            ) : (
                                <button
                                    onClick={resetGame}
                                    className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2 rounded-lg font-bold"
                                >
                                    New Game
                                </button>
                            )}
                            <button
                                onClick={() => setMode('menu')}
                                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-bold text-lg shadow-lg transition-all"
                            >
                                🚪 Exit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Board */}
            <div className={`bg-gray-900 p-2 rounded-lg shadow-2xl border border-gray-700 select-none ${gameOverStatus ? 'opacity-50 blur-sm pointer-events-none' : ''}`}>
                <div className="grid grid-cols-8 border-4 border-gray-600">
                    {boardGrid.map((row, rowIndex) => (
                        row.map((cell, colIndex) => {
                            const isBlackSquare = (rowIndex + colIndex) % 2 === 1;
                            const isSelected = cell.square === selectedSquare;
                            const isPossibleMove = possibleMoves.includes(cell.square);
                            const pieceChar = cell.piece ? (cell.piece.color === 'w' ? cell.piece.type.toUpperCase() : cell.piece.type) : null;
                            const displayPiece = pieceChar ? PIECES[pieceChar] : '';

                            // Highlight Logic
                            let bgClass = isBlackSquare ? 'bg-green-700' : 'bg-green-100';
                            if (game.latestMove && (game.latestMove.from === cell.square || game.latestMove.to === cell.square)) {
                                bgClass = isBlackSquare ? 'bg-yellow-600' : 'bg-yellow-200';
                            }
                            // King in check red highlight could go here

                            return (
                                <div
                                    key={cell.square}
                                    onClick={() => handleSquareClick(cell.square)}
                                    className={`
                                        w-10 h-10 sm:w-16 sm:h-16 flex items-center justify-center text-3xl sm:text-5xl cursor-pointer relative
                                        ${bgClass}
                                        ${isSelected ? 'ring-4 ring-yellow-400 z-10' : ''}
                                        hover:opacity-90 transition-opacity
                                    `}
                                >
                                    <span
                                        className={`
                                            drop-shadow-md
                                            ${cell.piece?.color === 'w' ? 'text-white stroke-black' : 'text-black'}
                                        `}
                                        style={{
                                            textShadow: cell.piece?.color === 'w' ? '0 0 2px black' : 'none'
                                        }}
                                    >
                                        {displayPiece}
                                    </span>

                                    {/* Move Indicator */}
                                    {isPossibleMove && (
                                        <div className={`
                                            absolute w-4 h-4 rounded-full 
                                            ${cell.piece ? 'border-4 border-gray-300' : 'bg-gray-500 opacity-50'}
                                        `}></div>
                                    )}
                                </div>
                            );
                        })
                    ))}
                </div>
            </div>

            {/* Controls (Lower) - Hide if Game Over component is covering */}
            {!gameOverStatus && (
                <div className="mt-8 flex gap-4">
                    {mode === 'local' ? (
                        <button
                            onClick={resetGame}
                            className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2 rounded-lg font-bold transition-colors"
                        >
                            New Game
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleReset}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold transition-colors"
                            >
                                🔄 New Game
                            </button>
                            <button
                                onClick={handleDraw}
                                className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg font-bold transition-colors"
                            >
                                🤝 Offer Draw
                            </button>
                            <button
                                onClick={handleResign}
                                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold transition-colors"
                            >
                                🏳️ Resign
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
