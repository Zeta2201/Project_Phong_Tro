import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

import SocketContext from './SocketContext';
import { requestGetMessagesByUserId } from '../config/request';
import { useStore } from '../hooks/useStore';

function SocketProvider({ children }) {
    const [dataPayment, setDataPayment] = useState(null);
    const [dataFavourite, setDataFavourite] = useState(null);
    const [dataMessagersUser, setDataMessagersUser] = useState([]);
    const [newMessage, setNewMessage] = useState(null);
    const [newUserMessage, setNewUserMessage] = useState(null);
    const [messagesRead, setMessagesRead] = useState(null);
    const [socketClient, setSocketClient] = useState(null);
    const socketRef = useRef(null);

    const { globalUsersMessage, setGlobalUsersMessage } = useStore();

    useEffect(() => {
        socketRef.current = io(import.meta.env.VITE_SOCKET_URL, {
            transports: ['websocket'],
            withCredentials: true,
        });

        const socket = socketRef.current;
        setSocketClient(socket);

        socket.on('connect', () => {
            console.log('connected to socket');
        });

        socket.on('new-payment', (data) => {
            setDataPayment(data);
        });

        socket.on('new-favourite', (data) => {
            setDataFavourite(data?.content);
        });

        socket.on('new-message', (data) => {
            setNewMessage(data.message);
        });

        socket.on('new-user-message', (data) => {
            setNewUserMessage(data.message);
        });

        socket.on('messages-read', (data) => {
            setMessagesRead(data);
        });

        return () => {
            socket.removeAllListeners();
            socket.disconnect();
            setSocketClient(null);
        };
    }, []);

    useEffect(() => {
        const fetchMessages = async () => {
            const res = await requestGetMessagesByUserId();
            setDataMessagersUser(res.metadata);
        };
        fetchMessages();
    }, [newUserMessage]);

    useEffect(() => {
        if (!newMessage) {
            return;
        }

        setGlobalUsersMessage((prevUsers) => {
            const userIndex = prevUsers.findIndex((user) => user.id === newMessage.senderId);

            if (userIndex === -1) {
                return prevUsers;
            }

            const updatedUsers = [...prevUsers];
            const currentMessages = updatedUsers[userIndex]?.messages || [];
            updatedUsers[userIndex] = {
                ...updatedUsers[userIndex],
                messages: [...currentMessages, newMessage],
            };

            return updatedUsers;
        });
    }, [newMessage, setGlobalUsersMessage]);

    useEffect(() => {
        if (!messagesRead) {
            return;
        }

        const { readerId, count } = messagesRead;

        if (count <= 0) {
            return;
        }

        setGlobalUsersMessage((prevUsers) => {
            const userIndex = prevUsers.findIndex((user) => user.id === readerId);

            if (userIndex === -1) {
                return prevUsers;
            }

            const updatedUsers = [...prevUsers];
            const updatedMessages = updatedUsers[userIndex]?.messages?.map((msg) => {
                if (msg.receiverId === readerId && !msg.isRead) {
                    return { ...msg, isRead: true };
                }
                return msg;
            });

            updatedUsers[userIndex] = {
                ...updatedUsers[userIndex],
                messages: updatedMessages,
            };

            return updatedUsers;
        });
    }, [messagesRead, setGlobalUsersMessage]);

    useEffect(() => {
        if (!newUserMessage || dataMessagersUser.length === 0) {
            return;
        }

        const senderInfo = dataMessagersUser.find((messager) => messager.sender.id === newUserMessage.senderId);

        if (!senderInfo) {
            return;
        }

        setGlobalUsersMessage((prevUsers) => {
            if (prevUsers.find((user) => user.id === senderInfo.sender.id)) {
                return prevUsers;
            }

            return [
                ...prevUsers,
                {
                    id: senderInfo.sender.id,
                    username: senderInfo.sender.username,
                    avatar: senderInfo.sender.avatar,
                    status: senderInfo.sender.status,
                    messages: [newUserMessage],
                },
            ];
        });
    }, [newUserMessage, dataMessagersUser, setGlobalUsersMessage]);

    return (
        <SocketContext.Provider
            value={{
                dataPayment,
                dataFavourite,
                dataMessagersUser,
                usersMessage: globalUsersMessage,
                setUsersMessage: setGlobalUsersMessage,
                socketRef,
                socketClient,
                newMessage,
                messagesRead,
            }}
        >
            {children}
        </SocketContext.Provider>
    );
}

export default SocketProvider;
