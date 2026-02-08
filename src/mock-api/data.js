// Keys for localStorage
export const STORAGE_KEYS = {
    USERS: 'tet_game_users',
    HISTORY: 'tet_game_history',
    CURRENT_USER: 'tet_game_current_user_id'
};

export const INITIAL_USERS = [
    { id: '1', username: 'testuser', balance: 0, spinsToday: 0, lastSpinDate: null }
];

export const MAX_SPINS_PER_DAY = Infinity;

// Logical Rewards (Probabilities)
export const REWARDS = [
    { amount: 1000, probability: 0.30, label: '1K', color: '#ef4444' },    // Red
    { amount: 2000, probability: 0.25, label: '2K', color: '#f59e0b' },    // Amber
    { amount: 5000, probability: 0.20, label: '5K', color: '#eab308' },    // Yellow
    { amount: 10000, probability: 0.10, label: '10K', color: '#84cc16' },  // Lime
    { amount: 20000, probability: 0.10, label: '20K', color: '#06b6d4' },  // Cyan
    { amount: 50000, probability: 0.04, label: '50K', color: '#3b82f6' },  // Blue
    { amount: 100000, probability: 0.01, label: '100K', color: '#a855f7' } // Purple
];

const findReward = (amount) => REWARDS.find(r => r.amount === amount);

// Visual Wheel Segments (More segments, explicit shuffle)
// Total: 20 Segments for a "fuller" look
// 1k: 5
// 2k: 4
// 5k: 4
// 10k: 3
// 20k: 2
// 50k: 1
// 100k: 1
export const WHEEL_SEGMENTS = [
    findReward(1000),   // 1
    findReward(10000),  // 2
    findReward(2000),   // 3
    findReward(5000),   // 4
    findReward(1000),   // 5
    findReward(50000),  // 6
    findReward(2000),   // 7
    findReward(5000),   // 8
    findReward(1000),   // 9
    findReward(20000),  // 10
    findReward(2000),   // 11
    findReward(10000),  // 12
    findReward(5000),   // 13
    findReward(1000),   // 14
    findReward(100000), // 15 (Jackpot)
    findReward(2000),   // 16
    findReward(5000),   // 17
    findReward(1000),   // 18
    findReward(20000),  // 19
    findReward(10000),  // 20
];
