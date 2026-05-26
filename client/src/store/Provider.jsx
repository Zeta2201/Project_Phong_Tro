import Context from './Context';
import CryptoJS from 'crypto-js';

import cookies from 'js-cookie';

import { useEffect, useState } from 'react';
import { requestAuth, requestSearch } from '../config/request';

import useDebounce from '../hooks/useDebounce';

export function Provider({ children }) {
    const [dataUser, setDataUser] = useState({});
    const [dataPayment, setDataPayment] = useState(null);
    const [dataMessages, setDataMessages] = useState([]);
    const [globalUsersMessage, setGlobalUsersMessage] = useState([]);

    const clearAuthState = () => {
        cookies.remove('logged');
        setDataUser({});
        setDataPayment(null);
        setDataMessages([]);
        setGlobalUsersMessage([]);
    };

    const fetchAuth = async () => {
        try {
            const res = await requestAuth();
            const bytes = CryptoJS.AES.decrypt(res.metadata.auth, import.meta.env.VITE_SECRET_CRYPTO);
            const originalText = bytes.toString(CryptoJS.enc.Utf8);
            const user = JSON.parse(originalText);
            setDataUser(user);
        } catch (error) {
            clearAuthState();
        }
    };

    useEffect(() => {
        const token = cookies.get('logged');

        if (!token) {
            clearAuthState();
            return;
        }

        fetchAuth();
    }, []);

    const [valueSearch, setValueSearch] = useState('');
    const debouncedSearch = useDebounce(valueSearch, 500);

    const [dataSearch, setDataSearch] = useState([]);
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await requestSearch(debouncedSearch);
                setDataSearch(res.metadata || []);
            } catch (error) {
                setDataSearch([]);
            }
        };

        fetchData();
    }, [debouncedSearch]);

    return (
        <Context.Provider
            value={{
                dataUser,
                setDataUser,
                dataPayment,
                setDataPayment,
                fetchAuth,
                clearAuthState,
                dataSearch,
                setValueSearch,
                dataMessages,
                setDataMessages,
                globalUsersMessage,
                setGlobalUsersMessage,
            }}
        >
            {children}
        </Context.Provider>
    );
}
