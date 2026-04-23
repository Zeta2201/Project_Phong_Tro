/* eslint-disable react-refresh/only-export-components */
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, useRoutes } from 'react-router-dom';
import { publicRoutes } from './routes/index.jsx';

import { Provider } from './store/Provider';
import SocketProvider from './socket/SocketProvider.jsx';

const AppRoutes = () => {
    return useRoutes(publicRoutes);
};

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error("Root element '#root' was not found.");
}

createRoot(rootElement).render(
    <Router>
        <Provider>
            <SocketProvider>
                <AppRoutes />
            </SocketProvider>
        </Provider>
    </Router>,
);
