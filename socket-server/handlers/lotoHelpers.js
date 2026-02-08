// Loto Ticket Generator and Win Verifier

/**
 * Generate a valid Loto ticket (9 columns x 3 rows, 5 numbers per row)
 * @param {Array} existingTickets - Array of existing tickets in the room to avoid duplicates
 */
function generateLotoTicket(existingTickets = []) {
    // Flatten existing tickets to get all used numbers across players
    const usedAcrossPlayers = new Set();
    existingTickets.forEach(ticket => {
        ticket.forEach(row => {
            row.forEach(num => {
                if (num !== 0) usedAcrossPlayers.add(num);
            });
        });
    });

    const ticket = [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ];

    // Column ranges: 1-9, 10-19, ..., 80-90
    const ranges = [
        [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
        [50, 59], [60, 69], [70, 79], [80, 90]
    ];

    const usedInThisTicket = new Set();

    const getNum = (colIdx) => {
        const [min, max] = ranges[colIdx];
        let num;
        let attempts = 0;
        do {
            num = Math.floor(Math.random() * (max - min + 1)) + min;
            attempts++;
            // Allow some overlap if too many attempts (max 90 unique numbers total)
        } while ((usedInThisTicket.has(num) || (usedAcrossPlayers.has(num) && attempts < 50)) && attempts < 100);
        usedInThisTicket.add(num);
        return num;
    };

    // For each row, pick 5 random columns
    ticket.forEach(row => {
        const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8]
            .sort(() => Math.random() - 0.5)
            .slice(0, 5);
        indices.forEach(colIdx => {
            row[colIdx] = getNum(colIdx);
        });
    });

    return ticket;
}

/**
 * Verify if player has won (any row fully covered)
 */
function verifyLotoWin(ticket, drawnNumbers) {
    return ticket.some(row => {
        const numbers = row.filter(n => n !== 0);
        return numbers.every(n => drawnNumbers.includes(n));
    });
}

module.exports = {
    generateLotoTicket,
    verifyLotoWin
};
