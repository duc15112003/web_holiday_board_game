import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const GAMES = [
    {
        id: 'lucky-spin',
        name: 'Vòng Quay Lì Xì',
        icon: '🧧',
        description: 'Thử vận may đầu năm, nhận lì xì cực khủng!',
        path: '/games/lucky-spin',
        color: 'from-red-500 to-yellow-500',
        active: true
    },
    {
        id: 'caro',
        name: 'Cờ Caro',
        icon: '⭕',
        description: 'Đấu trí căng thẳng 5 nước thắng. (Sắp ra mắt)',
        path: '/games/caro',
        color: 'from-blue-500 to-cyan-500',
        active: true // Will enable as we build
    },
    {
        id: 'chess',
        name: 'Cờ Vua',
        icon: '♟️',
        description: 'Chiến thuật đỉnh cao, vua của các loại cờ. (Sắp ra mắt)',
        path: '/games/chess',
        color: 'from-gray-700 to-gray-900',
        active: true
    },
    {
        id: 'loto',
        name: 'Lô Tô',
        icon: '🔢',
        description: 'Trò chơi dân gian, dò số trúng thưởng vui nhộn.',
        path: '/games/loto',
        color: 'from-green-500 to-teal-500',
        active: true
    },
    {
        id: 'uno',
        name: 'UNO',
        icon: '🃏',
        description: 'Bài UNO kinh điển + Chế độ Flip đặc biệt!',
        path: '/games/uno',
        color: 'from-red-500 via-yellow-500 to-blue-500',
        active: true
    },
    {
        id: 'pacman',
        name: 'Pacman',
        icon: '🕹️',
        description: 'Ăn hết hạt, tránh ma và ghi điểm cao nhất!',
        path: '/games/pacman',
        color: 'from-yellow-400 to-orange-500',
        active: true
    },
    {
        id: 'xiangqi',
        name: 'Cờ Tướng',
        icon: '🧓',
        description: 'Trận chiến lịch sử bên bờ sông Sở Hà Hán Giới. Đấu với AI.',
        path: '/games/xiangqi',
        color: 'from-orange-600 to-red-700',
        active: true
    }
];

export default function GameHub() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        🎮 Game Center
                    </h1>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <div className="font-bold text-gray-900">{user?.username}</div>
                            <div className="text-sm text-yellow-600 font-bold">💰 {user?.balance.toLocaleString()} VND</div>
                        </div>
                        <button
                            onClick={logout}
                            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            Đăng xuất
                        </button>
                    </div>
                </div>
            </header>

            {/* Game Grid */}
            <main className="max-w-5xl mx-auto px-4 py-8">
                <h2 className="text-xl font-bold text-gray-700 mb-6">Danh sách trò chơi</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                    {GAMES.map((game) => (
                        <div
                            key={game.id}
                            onClick={() => game.active && navigate(game.path)}
                            className={`
                                relative overflow-hidden rounded-2xl shadow-lg cursor-pointer transition-all transform hover:-translate-y-1 hover:shadow-xl
                                ${game.active ? 'bg-white' : 'bg-gray-100 opacity-80'}
                            `}
                        >
                            {/* Card Header / Banner */}
                            <div className={`h-32 bg-gradient-to-r ${game.color} flex items-center justify-center`}>
                                <div className="text-6xl filter drop-shadow-md transform transition-transform group-hover:scale-110">
                                    {game.icon}
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-2 flex justify-between">
                                    {game.name}
                                    {!game.active && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-1 rounded-full uppercase">Sắp ra mắt</span>}
                                </h3>
                                <p className="text-gray-600 text-sm">
                                    {game.description}
                                </p>

                                {game.active && (
                                    <button className="mt-4 w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition-colors">
                                        Chơi Ngay
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
