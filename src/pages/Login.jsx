import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [username, setUsername] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username) return;
        setLoading(true);
        try {
            await login(username);
            navigate('/hub');
        } catch (error) {
            alert("Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-tet-red relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-tet-gold rounded-full blur-3xl opacity-20"></div>
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-tet-yellow rounded-full blur-3xl opacity-20"></div>

            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md z-10 border-4 border-tet-gold">
                <h1 className="text-3xl font-bold text-center mb-6 text-tet-red uppercase tracking-wider">
                    Vòng Quay Lì Xì
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-gray-700 font-medium mb-2">Tên đăng nhập</label>
                        <input
                            type="text"
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-tet-red focus:ring-2 focus:ring-red-100 transition-all font-lg"
                            placeholder="Nhập tên của bạn..."
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !username.trim()}
                        className="w-full bg-tet-red hover:bg-tet-dark-red text-white font-bold py-3 rounded-xl transition-all shadow-lg transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Đang vào...' : 'Bắt đầu chơi ngay!'}
                    </button>
                </form>

                <p className="mt-4 text-center text-sm text-gray-500">
                    Sự kiện Vòng Quay May Mắn Chào Xuân
                </p>
            </div>
        </div>
    );
}
