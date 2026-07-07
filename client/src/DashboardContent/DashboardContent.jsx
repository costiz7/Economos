import { useEffect, useState } from 'react';
import './DashboardContent.css';
import DonutChartComponent from '../ChartComponents/DonutChartComponent/DonutChartComponent';
import RadialGaugeComponent from '../ChartComponents/RadialGaugeComponent/RadialGaugeComponent';
import { useLanguage } from '../context/LanguageContext';
import { useLoading } from '../context/LoadingContext';
import Transaction from '../Transaction/Transaction';

const fetchRecentTransactions = async(token) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/transactions/recent`, {
        headers: { 'token' : token }
    });
    if(!response.ok) {
        throw new Error("RECENT_TRANSACTIONS_ERROR");
    }
    const data = await response.json();

    return data.reduce((acc, obj) => {
        acc.push({
            id: obj.id,
            amount: obj.amount,
            date: obj.date,
            title: obj.title,
            description: obj.description,
            source: obj.source,
            name: obj.Category?.name,
            iconFile: obj.Category?.iconFile,
            type: obj.Category?.type
        });
        return acc;
    }, []);
}

const fetchDonutData = async (token, t) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/transactions/breakdown`, {
        headers: { 'token': token }
    });
    if(!response.ok) {
        throw new Error("DONUT_ERROR");
    }
    const data = await response.json();

    return data.map(item => ({
        label: t(`categories.${item.category}`) !== `categories.${item.category}` 
                ? t(`categories.${item.category}`) 
                : item.category,
        value: item.total
    }));
}

const fetchGlobalBalance = async (token) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/transactions/global-balance`, {
        headers: { 'token': token }
    });
    if (!response.ok) throw new Error("GLOBAL_BALANCE_ERROR");
    return await response.json();
};

const fetchGaugeData = async (token) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/budgets/status`, {
        headers: { 'token': token }
    });
    if (!response.ok) throw new Error("GAUGE_ERROR");
    const budgetStatuses = await response.json();

    if (!budgetStatuses || budgetStatuses.length === 0) return 0;

    const globalBudget = budgetStatuses.find(budget => budget.categoryId === null && budget.period === "monthly");

    if(globalBudget) {
        return globalBudget.percentage;
    }

    let totalLimit = 0;
    let totalSpent = 0;

    const monthlyBudgets = budgetStatuses.filter(budget => budget.period === "monthly");

    monthlyBudgets.forEach(budget => {
        totalLimit += parseFloat(budget.limit) || 0;
        totalSpent += parseFloat(budget.spent) || 0;
    });

    if (totalLimit === 0) return 0;

    let percentage = (totalSpent / totalLimit) * 100;

    return Math.round(percentage * 100) / 100;
};

function DashboardContent() {
    const { t, formatMoney } = useLanguage();
    const { setIsLoading } = useLoading();
    
    const [user] = useState(() => {
        const storedUser = localStorage.getItem("user");
        return storedUser ? JSON.parse(storedUser) : null;
    });

    const [dashboardData, setDashboardData] = useState({
        donut: [],
        balance: { availableBalance: 0 },
        gauge: 0,
        recent: []
    });

    useEffect(() => {
        const loadDashboardData = async () => {
            setIsLoading(true);
            const token = localStorage.getItem("token"); 

            if (!token) {
                console.error("Missing authentication token!");
                setIsLoading(false);
                return;
            }

            try {
                const results = await Promise.allSettled([
                    fetchDonutData(token, t),
                    fetchGlobalBalance(token),
                    fetchGaugeData(token),
                    fetchRecentTransactions(token)
                ]);

                setDashboardData({
                    donut: results[0].status === 'fulfilled' ? results[0].value : [],
                    balance: results[1].status === 'fulfilled' ? results[1].value : { availableBalance: 0 },
                    gauge: results[2].status === 'fulfilled' ? results[2].value : 0,
                    recent: results[3].status === 'fulfilled' ? results[3].value : []
                });
            } catch (error) {
                console.error("Error loading dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadDashboardData();
    }, [setIsLoading, t]);

    return (
        <div className="dashboard-content-wrapper">
            <div className="welcome-message">
                <h1>{t('dashboard.welcome')}, {user ? user.username : ""}</h1>
            </div>
            
            <div className="dashboard-content-upper-section">
                
                <div id="dashboard-upper-firstcard" className="dashboard-upper-card">
                    <div className="dashboard-upper-card-header">
                        <h2>{t('dashboard.distributionTitle')}</h2>
                    </div>
                    <DonutChartComponent data={dashboardData.donut} size="250px"/>
                </div>
                
                <div id="dashboard-upper-secondcard" className="dashboard-upper-card">
                    <div className="dashboard-upper-card-header">
                        <h2>{t('dashboard.balanceTitle') || 'Available Balance'}</h2>
                    </div>
                    
                    <div className="dashboard-balance-content standalone">
                        <span className="dashboard-balance-amount">
                            {formatMoney(dashboardData.balance.availableBalance)} {user?.currency || 'RON'}
                        </span>
                    </div>
                </div>
                
                <div id="dashboard-upper-thirdcard" className="dashboard-upper-card">
                    <div className="dashboard-upper-card-header">
                        <h2>{t('dashboard.budgetConsumptionTitle')}</h2>
                    </div>
                    <RadialGaugeComponent 
                        targetPercentage={dashboardData.gauge} 
                        color={dashboardData.gauge >= 80 ? "var(--red-color)" : "var(--green-color)"}
                    />
                </div>

            </div>
            
            <div className="dashboard-content-lower-section">
                <div id="dashboard-lower-firstcard" className="dashboard-lower-card">
                    <div className="dashboard-lower-card-header">
                        <h2>{t('dashboard.recentTitle')}</h2>
                    </div>
                    <div className="dashboard-recent-transactions-list">
                        {
                            dashboardData.recent.length > 0 ? dashboardData.recent.map(transaction => (
                                <Transaction key={transaction.id} transaction={transaction} user={user}/>
                            )) 
                            : 
                            <p className='no-data'>{t('errors.NO_DATA')}</p>
                        }
                    </div>
                    
                </div>
            </div>
        </div>
    );
}

export default DashboardContent;