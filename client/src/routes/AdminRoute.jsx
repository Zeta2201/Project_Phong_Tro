import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { requestGetAdmin } from '../config/request';

function AdminRoute({ children }) {
    const location = useLocation();
    const [status, setStatus] = useState('checking');

    useEffect(() => {
        let mounted = true;

        const verifyAdmin = async () => {
            try {
                await requestGetAdmin();
                if (mounted) setStatus('allowed');
            } catch {
                if (mounted) setStatus('denied');
            }
        };

        verifyAdmin();

        return () => {
            mounted = false;
        };
    }, []);

    if (status === 'checking') {
        return (
            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f5f7fa',
                }}
            >
                <Spin size="large" tip="Dang kiem tra quyen admin..." />
            </div>
        );
    }

    if (status === 'denied') {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return children;
}

export default AdminRoute;
