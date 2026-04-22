/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, useRoutes } from 'react-router-dom';
import { publicRoutes } from './routes/index.jsx';

import { Provider } from './store/Provider';
import SocketProvider from './socket/SocketProvider.jsx';

const AppRoutes = () => {
    return useRoutes(publicRoutes);
};

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <Router>
            <Provider>
                <SocketProvider>
                    <AppRoutes />
                </SocketProvider>
            </Provider>
        </Router>
    </StrictMode>,
);
