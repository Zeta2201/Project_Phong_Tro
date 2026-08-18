/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './Chatbot.module.scss';
import { requestChatbot } from '../../config/request';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faPaperPlane, faTimes } from '@fortawesome/free-solid-svg-icons';
import imgDefault from '../../assets/images/img_default.png';

const quickPrompts = [
    'Tìm phòng dưới 3 triệu gần trung tâm',
    'Căn phòng còn trống có thể đặt cọc',
    'Tư vấn khi ký hợp đồng thuê phòng',
];

const CHAT_BUTTON_STORAGE_KEY = 'nestfinder-ai-chat-position';
const CHAT_BUTTON_PADDING = 10;

const normalizeBotResponse = (response) => {
    if (typeof response === 'string') {
        return { answer: response, suggestions: [] };
    }
    return {
        answer: response?.answer || 'Mình chưa có câu trả lời phù hợp. Bạn thử nói rõ hơn về khu vực và ngân sách nhé.',
        suggestions: response?.suggestions || [],
    };
};

const Chatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            text: 'Xin chào! Mình là trơ lý AI hỗ trợ thuê phòng. Bạn có thể hỏi về phòng phù hợp, giá thuê, đặt cọc hoặc hợp đồng.',
            sender: 'bot',
            suggestions: [],
        },
    ]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [buttonPosition, setButtonPosition] = useState(null);
    const messagesEndRef = useRef(null);
    const chatButtonRef = useRef(null);
    const buttonPositionRef = useRef(null);
    const dragRef = useRef({
        isDragging: false,
        moved: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        offsetX: 0,
        offsetY: 0,
    });

    const getButtonSize = () => {
        const rect = chatButtonRef.current?.getBoundingClientRect();
        return {
            width: rect?.width || 62,
            height: rect?.height || 62,
        };
    };

    const clampPosition = (position) => {
        const { width, height } = getButtonSize();
        const maxX = Math.max(CHAT_BUTTON_PADDING, window.innerWidth - width - CHAT_BUTTON_PADDING);
        const maxY = Math.max(CHAT_BUTTON_PADDING, window.innerHeight - height - CHAT_BUTTON_PADDING);

        return {
            x: Math.min(Math.max(position.x, CHAT_BUTTON_PADDING), maxX),
            y: Math.min(Math.max(position.y, CHAT_BUTTON_PADDING), maxY),
        };
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    useEffect(() => {
        buttonPositionRef.current = buttonPosition;
    }, [buttonPosition]);

    useEffect(() => {
        let parsedPosition = null;
        const savedPosition = localStorage.getItem(CHAT_BUTTON_STORAGE_KEY);

        if (savedPosition) {
            try {
                parsedPosition = JSON.parse(savedPosition);
            } catch (error) {
                localStorage.removeItem(CHAT_BUTTON_STORAGE_KEY);
            }
        }

        const fallbackPosition = {
            x: window.innerWidth - getButtonSize().width - 20,
            y: window.innerHeight - getButtonSize().height - 92,
        };

        setButtonPosition(clampPosition(parsedPosition || fallbackPosition));
    }, []);

    useEffect(() => {
        const handleResize = () => {
            setButtonPosition((current) => {
                if (!current) return current;
                const nextPosition = clampPosition(current);
                localStorage.setItem(CHAT_BUTTON_STORAGE_KEY, JSON.stringify(nextPosition));
                return nextPosition;
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const sendMessage = async (messageText) => {
        const userMessage = messageText.trim();
        if (!userMessage || isLoading) return;

        setMessages((prev) => [...prev, { text: userMessage, sender: 'user' }]);
        setInputMessage('');
        setIsLoading(true);

        try {
            const response = await requestChatbot({ question: userMessage });
            const botResponse = normalizeBotResponse(response);
            setMessages((prev) => [...prev, { text: botResponse.answer, sender: 'bot', suggestions: botResponse.suggestions }]);
        } catch (error) {
            setMessages((prev) => [
                ...prev,
                {
                    text: 'Xin lỗi, hiện tại mình chưa thể kết nối AI. Bạn vui lòng thử lại sau.',
                    sender: 'bot',
                    suggestions: [],
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        sendMessage(inputMessage);
    };

    const handleChatButtonPointerDown = (event) => {
        if (!buttonPosition) return;

        dragRef.current = {
            isDragging: true,
            moved: false,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            offsetX: event.clientX - buttonPosition.x,
            offsetY: event.clientY - buttonPosition.y,
        };

        event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const handleChatButtonPointerMove = (event) => {
        const dragState = dragRef.current;
        if (!dragState.isDragging || dragState.pointerId !== event.pointerId) return;

        const distanceX = Math.abs(event.clientX - dragState.startX);
        const distanceY = Math.abs(event.clientY - dragState.startY);

        if (distanceX > 4 || distanceY > 4) {
            dragState.moved = true;
        }

        if (!dragState.moved) return;

        const nextPosition = clampPosition({
            x: event.clientX - dragState.offsetX,
            y: event.clientY - dragState.offsetY,
        });

        buttonPositionRef.current = nextPosition;
        setButtonPosition(nextPosition);
    };

    const handleChatButtonPointerUp = (event) => {
        const dragState = dragRef.current;
        if (dragState.pointerId !== event.pointerId) return;

        if (dragState.moved && buttonPositionRef.current) {
            localStorage.setItem(CHAT_BUTTON_STORAGE_KEY, JSON.stringify(buttonPositionRef.current));
        }

        dragRef.current = {
            ...dragState,
            isDragging: false,
            pointerId: null,
        };
    };

    const handleChatButtonClick = (event) => {
        if (dragRef.current.moved) {
            event.preventDefault();
            dragRef.current.moved = false;
            return;
        }

        setIsOpen(true);
    };

    return (
        <>
            <button
                ref={chatButtonRef}
                className={styles.chatButton}
                style={
                    buttonPosition
                        ? {
                              left: buttonPosition.x,
                              top: buttonPosition.y,
                              right: 'auto',
                              bottom: 'auto',
                          }
                        : undefined
                }
                onPointerDown={handleChatButtonPointerDown}
                onPointerMove={handleChatButtonPointerMove}
                onPointerUp={handleChatButtonPointerUp}
                onPointerCancel={handleChatButtonPointerUp}
                onClick={handleChatButtonClick}
                aria-label="Mở trợ lý AI thuê phòng"
            >
                <FontAwesomeIcon icon={faComments} />
                <span>AI</span>
            </button>

            {isOpen && (
                <div className={styles.chatbotContainer}>
                    <div className={styles.chatHeader}>
                        <div>
                            <span>AI Rent Assistant</span>
                            <h2>Hỗ trợ thuê phòng</h2>
                        </div>
                        <button className={styles.closeButton} onClick={() => setIsOpen(false)} aria-label="Đóng chat">
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </div>

                    <div className={styles.quickPrompts}>
                        {quickPrompts.map((prompt) => (
                            <button key={prompt} type="button" onClick={() => sendMessage(prompt)} disabled={isLoading}>
                                {prompt}
                            </button>
                        ))}
                    </div>

                    <div className={styles.messageList}>
                        {messages.map((message, index) => (
                            <div
                                key={`${message.sender}-${index}`}
                                className={`${styles.message} ${message.sender === 'user' ? styles.userMessage : styles.botMessage}`}
                            >
                                <div className={styles.messageContent}>
                                    {message.text.split('\n').map((line, lineIndex) => (
                                        <p key={`${line}-${lineIndex}`}>{line}</p>
                                    ))}
                                </div>

                                {message.suggestions?.length > 0 && (
                                    <div className={styles.suggestionList}>
                                        {message.suggestions.map((post) => (
                                            <Link className={styles.suggestionCard} to={`/chi-tiet-tin-dang/${post._id}`} key={post._id}>
                                                <img src={post.image || imgDefault} alt={post.title} />
                                                <div>
                                                    <strong>{post.title}</strong>
                                                    <span>{Number(post.price || 0).toLocaleString('vi-VN')} VND/tháng</span>
                                                    <small>
                                                        {post.area || '-'} m2 - {post.location || 'Đang cập nhật'}
                                                    </small>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}

                        {isLoading && (
                            <div className={`${styles.message} ${styles.botMessage}`}>
                                <div className={styles.messageContent}>
                                    <span className={styles.typingIndicator}>Đang tìm phòng phù hợp...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSubmit} className={styles.inputForm}>
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(event) => setInputMessage(event.target.value)}
                            placeholder="Nhập khu vực, ngân sách, nhu cầu..."
                            className={styles.input}
                            disabled={isLoading}
                        />
                        <button type="submit" className={styles.sendButton} disabled={isLoading || !inputMessage.trim()} aria-label="Gửi tin nhắn">
                            <FontAwesomeIcon icon={faPaperPlane} />
                        </button>
                    </form>
                </div>
            )}
        </>
    );
};

export default Chatbot;
