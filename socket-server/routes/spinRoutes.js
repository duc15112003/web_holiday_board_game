const express = require('express');
const router = express.Router();
const SpinHistory = require('../models/SpinHistory');

// Cấu hình phần thưởng (giống data.js phía frontend)
const REWARDS = [
    { amount: 1000, probability: 0.30, label: '1K' },
    { amount: 2000, probability: 0.25, label: '2K' },
    { amount: 5000, probability: 0.20, label: '5K' },
    { amount: 10000, probability: 0.10, label: '10K' },
    { amount: 20000, probability: 0.10, label: '20K' },
    { amount: 50000, probability: 0.04, label: '50K' },
    { amount: 100000, probability: 0.01, label: '100K' }
];

// Thứ tự segment trên vòng quay (20 segments)
const WHEEL_SEGMENTS_AMOUNTS = [
    1000, 10000, 2000, 5000, 1000,
    50000, 2000, 5000, 1000, 20000,
    2000, 10000, 5000, 1000, 100000,
    2000, 5000, 1000, 20000, 10000
];

// POST /api/spin - Quay thưởng
router.post('/spin', async (req, res) => {
    try {
        const { userId, username } = req.body;

        if (!userId || !username) {
            return res.status(400).json({ error: 'userId và username là bắt buộc' });
        }

        // 1. Xác định phần thưởng dựa trên xác suất
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

        // 2. Tìm segment index trên vòng quay
        const matchingIndices = WHEEL_SEGMENTS_AMOUNTS
            .map((amount, index) => amount === selectedReward.amount ? index : -1)
            .filter(index => index !== -1);

        const segmentIndex = matchingIndices[Math.floor(Math.random() * matchingIndices.length)];

        // 3. Lưu vào MongoDB
        const record = await SpinHistory.create({
            userId,
            username,
            rewardAmount: selectedReward.amount,
            rewardLabel: selectedReward.label
        });

        // 4. Trả kết quả
        res.json({
            reward: selectedReward,
            segmentIndex,
            history: {
                id: record._id,
                userId: record.userId,
                username: record.username,
                rewardAmount: record.rewardAmount,
                createdAt: record.createdAt
            }
        });
    } catch (error) {
        console.error('Spin error:', error);
        res.status(500).json({ error: 'Lỗi server khi quay thưởng' });
    }
});

// GET /api/spin-history/:userId - Lấy lịch sử quay
router.get('/spin-history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const history = await SpinHistory.find({ userId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json(history);
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ error: 'Lỗi server khi lấy lịch sử' });
    }
});

module.exports = router;
