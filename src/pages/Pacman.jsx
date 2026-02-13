import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const CELL_SIZE = 20;
const ROWS = 20;
const COLS = 19;

// 0: Empty, 1: Wall, 2: Dot, 3: Power Pellet
const INITIAL_MAP = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1],
    [1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 2, 1],
    [1, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 1],
    [1, 1, 1, 1, 2, 1, 1, 1, 0, 1, 0, 1, 1, 1, 2, 1, 1, 1, 1],
    [0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0],
    [1, 1, 1, 1, 2, 1, 0, 1, 1, 0, 1, 1, 0, 1, 2, 1, 1, 1, 1],
    [0, 2, 2, 2, 2, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 2, 2, 2, 0],
    [1, 1, 1, 1, 2, 1, 0, 1, 1, 1, 1, 1, 0, 1, 2, 1, 1, 1, 1],
    [0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0],
    [1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1],
    [1, 2, 2, 1, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 1, 2, 2, 1],
    [1, 1, 2, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 2, 1, 1],
    [1, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const DIRECTIONS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
};

export default function Pacman() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const canvasRef = useRef(null);
    const requestRef = useRef(null);

    useEffect(() => {
        if (!user) {
            navigate('/');
        }
    }, [user, navigate]);

    // Game State
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(parseInt(localStorage.getItem('pacman_highscore')) || 0);
    const [gameOver, setGameOver] = useState(false);
    const [win, setWin] = useState(false);
    const [gameRunning, setGameRunning] = useState(false);

    useEffect(() => {
        if (score > highScore) {
            setHighScore(score);
            localStorage.setItem('pacman_highscore', score);
        }
    }, [score, highScore]);

    // Entities
    const [pacman, setPacman] = useState({ x: 9, y: 16, dir: DIRECTIONS.RIGHT, nextDir: DIRECTIONS.RIGHT });
    const [ghosts, setGhosts] = useState([
        { x: 9, y: 8, color: 'red', dir: DIRECTIONS.UP },
        { x: 10, y: 8, color: 'pink', dir: DIRECTIONS.UP }
    ]);
    const [map, setMap] = useState(JSON.parse(JSON.stringify(INITIAL_MAP))); // Deep copy

    // Controls
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!gameRunning) return;
            switch (e.key) {
                case 'ArrowUp': setPacman(p => ({ ...p, nextDir: DIRECTIONS.UP })); break;
                case 'ArrowDown': setPacman(p => ({ ...p, nextDir: DIRECTIONS.DOWN })); break;
                case 'ArrowLeft': setPacman(p => ({ ...p, nextDir: DIRECTIONS.LEFT })); break;
                case 'ArrowRight': setPacman(p => ({ ...p, nextDir: DIRECTIONS.RIGHT })); break;
                default: break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameRunning]);

    // Game Loop
    useEffect(() => {
        if (!gameRunning) return;

        const updateGame = () => {
            if (gameOver || win) return;

            setPacman(currentPacman => {
                let newX = currentPacman.x;
                let newY = currentPacman.y;
                let newDir = currentPacman.dir;

                // Try next direction
                let nextX = currentPacman.x + currentPacman.nextDir.x;
                let nextY = currentPacman.y + currentPacman.nextDir.y;

                // Check map bounds
                if (nextX < 0) nextX = COLS - 1;
                if (nextX >= COLS) nextX = 0;

                if (map[nextY] && map[nextY][nextX] !== 1) {
                    newDir = currentPacman.nextDir;
                    newX = nextX;
                    newY = nextY;
                } else {
                    // Continue current direction
                    nextX = currentPacman.x + currentPacman.dir.x;
                    nextY = currentPacman.y + currentPacman.dir.y;

                    // Check map bounds
                    if (nextX < 0) nextX = COLS - 1;
                    if (nextX >= COLS) nextX = 0;

                    if (map[nextY] && map[nextY][nextX] !== 1) {
                        newX = nextX;
                        newY = nextY;
                    }
                }

                return { ...currentPacman, x: newX, y: newY, dir: newDir };
            });

            // Move Ghosts (Simple Random)
            setGhosts(currentGhosts => currentGhosts.map(ghost => {
                // 50% chance to change direction or keep going
                let moveDir = ghost.dir;
                if (Math.random() < 0.1 || isWall(ghost.x + moveDir.x, ghost.y + moveDir.y)) {
                    const possibleDirs = Object.values(DIRECTIONS).filter(d => !isWall(ghost.x + d.x, ghost.y + d.y));
                    if (possibleDirs.length > 0) {
                        moveDir = possibleDirs[Math.floor(Math.random() * possibleDirs.length)];
                    }
                }

                let newX = ghost.x + moveDir.x;
                let newY = ghost.y + moveDir.y;

                // Keep within bounds (basic wrap for ghosts too if needed, but usually they stay in walls)
                if (newX < 0) newX = COLS - 1;
                if (newX >= COLS) newX = 0;

                return { ...ghost, x: newX, y: newY, dir: moveDir };
            }));

        };

        const gameInterval = setInterval(updateGame, 200); // 5 FPS for retro feel
        return () => clearInterval(gameInterval);
    }, [gameRunning, gameOver, win, map]); // Added map to dependency might need careful check

    // Check Collisions & Eating
    useEffect(() => {
        if (!gameRunning) return;

        // Eat Dot
        if (map[pacman.y][pacman.x] === 2) {
            const newMap = [...map];
            newMap[pacman.y][pacman.x] = 0;
            setMap(newMap);
            setScore(s => s + 10);

            // Check Win
            if (!newMap.some(row => row.includes(2))) {
                setWin(true);
                setGameRunning(false);
            }
        }

        // Ghost Collision
        if (ghosts.some(g => Math.floor(g.x) === pacman.x && Math.floor(g.y) === pacman.y)) {
            setGameOver(true);
            setGameRunning(false);
        }

    }, [pacman, ghosts, gameRunning, map]);

    const isWall = (x, y) => {
        // Handle wrapping
        if (x < 0) x = COLS - 1;
        if (x >= COLS) x = 0;
        if (y < 0 || y >= ROWS) return true;
        return map[y][x] === 1;
    }


    // Rendering
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Map
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                if (map[y][x] === 1) {
                    ctx.fillStyle = '#1919A6'; // Wall Blue
                    ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                    // Inner black square for outline effect
                    ctx.fillStyle = '#000';
                    ctx.fillRect(x * CELL_SIZE + 4, y * CELL_SIZE + 4, CELL_SIZE - 8, CELL_SIZE - 8);
                    ctx.fillStyle = '#1919A6'; // Inner Blue
                    ctx.fillRect(x * CELL_SIZE + 6, y * CELL_SIZE + 6, CELL_SIZE - 12, CELL_SIZE - 12);
                } else if (map[y][x] === 2) {
                    ctx.fillStyle = '#FFB8ae'; // Dot
                    ctx.beginPath();
                    ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // Draw Pacman
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        const centerX = pacman.x * CELL_SIZE + CELL_SIZE / 2;
        const centerY = pacman.y * CELL_SIZE + CELL_SIZE / 2;
        // Simple mouth animation could be added here
        ctx.arc(centerX, centerY, CELL_SIZE / 2 - 2, 0.2 * Math.PI, 1.8 * Math.PI);
        ctx.lineTo(centerX, centerY);
        ctx.fill();

        // Draw Ghosts
        ghosts.forEach(g => {
            ctx.fillStyle = g.color;
            ctx.beginPath();
            ctx.arc(g.x * CELL_SIZE + CELL_SIZE / 2, g.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
            ctx.fill();
        });

    }, [pacman, ghosts, map]);


    const startGame = () => {
        setMap(JSON.parse(JSON.stringify(INITIAL_MAP)));
        setPacman({ x: 9, y: 16, dir: DIRECTIONS.RIGHT, nextDir: DIRECTIONS.RIGHT });
        setGhosts([
            { x: 9, y: 8, color: 'red', dir: DIRECTIONS.UP },
            { x: 10, y: 8, color: 'pink', dir: DIRECTIONS.UP }
        ]);
        setScore(0);
        setGameOver(false);
        setWin(false);
        setGameRunning(true);
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center font-sans">
            {/* Navbar */}
            <div className="w-full bg-gray-800 text-white p-4 shadow-lg flex justify-between items-center fixed top-0 z-20">
                <div className="font-bold text-xl flex items-center gap-2">
                    <span className="text-2xl">🕹️</span> Pacman
                </div>
                <div className="flex items-center gap-4 text-sm font-medium">
                    <button onClick={() => navigate('/hub')} className="hover:text-yellow-400 transition-colors">
                        Về Menu
                    </button>
                    <div className="bg-white/20 px-3 py-1 rounded-full">
                        💰 {user?.balance ? user.balance.toLocaleString() : 0} VND
                    </div>
                </div>
            </div>

            <div className="mt-20 flex flex-col items-center">
                <div className="flex gap-8 mb-4">
                    <div className="text-white text-2xl font-bold font-mono">
                        SCORE: {score}
                    </div>
                    <div className="text-yellow-400 text-2xl font-bold font-mono">
                        HIGH: {highScore}
                    </div>
                </div>

                <div className="relative border-4 border-blue-900 rounded-lg shadow-2xl bg-black">
                    <canvas
                        ref={canvasRef}
                        width={COLS * CELL_SIZE}
                        height={ROWS * CELL_SIZE}
                        className="block"
                    />

                    {/* Overlays */}
                    {(!gameRunning && !gameOver && !win) && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                            <button
                                onClick={startGame}
                                className="px-8 py-3 bg-yellow-400 text-black font-bold rounded-full hover:bg-yellow-300 transition-transform hover:scale-105"
                            >
                                START GAME
                            </button>
                        </div>
                    )}

                    {gameOver && (
                        <div className="absolute inset-0 bg-red-900/80 flex flex-col items-center justify-center text-white">
                            <h2 className="text-4xl font-bold mb-4">GAME OVER</h2>
                            <p className="mb-6 text-xl">Score: {score}</p>
                            <button
                                onClick={startGame}
                                className="px-6 py-2 bg-white text-red-900 font-bold rounded-full hover:bg-gray-200"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {win && (
                        <div className="absolute inset-0 bg-green-900/80 flex flex-col items-center justify-center text-white">
                            <h2 className="text-4xl font-bold mb-4">YOU WIN!</h2>
                            <p className="mb-6 text-xl">Score: {score}</p>
                            <button
                                onClick={startGame}
                                className="px-6 py-2 bg-white text-green-900 font-bold rounded-full hover:bg-gray-200"
                            >
                                Play Again
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-6 text-gray-400 text-sm">
                    Use Arrow Keys to Move
                </div>
            </div>
        </div>
    );
}
