// UNO Game Socket Handlers
const {
    COLORS,
    createClassicDeck,
    createFlipDeck,
    shuffleDeck,
    getCardFace,
    canPlayCard,
    getNextPlayer,
    flipAllCards,
    dealCards,
    getStartingCard
} = require('./unoHelpers');

/**
 * Register UNO game handlers for a socket
 */
function registerUnoHandlers(io, socket, rooms) {

    // Handle UNO join
    function handleUnoJoin(roomId, username, mode = 'classic') {
        let room = rooms.get(roomId);

        if (!room) {
            room = {
                type: 'uno',
                mode: mode, // 'classic' or 'flip'
                host: socket.id,
                players: [],
                deck: [],
                discardPile: [],
                currentColor: null,
                currentSide: 'light',
                currentPlayerIdx: 0,
                direction: 1,
                gameState: 'waiting',
                winner: null,
                pendingDraw: 0, // For stacking draw cards
                lastAction: null
            };
            rooms.set(roomId, room);
            console.log(`[UNO] Created ${mode} room: ${roomId}`);
        }

        // Add player if not already in and game not started
        const existingPlayer = room.players.find(p => p.id === socket.id);
        if (!existingPlayer && room.gameState === 'waiting') {
            room.players.push({
                id: socket.id,
                username: username || `Player ${socket.id.substr(0, 4)}`,
                cards: [],
                saidUno: false
            });
            console.log(`[UNO] Player ${socket.id} joined room ${roomId}`);
        }

        broadcastRoomUpdate(io, roomId, room);
    }

    // Start game
    socket.on('uno_start', ({ roomId, mode }) => {
        console.log(`[UNO_START] ${socket.id} starting ${mode} game in ${roomId}`);
        const room = rooms.get(roomId);

        if (!room || room.type !== 'uno' || room.host !== socket.id) return;
        if (room.players.length < 2) {
            socket.emit('uno_error', { message: 'Cần ít nhất 2 người chơi!' });
            return;
        }

        // Set mode and create deck
        room.mode = mode || 'classic';
        room.deck = shuffleDeck(
            room.mode === 'flip' ? createFlipDeck() : createClassicDeck()
        );
        room.currentSide = 'light';

        // Deal 7 cards to each player
        const hands = dealCards(room.deck, room.players.length, 7);
        room.players.forEach((player, idx) => {
            player.cards = hands[idx];
            player.saidUno = false;
        });

        // Get starting card
        const startCard = getStartingCard(room.deck, room.mode === 'flip');
        room.discardPile = [startCard];

        // Set current color based on starting card
        const startFace = room.mode === 'flip' ? getCardFace(startCard, true) : startCard;
        room.currentColor = startFace.color;

        room.currentPlayerIdx = 0;
        room.direction = 1;
        room.gameState = 'playing';
        room.winner = null;
        room.pendingDraw = 0;

        console.log(`[UNO] Game started. Mode: ${room.mode}, Players: ${room.players.length}`);
        io.to(roomId).emit('uno_game_started', { room: sanitizeRoom(room) });
        broadcastRoomUpdate(io, roomId, room);
    });

    // Play a card
    socket.on('uno_play_card', ({ roomId, cardIndex, chosenColor }) => {
        const room = rooms.get(roomId);
        if (!room || room.type !== 'uno' || room.gameState !== 'playing') return;

        const player = room.players.find(p => p.id === socket.id);
        const playerIdx = room.players.findIndex(p => p.id === socket.id);

        if (!player || playerIdx !== room.currentPlayerIdx) {
            socket.emit('uno_error', { message: 'Không phải lượt của bạn!' });
            return;
        }

        if (cardIndex < 0 || cardIndex >= player.cards.length) return;

        const card = player.cards[cardIndex];
        const topCard = room.discardPile[room.discardPile.length - 1];
        const isFlip = room.mode === 'flip';

        // Validate play
        if (!canPlayCard(card, topCard, room.currentColor, isFlip)) {
            socket.emit('uno_error', { message: 'Không thể đánh lá này!' });
            return;
        }

        // Remove card from hand and add to discard
        player.cards.splice(cardIndex, 1);
        room.discardPile.push(card);

        const cardFace = isFlip ? getCardFace(card, true) : card;

        // Handle wild card color choice
        if (cardFace.type === 'wild') {
            room.currentColor = chosenColor || COLORS[isFlip ? room.currentSide : 'classic'][0];
        } else {
            room.currentColor = cardFace.color;
        }

        // Reset saidUno if player has more than 1 card
        if (player.cards.length > 1) {
            player.saidUno = false;
        }

        // Process card effect
        processCardEffect(room, cardFace, io, roomId);

        // Check for winner
        if (player.cards.length === 0) {
            room.gameState = 'ended';
            room.winner = player.username;
            console.log(`[UNO] Winner: ${player.username}`);
            io.to(roomId).emit('uno_game_over', { winner: player.username });
        } else {
            // Move to next player
            room.currentPlayerIdx = getNextPlayer(room.players, room.currentPlayerIdx, room.direction);
        }

        broadcastRoomUpdate(io, roomId, room);
    });

    // Process card effects
    function processCardEffect(room, cardFace, io, roomId) {
        const isFlip = room.mode === 'flip';

        switch (cardFace.value) {
            case 'skip':
                room.currentPlayerIdx = getNextPlayer(room.players, room.currentPlayerIdx, room.direction);
                break;

            case 'skipAll':
                // Skip all others, current player goes again.
                // We set currentPlayerIdx back one step so the main turn increment brings it back.
                room.currentPlayerIdx = (room.currentPlayerIdx - room.direction + room.players.length) % room.players.length;
                break;

            case 'reverse':
                room.direction *= -1;
                if (room.players.length === 2) {
                    // In 2-player game, reverse acts as skip
                    room.currentPlayerIdx = getNextPlayer(room.players, room.currentPlayerIdx, room.direction);
                }
                break;

            case 'draw2':
                handleDrawPenalty(room, 2, io, roomId);
                break;

            case 'draw1':
                handleDrawPenalty(room, 1, io, roomId);
                break;

            case 'draw5':
                handleDrawPenalty(room, 5, io, roomId);
                break;

            case 'wild4':
                handleDrawPenalty(room, 4, io, roomId);
                break;

            case 'wild2':
                handleDrawPenalty(room, 2, io, roomId);
                break;

            case 'wildColor':
                // Draw until chosen color
                handleWildColorDraw(room, io, roomId);
                break;

            case 'flip':
                handleFlip(room, io, roomId);
                break;
        }
    }

    function handleDrawPenalty(room, count, io, roomId) {
        const nextIdx = getNextPlayer(room.players, room.currentPlayerIdx, room.direction);
        const nextPlayer = room.players[nextIdx];

        for (let i = 0; i < count; i++) {
            if (room.deck.length === 0) reshuffleDeck(room);
            if (room.deck.length > 0) {
                nextPlayer.cards.push(room.deck.pop());
            }
        }

        // Skip the player who drew
        room.currentPlayerIdx = getNextPlayer(room.players, room.currentPlayerIdx, room.direction);

        console.log(`[UNO] ${nextPlayer.username} draws ${count} cards`);
    }

    function handleWildColorDraw(room, io, roomId) {
        const nextIdx = getNextPlayer(room.players, room.currentPlayerIdx, room.direction);
        const nextPlayer = room.players[nextIdx];
        let drawnCount = 0;

        while (room.deck.length > 0 || room.discardPile.length > 1) {
            if (room.deck.length === 0) reshuffleDeck(room);
            if (room.deck.length === 0) break;

            const card = room.deck.pop();
            nextPlayer.cards.push(card);
            drawnCount++;

            const cardFace = getCardFace(card, true);
            if (cardFace.color === room.currentColor) break;

            if (drawnCount > 20) break; // Safety limit
        }

        room.currentPlayerIdx = getNextPlayer(room.players, room.currentPlayerIdx, room.direction);
        console.log(`[UNO] ${nextPlayer.username} draws ${drawnCount} cards (Wild Draw Color)`);
    }

    function handleFlip(room, io, roomId) {
        room.currentSide = room.currentSide === 'light' ? 'dark' : 'light';

        // Flip all cards
        room.deck = flipAllCards(room.deck);
        room.discardPile = flipAllCards(room.discardPile);
        room.players.forEach(p => {
            p.cards = flipAllCards(p.cards);
        });

        // Update current color based on new top card
        const topCard = room.discardPile[room.discardPile.length - 1];
        const topFace = getCardFace(topCard, true);
        if (topFace.type !== 'wild') {
            room.currentColor = topFace.color;
        }

        console.log(`[UNO] FLIP! Now on ${room.currentSide} side`);
        io.to(roomId).emit('uno_flipped', { side: room.currentSide });
    }

    function reshuffleDeck(room) {
        if (room.discardPile.length <= 1) return;

        const topCard = room.discardPile.pop();
        room.deck = shuffleDeck(room.discardPile);
        room.discardPile = [topCard];
        console.log(`[UNO] Deck reshuffled`);
    }

    // Draw a card
    socket.on('uno_draw_card', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room || room.type !== 'uno' || room.gameState !== 'playing') return;

        const player = room.players.find(p => p.id === socket.id);
        const playerIdx = room.players.findIndex(p => p.id === socket.id);

        if (!player || playerIdx !== room.currentPlayerIdx) return;

        if (room.deck.length === 0) reshuffleDeck(room);

        if (room.deck.length > 0) {
            const card = room.deck.pop();
            player.cards.push(card);
            player.saidUno = false;

            // Move to next player
            room.currentPlayerIdx = getNextPlayer(room.players, room.currentPlayerIdx, room.direction);

            console.log(`[UNO] ${player.username} drew a card`);
            broadcastRoomUpdate(io, roomId, room);
        }
    });

    // Say UNO
    socket.on('uno_say_uno', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room || room.type !== 'uno') return;

        const player = room.players.find(p => p.id === socket.id);
        if (player && player.cards.length <= 2) {
            player.saidUno = true;
            io.to(roomId).emit('uno_said', { username: player.username });
            console.log(`[UNO] ${player.username} said UNO!`);
        }
    });

    // Catch someone who forgot to say UNO
    socket.on('uno_catch', ({ roomId, targetId }) => {
        const room = rooms.get(roomId);
        if (!room || room.type !== 'uno' || room.gameState !== 'playing') return;

        const target = room.players.find(p => p.id === targetId);
        if (target && target.cards.length === 1 && !target.saidUno) {
            // Penalty: draw 2 cards
            for (let i = 0; i < 2; i++) {
                if (room.deck.length === 0) reshuffleDeck(room);
                if (room.deck.length > 0) {
                    target.cards.push(room.deck.pop());
                }
            }
            target.saidUno = false;

            io.to(roomId).emit('uno_caught', {
                catcher: room.players.find(p => p.id === socket.id)?.username,
                target: target.username
            });
            console.log(`[UNO] ${target.username} caught! Drawing 2 cards`);
            broadcastRoomUpdate(io, roomId, room);
        }
    });

    // Choose color (for wild cards)
    socket.on('uno_choose_color', ({ roomId, color }) => {
        const room = rooms.get(roomId);
        if (!room || room.type !== 'uno') return;

        const isFlip = room.mode === 'flip';
        const validColors = COLORS[isFlip ? room.currentSide : 'classic'];

        if (validColors.includes(color)) {
            room.currentColor = color;
            broadcastRoomUpdate(io, roomId, room);
        }
    });

    // Reset game
    socket.on('uno_reset', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room && room.type === 'uno' && room.host === socket.id) {
            room.gameState = 'waiting';
            room.deck = [];
            room.discardPile = [];
            room.currentPlayerIdx = 0;
            room.direction = 1;
            room.winner = null;
            room.currentSide = 'light';
            room.players.forEach(p => {
                p.cards = [];
                p.saidUno = false;
            });
            broadcastRoomUpdate(io, roomId, room);
        }
    });

    // Handle disconnect
    function handleUnoDisconnect(roomId, room) {
        const idx = room.players.findIndex(p => p.id === socket.id);
        if (idx !== -1) {
            const wasCurrentPlayer = idx === room.currentPlayerIdx;
            room.players.splice(idx, 1);
            console.log(`[UNO] Player ${socket.id} left room ${roomId}`);

            if (room.players.length === 0) {
                rooms.delete(roomId);
                console.log(`[UNO] Room ${roomId} deleted`);
            } else {
                if (room.host === socket.id) {
                    room.host = room.players[0].id;
                }

                // Adjust current player index
                if (room.gameState === 'playing') {
                    if (wasCurrentPlayer) {
                        room.currentPlayerIdx = room.currentPlayerIdx % room.players.length;
                    } else if (idx < room.currentPlayerIdx) {
                        room.currentPlayerIdx--;
                    }
                    room.currentPlayerIdx = Math.max(0, room.currentPlayerIdx % room.players.length);

                    // End game if only 1 player left
                    if (room.players.length === 1) {
                        room.gameState = 'ended';
                        room.winner = room.players[0].username;
                        io.to(roomId).emit('uno_game_over', { winner: room.winner, reason: 'Người chơi khác rời phòng' });
                    }
                }

                broadcastRoomUpdate(io, roomId, room);
            }
            return true;
        }
        return false;
    }

    return { handleUnoJoin, handleUnoDisconnect };
}

function sanitizeRoom(room) {
    // Return room data safe for clients (hide other players' cards)
    return {
        ...room,
        deck: { count: room.deck.length },
        // Players will get their own cards via their player object
    };
}

function broadcastRoomUpdate(io, roomId, room) {
    // Send personalized data to each player
    room.players.forEach(player => {
        const socketId = player.id;
        const personalizedRoom = {
            ...room,
            deck: { count: room.deck.length },
            players: room.players.map(p => ({
                id: p.id,
                username: p.username,
                cardCount: p.cards.length,
                saidUno: p.saidUno,
                // Only send cards if it's the player themselves
                cards: p.id === socketId ? p.cards : undefined
            })),
            myCards: player.cards
        };
        io.to(socketId).emit('uno_room_update', { room: personalizedRoom });
    });
}

module.exports = { registerUnoHandlers };
