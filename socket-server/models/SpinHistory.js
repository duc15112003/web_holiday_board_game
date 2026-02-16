const mongoose = require('mongoose');

const spinHistorySchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    username: {
        type: String,
        required: true
    },
    rewardAmount: {
        type: Number,
        required: true
    },
    rewardLabel: {
        type: String,
        required: true
    }
}, {
    timestamps: true // Tự động thêm createdAt, updatedAt
});

module.exports = mongoose.model('SpinHistory', spinHistorySchema);
