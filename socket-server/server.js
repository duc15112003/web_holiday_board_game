require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./db');
const spinRoutes = require('./routes/spinRoutes');

// Import handlers
const { registerLotoHandlers } = require('./handlers/lotoHandler');
const { registerChessHandlers } = require('./handlers/chessHandler');
const { registerUnoHandlers } = require('./handlers/unoHandler');
const { registerCaroHandlers } = require('./handlers/caroHandler');
const { registerXiangqiHandlers } = require('./handlers/xiangqiHandler');

const app = express();
app.use(cors());
app.use(express.json());

// Kết nối MongoDB
connectDB();

// API Routes
app.use('/api', spinRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', rooms: rooms.size });
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// Shared game rooms state
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`[CONNECTION] ${socket.id}`);

    // Register game handlers
    const lotoHandlers = registerLotoHandlers(io, socket, rooms);
    const chessHandlers = registerChessHandlers(io, socket, rooms);
    const unoHandlers = registerUnoHandlers(io, socket, rooms);
    const caroHandlers = registerCaroHandlers(io, socket, rooms);
    const xiangqiHandlers = registerXiangqiHandlers(io, socket, rooms);

    // Main join room handler
    socket.on('join_room', ({ roomId, username, gameType, mode }) => {
        console.log(`[JOIN] ${socket.id} -> ${roomId} (${gameType})`);
        socket.join(roomId);

        if (gameType === 'loto') {
            lotoHandlers.handleLotoJoin(roomId, username);
        } else if (gameType === 'uno') {
            unoHandlers.handleUnoJoin(roomId, username, mode);
        } else if (gameType === 'caro') {
            caroHandlers.handleCaroJoin(roomId, username);
        } else if (gameType === 'xiangqi') {
            xiangqiHandlers.handleXiangqiJoin(roomId, username);
        } else {
            chessHandlers.handleChessJoin(roomId, username);
        }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
        console.log(`[DISCONNECT] ${socket.id}`);

        for (const [roomId, room] of rooms.entries()) {
            if (room.type === 'loto') {
                if (lotoHandlers.handleLotoDisconnect(roomId, room)) break;
            } else if (room.type === 'uno') {
                if (unoHandlers.handleUnoDisconnect(roomId, room)) break;
            } else if (room.type === 'caro') {
                if (caroHandlers.handleCaroDisconnect(roomId, room)) break;
            } else if (room.type === 'xiangqi') {
                if (xiangqiHandlers.handleXiangqiDisconnect(roomId, room)) break;
            } else {
                if (chessHandlers.handleChessDisconnect(roomId, room)) break;
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Socket server running on port ${PORT}`);
});
