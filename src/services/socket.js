import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

class SocketService {
    socket = null;

    connect() {
        if (!this.socket) {
            console.log('[SocketService] Connecting to:', URL);
            this.socket = io(URL, {
                transports: ['websocket', 'polling'],
                timeout: 5000,
                reconnectionAttempts: 3
            });
            this.socket.on('connect', () => {
                console.log('[SocketService] Connected! ID:', this.socket.id);
            });
            this.socket.on('connect_error', (err) => {
                console.error('[SocketService] Connection error:', err.message);
            });
            this.socket.on('disconnect', (reason) => {
                console.log('[SocketService] Disconnected:', reason);
            });
        }
        return this.socket;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    // Emit event wrapper
    emit(event, data) {
        if (this.socket) {
            this.socket.emit(event, data);
        }
    }

    // Listener wrapper
    on(event, callback) {
        if (this.socket) {
            this.socket.on(event, callback);
        }
    }

    off(event) {
        if (this.socket) {
            this.socket.off(event);
        }
    }
}

export const socketService = new SocketService();
