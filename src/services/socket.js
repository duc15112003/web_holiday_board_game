import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

class SocketService {
    socket = null;

    connect() {
        if (!this.socket) {
            this.socket = io(URL);
            this.socket.on('connect', () => {
                console.log('Connected to socket server:', this.socket.id);
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
