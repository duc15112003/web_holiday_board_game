const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const apiClient = {
    /**
     * Quay vòng quay may mắn
     * @param {string} userId
     * @param {string} username
     * @returns {{ reward, segmentIndex, history }}
     */
    spinWheel: async (userId, username) => {
        const res = await fetch(`${API_URL}/api/spin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, username })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Lỗi khi quay thưởng');
        }

        return res.json();
    },

    /**
     * Lấy lịch sử quay thưởng
     * @param {string} userId
     * @returns {Array}
     */
    getSpinHistory: async (userId) => {
        const res = await fetch(`${API_URL}/api/spin-history/${userId}`);

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Lỗi khi lấy lịch sử');
        }

        return res.json();
    }
};
