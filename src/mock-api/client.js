import { STORAGE_KEYS, REWARDS, MAX_SPINS_PER_DAY, WHEEL_SEGMENTS } from './data';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = () => delay(300 + Math.random() * 500);

const getUsers = () => {
    const stored = localStorage.getItem(STORAGE_KEYS.USERS);
    return stored ? JSON.parse(stored) : [];
};

const saveUsers = (users) => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
};

const getHistory = () => {
    const stored = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return stored ? JSON.parse(stored) : [];
};

const saveHistory = (history) => {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
};

const getTodayString = () => new Date().toISOString().split('T')[0];

export const mockApi = {
    login: async (username) => {
        await randomDelay();
        let users = getUsers();
        let user = users.find(u => u.username === username);

        if (!user) {
            user = {
                id: Date.now().toString(),
                username,
                balance: 0,
                spinsToday: 0,
                lastSpinDate: null
            };
            users.push(user);
            saveUsers(users);
        }

        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, user.id);
        return { ...user };
    },

    getUserProfile: async () => {
        await randomDelay();
        const userId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        if (!userId) throw new Error("Unauthorized");

        const users = getUsers();
        const user = users.find(u => u.id === userId);
        if (!user) throw new Error("User not found");

        const today = getTodayString();
        if (user.lastSpinDate !== today) {
            user.spinsToday = 0;
            saveUsers(users);
        }

        return { ...user };
    },

    spinLuckyWheel: async () => {
        await randomDelay();
        const userId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        if (!userId) throw new Error("Unauthorized");

        const users = getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex === -1) throw new Error("User not found");
        const user = users[userIndex];

        const today = getTodayString();
        // Infinite spins logic here if needed

        // 1. Determine Reward based on Probability
        const rand = Math.random();
        let accumulatedProbability = 0;
        let selectedReward = REWARDS[REWARDS.length - 1];

        for (const reward of REWARDS) {
            accumulatedProbability += reward.probability;
            if (rand < accumulatedProbability) {
                selectedReward = reward;
                break;
            }
        }

        // 2. Find matching Segment Index
        // Get all indices in WHEEL_SEGMENTS that match this reward
        const matchingIndices = WHEEL_SEGMENTS
            .map((seg, index) => seg.amount === selectedReward.amount ? index : -1)
            .filter(index => index !== -1);

        // Pick a random segment occurrence
        const segmentIndex = matchingIndices[Math.floor(Math.random() * matchingIndices.length)];

        user.balance += selectedReward.amount;
        user.spinsToday = (user.lastSpinDate === today ? user.spinsToday : 0) + 1;
        user.lastSpinDate = today;
        users[userIndex] = user;
        saveUsers(users);

        const history = getHistory();
        const record = {
            id: Date.now().toString(),
            userId: user.id,
            username: user.username,
            rewardAmount: selectedReward.amount,
            createdAt: new Date().toISOString()
        };
        history.push(record);
        saveHistory(history);

        return {
            reward: selectedReward,
            segmentIndex: segmentIndex, // Return the visual index
            userUpdates: { ...user }
        };
    },

    getSpinHistory: async () => {
        await randomDelay();
        const userId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        if (!userId) throw new Error("Unauthorized");

        const history = getHistory();
        return history.filter(h => h.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    logout: async () => {
        await randomDelay();
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        return true;
    }
};
