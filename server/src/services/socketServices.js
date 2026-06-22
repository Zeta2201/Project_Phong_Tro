const usersMap = new Map();

global.usersMap = usersMap;

const cookie = require('cookie');
const { verifyToken } = require('./tokenSevices');
const { getUserRoom } = require('./notification.service');

class SocketServices {
    connection(socket) {
        try {
            const { token } = cookie.parse(socket.handshake.headers.cookie || '');

            if (!token) {
                return socket.disconnect();
            }

            verifyToken(token)
                .then((dataDecode) => {
                    if (!dataDecode) {
                        socket.disconnect();
                        return;
                    }

                    const currentUserId = dataDecode.id.toString();
                    usersMap.set(currentUserId, socket);
                    socket.userId = currentUserId;
                    socket.join(getUserRoom(currentUserId));
                    console.log(`User connected: ${currentUserId}`);

                    const forwardWebRTCSignal = (eventName, payload = {}) => {
                        const targetUserId = payload.targetUserId?.toString();
                        if (!targetUserId) return;

                        const receiverSocket = usersMap.get(targetUserId);
                        if (!receiverSocket) {
                            socket.emit('webrtc:user-unavailable', {
                                targetUserId,
                                message: 'Nguoi dung hien khong truc tuyen',
                            });
                            return;
                        }

                        const { targetUserId: _targetUserId, ...safePayload } = payload;
                        receiverSocket.emit(eventName, {
                            ...safePayload,
                            fromUserId: currentUserId,
                        });
                    };

                    socket.on('webrtc:call', (payload) => {
                        forwardWebRTCSignal('webrtc:incoming-call', payload);
                    });

                    socket.on('webrtc:answer', (payload) => {
                        forwardWebRTCSignal('webrtc:answer', payload);
                    });

                    socket.on('webrtc:ice-candidate', (payload) => {
                        forwardWebRTCSignal('webrtc:ice-candidate', payload);
                    });

                    socket.on('webrtc:reject', (payload) => {
                        forwardWebRTCSignal('webrtc:reject', payload);
                    });

                    socket.on('webrtc:end', (payload) => {
                        forwardWebRTCSignal('webrtc:end', payload);
                    });

                    socket.on('disconnect', () => {
                        console.log(`User disconnected: ${currentUserId}`);
                        usersMap.delete(currentUserId);
                    });
                })
                .catch((error) => {
                    console.error('Socket authentication error:', error);
                    socket.disconnect();
                });
        } catch (error) {
            console.error('Socket connection error:', error);
            return socket.disconnect();
        }
    }
}

module.exports = new SocketServices();
