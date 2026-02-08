import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import GameHub from './pages/GameHub';
import LuckySpin from './pages/LuckySpin';
import Caro from './pages/Caro';
import ChessGame from './pages/Chess';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-100">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/hub" element={<GameHub />} />

            {/* Games */}
            <Route path="/games/lucky-spin" element={<LuckySpin />} />
            <Route path="/games/caro" element={<Caro />} />
            <Route path="/games/chess" element={<ChessGame />} />
            <Route path="/games/xiangqi" element={<div className="p-10 text-center">Xiangqi Coming Soon</div>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
