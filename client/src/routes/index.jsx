import App from '../App';
import DetailPost from '../Pages/DetailPost/DetailPost';
import LoginUser from '../Pages/LoginUser/LoginUser';
import RegisterUser from '../Pages/RegisterUser/RegisterUser';
import Admin from '../Pages/Admin/Index';
import InfoUser from '../Pages/InfoUser/InfoUser';
import ForgotPassword from '../Pages/ForgotPassword/ForgotPassword';
import AISearch from '../Pages/AISearch/AISearch';
import Contact from '../Pages/Contact/Contact';
import Layout from '../Components/Layout/Layout';
import HomePage from '../Components/HomePage/HomePage';
import Terms from '../Pages/Terms/Terms';
import FavouritePosts from '../Pages/FavouritePosts/FavouritePosts';

export const publicRoutes = [
    {
        path: '/',
        element: <Layout />,
        children: [
            { path: '', element: <HomePage /> },
            { path: 'chi-tiet-tin-dang/:id', element: <DetailPost /> },
            { path: 'trang-ca-nhan', element: <InfoUser /> },
            { path: 'search', element: <HomePage /> },
            { path: 'search/:value', element: <AISearch /> },
            { path: 'contact', element: <Contact /> },
            { path: 'terms', element: <Terms /> },
            { path: 'tin-yeu-thich', element: <FavouritePosts /> },
        ],
    },
    { path: '/login', element: <LoginUser /> },
    { path: '/register', element: <RegisterUser /> },
    { path: '/admin', element: <Admin /> },
    { path: '/forgot-password', element: <ForgotPassword /> },
];
