// UNO Helper Functions - Deck Generation and Game Logic

const COLORS = {
    classic: ['red', 'yellow', 'green', 'blue'],
    light: ['red', 'yellow', 'green', 'blue'],
    dark: ['pink', 'orange', 'purple', 'teal']
};

/**
 * Create a standard 108-card UNO deck
 */
function createClassicDeck() {
    const deck = [];
    const colors = COLORS.classic;

    colors.forEach(color => {
        // One 0 per color
        deck.push({ color, value: '0', type: 'number' });

        // Two of each 1-9
        for (let i = 1; i <= 9; i++) {
            deck.push({ color, value: String(i), type: 'number' });
            deck.push({ color, value: String(i), type: 'number' });
        }

        // Two of each action card
        for (let i = 0; i < 2; i++) {
            deck.push({ color, value: 'skip', type: 'action' });
            deck.push({ color, value: 'reverse', type: 'action' });
            deck.push({ color, value: 'draw2', type: 'action' });
        }
    });

    // Wild cards (4 of each)
    for (let i = 0; i < 4; i++) {
        deck.push({ color: 'wild', value: 'wild', type: 'wild' });
        deck.push({ color: 'wild', value: 'wild4', type: 'wild' });
    }

    return deck;
}

/**
 * Create UNO Flip deck - each card has light and dark side
 */
function createFlipDeck() {
    const deck = [];
    const lightColors = COLORS.light;
    const darkColors = COLORS.dark;

    // Create paired cards (light + dark side)
    for (let colorIdx = 0; colorIdx < 4; colorIdx++) {
        const lightColor = lightColors[colorIdx];
        const darkColor = darkColors[colorIdx];

        // One 0 per color
        deck.push({
            light: { color: lightColor, value: '0', type: 'number' },
            dark: { color: darkColor, value: '0', type: 'number' },
            side: 'light'
        });

        // Two of each 1-9
        for (let i = 1; i <= 9; i++) {
            for (let j = 0; j < 2; j++) {
                deck.push({
                    light: { color: lightColor, value: String(i), type: 'number' },
                    dark: { color: darkColor, value: String(i), type: 'number' },
                    side: 'light'
                });
            }
        }

        // Action cards - Light: draw1, skip, reverse, flip | Dark: draw5, skipAll, reverse, flip
        for (let j = 0; j < 2; j++) {
            deck.push({
                light: { color: lightColor, value: 'draw1', type: 'action' },
                dark: { color: darkColor, value: 'draw5', type: 'action' },
                side: 'light'
            });
            deck.push({
                light: { color: lightColor, value: 'skip', type: 'action' },
                dark: { color: darkColor, value: 'skipAll', type: 'action' },
                side: 'light'
            });
            deck.push({
                light: { color: lightColor, value: 'reverse', type: 'action' },
                dark: { color: darkColor, value: 'reverse', type: 'action' },
                side: 'light'
            });
            deck.push({
                light: { color: lightColor, value: 'flip', type: 'action' },
                dark: { color: darkColor, value: 'flip', type: 'action' },
                side: 'light'
            });
        }
    }

    // Wild cards
    for (let i = 0; i < 4; i++) {
        deck.push({
            light: { color: 'wild', value: 'wild', type: 'wild' },
            dark: { color: 'wild', value: 'wild', type: 'wild' },
            side: 'light'
        });
        deck.push({
            light: { color: 'wild', value: 'wild2', type: 'wild' },
            dark: { color: 'wild', value: 'wildColor', type: 'wild' },
            side: 'light'
        });
    }

    return deck;
}

/**
 * Fisher-Yates shuffle
 */
function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Get the visible side of a card (for Flip mode)
 */
function getCardFace(card, isFlipMode = false) {
    if (!isFlipMode) return card;
    return card[card.side];
}

/**
 * Check if a card can be played
 */
function canPlayCard(card, topCard, currentColor, isFlipMode = false) {
    const playCard = isFlipMode ? getCardFace(card, true) : card;
    const discardCard = isFlipMode ? getCardFace(topCard, true) : topCard;

    // Wild cards can always be played
    if (playCard.type === 'wild') return true;

    // Match by color
    if (playCard.color === currentColor) return true;

    // Match by value
    if (playCard.value === discardCard.value) return true;

    return false;
}

/**
 * Get next player index based on direction
 */
function getNextPlayer(players, currentIdx, direction, skipCount = 1) {
    let nextIdx = currentIdx;
    for (let i = 0; i < skipCount; i++) {
        nextIdx = (nextIdx + direction + players.length) % players.length;
    }
    return nextIdx;
}

/**
 * Flip all cards to the other side
 */
function flipAllCards(cards) {
    return cards.map(card => ({
        ...card,
        side: card.side === 'light' ? 'dark' : 'light'
    }));
}

/**
 * Deal cards to players
 */
function dealCards(deck, playerCount, cardsPerPlayer = 7) {
    const hands = Array.from({ length: playerCount }, () => []);
    for (let i = 0; i < cardsPerPlayer; i++) {
        for (let p = 0; p < playerCount; p++) {
            if (deck.length > 0) {
                hands[p].push(deck.pop());
            }
        }
    }
    return hands;
}

/**
 * Get a starting card (not a wild card)
 */
function getStartingCard(deck, isFlipMode = false) {
    for (let i = deck.length - 1; i >= 0; i--) {
        const card = deck[i];
        const face = isFlipMode ? getCardFace(card, true) : card;
        if (face.type !== 'wild') {
            deck.splice(i, 1);
            return card;
        }
    }
    // Fallback - return last card
    return deck.pop();
}

module.exports = {
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
};
