import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { useNavigate } from 'react-router-dom';
import { WHEEL_SEGMENTS } from '../mock-api/data';

export default function LuckySpin() {
    const { user, refreshProfile, logout } = useAuth();
    const navigate = useNavigate();
    const [isSpinning, setIsSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [history, setHistory] = useState([]);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [showResult, setShowResult] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/');
            return;
        }
        loadHistory();
    }, [user]);

    const loadHistory = async () => {
        try {
            const h = await apiClient.getSpinHistory(user?.id);
            setHistory(h);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSpin = async () => {
        if (isSpinning) return;
        setError(null);
        setIsSpinning(true);
        setShowResult(false);

        try {
            // 1. Call Backend (MongoDB)
            const response = await apiClient.spinWheel(user?.id, user?.username);
            const { reward, segmentIndex } = response;

            // 2. Calculate Angle based on segmentIndex
            const segmentsCount = WHEEL_SEGMENTS.length;
            const segmentAngle = 360 / segmentsCount;

            // Calculate start angle of the target segment
            const segmentStart = segmentIndex * segmentAngle;

            // Calculate center of target segment
            const targetWedgeAngle = segmentStart + (segmentAngle / 2);

            // Add Jitter (Landing randomly within the segment)
            // +/- 40% of segment width to stay safe from edges
            const jitterRange = segmentAngle * 0.4;
            const jitter = (Math.random() * jitterRange * 2) - jitterRange;

            // Target Angle to Rotate TO (so target is at TOP/0deg)
            // If wedge is at X deg, we need to rotate wheel by -X.
            const stopAngle = 360 - targetWedgeAngle + jitter;

            // Add spins (5 min)
            const baseRotation = 360 * 5;

            // Calculate final total rotation
            // Ensure we move forward significantly and land on stopAngle visual
            const currentMod = rotation % 360;
            const distToStop = stopAngle - currentMod;
            // If distToStop is negative (we passed it), add 360
            const forwardDist = distToStop >= 0 ? distToStop : (360 + distToStop);

            const totalRotation = rotation + baseRotation + forwardDist;

            setRotation(totalRotation);

            // 3. Wait for animation
            setTimeout(() => {
                setIsSpinning(false);
                setResult(reward);
                setShowResult(true);
                refreshProfile();
                loadHistory();
            }, 4000);

        } catch (err) {
            setError(err.message);
            setIsSpinning(false);
        }
    };

    // Dynamic Gradient based on WHEEL_SEGMENTS
    const gradient = `conic-gradient(
        ${WHEEL_SEGMENTS.map((r, i) => {
        const start = (i * 100) / WHEEL_SEGMENTS.length;
        const end = ((i + 1) * 100) / WHEEL_SEGMENTS.length;
        return `${r.color} ${start}% ${end}%`;
    }).join(', ')}
    )`;

    return (
        <div className="min-h-screen bg-orange-50 font-sans pb-10">
            {/* Navbar */}
            <div className="bg-tet-red text-white p-4 shadow-lg flex justify-between items-center sticky top-0 z-20">
                <div className="font-bold text-xl flex items-center gap-2">
                    <span className="text-2xl">🧧</span> Vòng Quay Lì Xì
                </div>
                <div className="flex items-center gap-4 text-sm font-medium">
                    <div className="bg-white/20 px-3 py-1 rounded-full">
                        💰 {user?.balance.toLocaleString()} VND
                    </div>
                    <button onClick={logout} className="hover:text-yellow-200 transition-colors underline">
                        Thoát
                    </button>
                </div>
            </div>

            <div className="max-w-md mx-auto p-4 mt-6">

                {/* User Info Card */}
                <div className="bg-white p-4 rounded-xl shadow-md mb-6 border-l-4 border-tet-gold flex justify-between items-center">
                    <div>
                        <h2 className="text-gray-500 text-xs uppercase font-bold">Người chơi</h2>
                        <div className="text-lg font-bold text-gray-800">{user?.username}</div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 animate-pulse">
                        ⚠️ {error}
                    </div>
                )}

                {/* THE WHEEL */}
                <div className="relative w-80 h-80 mx-auto mb-8">
                    {/* Pointer */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 z-10 w-8 h-10">
                        <div className="w-0 h-0 border-l-[15px] border-l-transparent border-t-[25px] border-t-tet-dark-red border-r-[15px] border-r-transparent filter drop-shadow-lg"></div>
                    </div>

                    {/* Wheel Circle */}
                    <div
                        className="w-full h-full rounded-full border-4 border-yellow-500 shadow-2xl relative overflow-hidden spin-wheel"
                        style={{
                            background: gradient,
                            transform: `rotate(${rotation}deg)`
                        }}
                    >
                        {/* Labels */}
                        <div className="absolute inset-0 text-white font-bold text-sm">
                            {WHEEL_SEGMENTS.map((r, i) => {
                                const angle = (i * 360) / WHEEL_SEGMENTS.length + (360 / WHEEL_SEGMENTS.length) / 2;
                                return (
                                    <div
                                        key={i}
                                        className="absolute top-1/2 left-1/2 w-0 h-0 flex items-center justify-center"
                                        style={{ transform: `rotate(${angle}deg)` }}
                                    >
                                        <div
                                            className="transform -translate-y-24 text-white text-shadow font-extrabold whitespace-nowrap"
                                            style={{ transform: `translateY(-100px) rotate(90deg)` }}
                                        >
                                            {r.label}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Center Hub */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white rounded-full border-4 border-yellow-500 shadow-inner flex items-center justify-center z-10">
                            <span className="text-2xl">🌟</span>
                        </div>
                    </div>
                </div>

                {/* Spin Button */}
                <div className="text-center mb-8">
                    <button
                        onClick={handleSpin}
                        disabled={isSpinning}
                        className={`
                            px-8 py-4 rounded-full font-bold text-xl shadow-xl transform transition-all
                            ${isSpinning
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-red-500 to-yellow-500 text-white hover:scale-105 active:scale-95'
                            }
                        `}
                    >
                        {isSpinning ? 'Đang quay...' : 'QUAY NGAY!'}
                    </button>
                    <p className="text-sm text-gray-500 mt-2">Quay vô hạn - Trúng cực đã!</p>
                </div>

                {/* History List */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Lịch sử trúng thưởng</h3>
                    {history.length === 0 ? (
                        <p className="text-gray-400 text-center italic">Chưa có lịch sử</p>
                    ) : (
                        <ul className="space-y-3 max-h-60 overflow-y-auto">
                            {history.map((item) => (
                                <li key={item._id} className="flex justify-between items-center text-sm p-2 hover:bg-gray-50 rounded bg-gray-50">
                                    <span className="text-gray-600">
                                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className={`font-bold ${item.rewardAmount >= 20000 ? 'text-red-600' : 'text-yellow-600'}`}>
                                        +{item.rewardAmount.toLocaleString()}đ
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Result Modal */}
            {showResult && result && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in px-4">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center relative border-4 border-yellow-400 shadow-2xl transform animate-bounce-in">
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-6xl">
                            🧧
                        </div>
                        <h2 className="text-2xl font-bold text-tet-red mt-4 mb-2">CHÚC MỪNG!</h2>
                        <p className="text-gray-600 mb-6">Bạn đã nhận được lì xì</p>
                        <div className="text-4xl font-extrabold text-yellow-500 mb-8 drop-shadow-md">
                            {result.amount.toLocaleString()} VND
                        </div>
                        <button
                            onClick={() => setShowResult(false)}
                            className="w-full bg-tet-red text-white font-bold py-3 rounded-xl hover:bg-tet-dark-red transition-colors"
                        >
                            NHẬN THƯỞNG
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
