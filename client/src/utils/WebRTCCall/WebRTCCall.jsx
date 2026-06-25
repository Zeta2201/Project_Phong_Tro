/* eslint-disable no-unused-vars */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, message } from 'antd';
import { AudioOutlined, AudioMutedOutlined, CloseOutlined, PhoneOutlined, VideoCameraOutlined } from '@ant-design/icons';
import classNames from 'classnames/bind';
import styles from './WebRTCCall.module.scss';
import { useSocket } from '../../hooks/useSocket';
import { useStore } from '../../hooks/useStore';

const cx = classNames.bind(styles);

const peerConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const emptyCall = {
    visible: false,
    status: 'idle',
    callType: 'video',
    peerUser: null,
    offer: null,
    fromUserId: null,
};

function WebRTCCall() {
    const { socketRef, socketClient } = useSocket();
    const { dataUser } = useStore();
    const [call, setCall] = useState(emptyCall);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isMicEnabled, setIsMicEnabled] = useState(true);
    const [isCameraEnabled, setIsCameraEnabled] = useState(true);
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const peerUserRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    const socket = socketClient;

    useEffect(() => {
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    const stopLocalMedia = useCallback(() => {
        localStreamRef.current?.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);
    }, []);

    const closePeerConnection = useCallback(() => {
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        remoteStreamRef.current = null;
        setRemoteStream(null);
    }, []);

    const cleanupCall = useCallback(() => {
        closePeerConnection();
        stopLocalMedia();
        peerUserRef.current = null;
        setIsMicEnabled(true);
        setIsCameraEnabled(true);
        setCall(emptyCall);
    }, [closePeerConnection, stopLocalMedia]);

    const getMediaStream = useCallback(async (callType) => {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: callType === 'video',
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
    }, []);

    const createPeerConnection = useCallback(
        (targetUserId) => {
            const peerConnection = new RTCPeerConnection(peerConfig);
            const nextRemoteStream = new MediaStream();

            remoteStreamRef.current = nextRemoteStream;
            setRemoteStream(nextRemoteStream);

            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socketRef.current?.emit('webrtc:ice-candidate', {
                        targetUserId,
                        candidate: event.candidate,
                    });
                }
            };

            peerConnection.ontrack = (event) => {
                event.streams[0]?.getTracks().forEach((track) => {
                    if (!nextRemoteStream.getTracks().some((item) => item.id === track.id)) {
                        nextRemoteStream.addTrack(track);
                    }
                });
                setRemoteStream(nextRemoteStream);
            };

            peerConnection.onconnectionstatechange = () => {
                if (['failed', 'closed', 'disconnected'].includes(peerConnection.connectionState)) {
                    if (peerConnection.connectionState !== 'disconnected') {
                        cleanupCall();
                    }
                }
            };

            peerConnectionRef.current = peerConnection;
            return peerConnection;
        },
        [cleanupCall, socketRef],
    );

    const startCall = useCallback(
        async ({ targetUser, callType = 'video' }) => {
            if (!socketRef.current || !targetUser?.id) return;

            try {
                peerUserRef.current = targetUser;
                setCall({
                    visible: true,
                    status: 'calling',
                    callType,
                    peerUser: targetUser,
                    offer: null,
                    fromUserId: targetUser.id,
                });

                const stream = await getMediaStream(callType);
                const peerConnection = createPeerConnection(targetUser.id);
                stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);

                socketRef.current.emit('webrtc:call', {
                    targetUserId: targetUser.id,
                    callType,
                    offer,
                    caller: {
                        id: dataUser?._id,
                        username: dataUser?.fullName || dataUser?.username || 'Người dùng',
                        avatar: dataUser?.avatar,
                    },
                });
            } catch (error) {
                message.error('Không thể bắt đầu cuộc gọi. Hay kiểm tra quyền camera/micro.');
                cleanupCall();
            }
        },
        [cleanupCall, createPeerConnection, dataUser, getMediaStream, socketRef],
    );

    const acceptCall = async () => {
        if (!call.offer || !call.fromUserId) return;

        try {
            const stream = await getMediaStream(call.callType);
            const peerConnection = createPeerConnection(call.fromUserId);
            stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

            await peerConnection.setRemoteDescription(new RTCSessionDescription(call.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            socketRef.current?.emit('webrtc:answer', {
                targetUserId: call.fromUserId,
                answer,
            });

            setCall((current) => ({ ...current, status: 'active' }));
        } catch (error) {
            message.error('Không thể nhận cuộc gọi. Hay kiểm tra quyền camera/micro.');
            socketRef.current?.emit('webrtc:reject', { targetUserId: call.fromUserId });
            cleanupCall();
        }
    };

    const rejectCall = () => {
        const targetUserId = call.fromUserId || call.peerUser?.id;
        if (targetUserId) {
            socketRef.current?.emit('webrtc:reject', { targetUserId });
        }
        cleanupCall();
    };

    const endCall = () => {
        const targetUserId = call.fromUserId || call.peerUser?.id;
        if (targetUserId) {
            socketRef.current?.emit('webrtc:end', { targetUserId });
        }
        cleanupCall();
    };

    const toggleMic = () => {
        const nextValue = !isMicEnabled;
        localStreamRef.current?.getAudioTracks().forEach((track) => {
            track.enabled = nextValue;
        });
        setIsMicEnabled(nextValue);
    };

    const toggleCamera = () => {
        const nextValue = !isCameraEnabled;
        localStreamRef.current?.getVideoTracks().forEach((track) => {
            track.enabled = nextValue;
        });
        setIsCameraEnabled(nextValue);
    };

    useEffect(() => {
        const handleStartCall = (event) => startCall(event.detail);

        window.addEventListener('webrtc:start-call', handleStartCall);
        return () => window.removeEventListener('webrtc:start-call', handleStartCall);
    }, [startCall]);

    useEffect(() => {
        if (!socket) return;

        const handleIncomingCall = (payload) => {
            if (call.visible) {
                socket.emit('webrtc:reject', { targetUserId: payload.fromUserId });
                return;
            }

            const peerUser = {
                id: payload.fromUserId,
                username: payload.caller?.username || 'Nguoi dung',
                avatar: payload.caller?.avatar,
            };

            peerUserRef.current = peerUser;
            setCall({
                visible: true,
                status: 'incoming',
                callType: payload.callType || 'video',
                peerUser,
                offer: payload.offer,
                fromUserId: payload.fromUserId,
            });
        };

        const handleAnswer = async (payload) => {
            if (!peerConnectionRef.current || payload.fromUserId !== peerUserRef.current?.id) return;
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
            setCall((current) => ({ ...current, status: 'active' }));
        };

        const handleIceCandidate = async (payload) => {
            if (!peerConnectionRef.current || !payload.candidate) return;
            try {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        };

        const handleReject = () => {
            message.info('Cuộc gọi đã bị từ chối hoặc người dùng đang bận.');
            cleanupCall();
        };

        const handleEnd = () => {
            message.info('Cuộc gọi đã kết thúc.');
            cleanupCall();
        };

        const handleUnavailable = (payload) => {
            message.warning(payload.message || 'Người dùng hiện không trực tuyến');
            cleanupCall();
        };

        socket.on('webrtc:incoming-call', handleIncomingCall);
        socket.on('webrtc:answer', handleAnswer);
        socket.on('webrtc:ice-candidate', handleIceCandidate);
        socket.on('webrtc:reject', handleReject);
        socket.on('webrtc:end', handleEnd);
        socket.on('webrtc:user-unavailable', handleUnavailable);

        return () => {
            socket.off('webrtc:incoming-call', handleIncomingCall);
            socket.off('webrtc:answer', handleAnswer);
            socket.off('webrtc:ice-candidate', handleIceCandidate);
            socket.off('webrtc:reject', handleReject);
            socket.off('webrtc:end', handleEnd);
            socket.off('webrtc:user-unavailable', handleUnavailable);
        };
    }, [call.visible, cleanupCall, socket]);

    useEffect(() => cleanupCall, [cleanupCall]);

    if (!call.visible) return null;

    const isIncoming = call.status === 'incoming';
    const isVideoCall = call.callType === 'video';

    return (
        <div className={cx('overlay')}>
            <div className={cx('callBox')}>
                <div className={cx('header')}>
                    <div>
                        <span>{isIncoming ? 'Cuộc gọi đến' : call.status === 'calling' ? 'Đang gọi' : 'Đang kết nối'}</span>
                        <h3>{call.peerUser?.username || 'Người dùng'}</h3>
                    </div>
                    <button type="button" onClick={isIncoming ? rejectCall : endCall} aria-label="Đóng cuộc gọi">
                        <CloseOutlined />
                    </button>
                </div>

                <div className={cx('videoArea', { audioOnly: !isVideoCall })}>
                    {isVideoCall ? (
                        <>
                            <video ref={remoteVideoRef} autoPlay playsInline className={cx('remoteVideo')} />
                            <video ref={localVideoRef} autoPlay playsInline muted className={cx('localVideo')} />
                        </>
                    ) : (
                        <div className={cx('audioOnlyState')}>
                            <PhoneOutlined />
                            <p>{call.status === 'active' ? 'Đang gọi audio' : 'Sẵn sàng kết nối audio'}</p>
                        </div>
                    )}
                </div>

                <div className={cx('controls')}>
                    {isIncoming ? (
                        <>
                            <Button danger onClick={rejectCall}>
                                Từ chối
                            </Button>
                            <Button type="primary" icon={isVideoCall ? <VideoCameraOutlined /> : <PhoneOutlined />} onClick={acceptCall}>
                                Nhận cuộc gọi
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button icon={isMicEnabled ? <AudioOutlined /> : <AudioMutedOutlined />} onClick={toggleMic}>
                                {isMicEnabled ? 'Tắt mic' : 'Bật mic'}
                            </Button>
                            {isVideoCall && (
                                <Button icon={<VideoCameraOutlined />} onClick={toggleCamera}>
                                    {isCameraEnabled ? 'Tắt camera' : 'Bật camera'}
                                </Button>
                            )}
                            <Button danger onClick={endCall}>
                                Kết thúc
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default WebRTCCall;
