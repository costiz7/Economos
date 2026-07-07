import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Outlet, useLocation, Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import './MainLayout.css';
import LanguageSwitcher from "../LanguageSwitcher/LanguageSwitcher";
import ThemeSwitcher from "../ThemeSwitcher/ThemeSwitcher";
import LogoIcon from "../Icons/LogoIcon";
import DashboardIcon from "../Icons/DashboardIcon";
import TransactionsIcon from "../Icons/TransactionsIcon";
import StatisticsIcon from "../Icons/StatisticsIcon";
import SavingsIcon from "../Icons/SavingsIcon";
import BudgetsIcon from "../Icons/BudgetsIcon";
import ProfileIcon from "../Icons/ProfileIcon";
import SettingsIcon from "../Icons/SettingsIcon";
import LogoutIcon from "../Icons/LogoutIcon";

function MainLayout() {
    const location = useLocation();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [ isSidebarOpen, setIsSidebarOpen ] = useState(false);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    }

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);

            if (parsedUser.hasImportedBankData) {
                const token = localStorage.getItem('token');
                
                fetch(`${import.meta.env.VITE_API_URL}/api/transactions/dailysync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'token': token
                    }
                })
                .then(res => res.json())
                .then(data => console.log("Daily Sync Status:", data.message))
                .catch(err => console.error("Daily Sync Failed:", err));
            }
        }
    }, []);

    const getPageTitle = () => {
        switch(location.pathname) {
            case '/dashboard': return t('layout.menuDashboard');
            case '/transactions': return t('layout.menuTransactions');
            case '/savings': return t('layout.menuSavings');
            case '/settings': return t('layout.menuSettings');
            case '/statistics': return t('layout.menuStatistics');
            case '/budgets': return t('layout.menuBudgets');
            case '/myprofile': return t('layout.menuProfile');
            default: return 'EcoNomos';
        }
    };

    function logoutHandle() {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/', { replace: true });
    }

    return (
        <>
        <div className="main-layout-wrapper">
            <div className="main-layout-topbar">
                <div className="topbar-left-side">
                    <div className={`hamburger-menu ${isSidebarOpen ? 'active' : ''}`} onClick={toggleSidebar}>
                        <div className="line"></div>
                        <div className="line"></div>
                        <div className="line"></div>
                    </div>
                    <div className="universal-content">
                        <LogoIcon className="logo-icon"/>
                        <h2>/{getPageTitle().toLowerCase()}</h2>
                    </div>
                </div>
                <div className="topbar-right-side">
                    <ThemeSwitcher className="themeBtn"/>
                    <LanguageSwitcher />
                    <button onClick={logoutHandle} className="logoutBtn">
                        <LogoutIcon className="logout-icon" />
                    </button>
                    
                </div>
            </div>
            <div className="main-layout">
                <div className={`main-layout-sidebar ${isSidebarOpen ? 'open' : ''}`}>
                    {/* Links */}
                    {<Link to="/dashboard" onClick={toggleSidebar}>
                        <DashboardIcon className="sidebar-icons" style={{ color: "var(--blue-color)" }}/>{t('layout.menuDashboard')}
                    </Link>}
                    {<Link to="/transactions" onClick={toggleSidebar}>
                        <TransactionsIcon className="sidebar-icons" style={{ color: "var(--green-color)" }}/>{t('layout.menuTransactions')}
                    </Link>}
                    {<Link to="/statistics" onClick={toggleSidebar}>
                        <StatisticsIcon className="sidebar-icons" style={{ color: "var(--dark-yellow-color)" }}/>{t('layout.menuStatistics')}
                    </Link>}
                    {<Link to="/savings" onClick={toggleSidebar}>
                        <SavingsIcon className="sidebar-icons" style={{ color: "var(--light-red-color)" }}/>{t('layout.menuSavings')}
                    </Link>}
                    {<Link to="/budgets" onClick={toggleSidebar}>
                        <BudgetsIcon className="sidebar-icons" style={{ color: "var(--dark-green-color)" }}/>{t('layout.menuBudgets')}
                    </Link>}
                    {<Link to="/settings" onClick={toggleSidebar}>
                        <SettingsIcon className="sidebar-icons" style={{ color: "var(--black-color)" }}/>{t('layout.menuSettings')}
                    </Link>}
                </div>
                
                <div className="main-layout-content">
                    <Outlet />
                </div>
            </div>
        </div>

        {/* OVERLAY MUTAT COMPLET ÎN AFARA STRUCTURII FLEXBOX */}
        {isSidebarOpen && (
            <div className="sidebar-overlay" onClick={toggleSidebar}></div>
        )}
        </>
    );
}

export default MainLayout;