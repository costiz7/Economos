import { useEffect, useState } from 'react';
import './StatisticsContent.css';
import { useLanguage } from '../context/LanguageContext';
import { useLoading } from '../context/LoadingContext';
import Dropdown from '../Dropdown/Dropdown';
import LineChartComponent from '../ChartComponents/LineChartComponent/LineChartComponent';
import DonutChartComponent from '../ChartComponents/DonutChartComponent/DonutChartComponent';
import BarChartComponent from '../ChartComponents/BarChartComponent/BarChartComponent';
import RadialGaugeComponent from '../ChartComponents/RadialGaugeComponent/RadialGaugeComponent';
import Transaction from '../Transaction/Transaction';

// --- Separate Fetch Functions for Modularity ---

const fetchTotalsData = async (token, queryParamsStr) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/transactions/totals${queryParamsStr}`, {
        headers: { 'token': token }
    });
    if (!response.ok) throw new Error('TOTALS_ERROR');
    return await response.json();
};

const fetchAverageData = async (token, queryParamsStr) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/transactions/average${queryParamsStr}`, {
        headers: { 'token': token }
    });
    if (!response.ok) throw new Error('AVERAGE_ERROR');
    return await response.json();
};

const fetchTrendData = async (token, queryParamsStr) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/transactions/trend${queryParamsStr}`, {
        headers: { 'token': token }
    });
    if (!response.ok) throw new Error('TREND_ERROR');
    return await response.json();
};

const fetchBreakdownData = async (token, queryParamsStr) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/transactions/breakdown${queryParamsStr}`, {
        headers: { 'token': token }
    });
    if (!response.ok) throw new Error('BREAKDOWN_ERROR');
    return await response.json();
};

const fetchMomData = async (token, queryParamsStr) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/transactions/mom${queryParamsStr}`, {
        headers: { 'token': token }
    });
    if (!response.ok) throw new Error('MOM_ERROR');
    return await response.json();
};

const fetchTopData = async (token, queryParamsStr) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/transactions/top${queryParamsStr}`, {
        headers: { 'token': token }
    });
    if (!response.ok) throw new Error('TOP_ERROR');
    return await response.json();
};

const fetchGaugeData = async (token, queryParamsStr) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/budgets/status${queryParamsStr}`, {
        headers: { 'token': token }
    });
    if (!response.ok) throw new Error('GAUGE_ERROR');
    
    const budgetStatuses = await response.json();

    // Prevent crashing if response is not an array
    if (!Array.isArray(budgetStatuses) || budgetStatuses.length === 0) return 0;

    // 1. Search for the explicit General Monthly Budget
    const globalBudget = budgetStatuses.find(budget => budget.categoryId === null && budget.period === "monthly");
    
    if (globalBudget) {
        return globalBudget.percentage;
    }

    // 2. Fallback: Average percentage of exclusively monthly specific budgets
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

// --- Main Component ---

function StatisticsContent() {
    const { t, formatMoney } = useLanguage();
    const { setIsLoading } = useLoading();

    // User data state from local storage
    const [user] = useState(() => {
        const storedUser = localStorage.getItem("user");
        return storedUser ? JSON.parse(storedUser) : null;
    });

    // Fallback to RON if currency is missing
    const userCurrency = user?.currency || 'RON';

    // Temporary filter states for dropdown selections
    const [selectedFilters, setSelectedFilters] = useState({
        month: '',
        year: ''
    });

    // Active applied filters that trigger the API requests
    const [appliedFilters, setAppliedFilters] = useState({
        month: '',
        year: ''
    });

    // Centralized state to hold all analytics and statistics dataset
    const [statsData, setStatsData] = useState({
        totals: { income: 0, expense: 0, balance: 0 },
        dailyAverage: 0,
        trend: [],
        breakdown: [],
        mom: { currentExpense: 0, previousExpense: 0, percentage: 0, trend: 'flat' },
        topExpenses: [],
        budgetGaugeValue: 0
    });

    // Master function to fetch data from all statistics endpoints
    const fetchStatistics = async (filters = appliedFilters) => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            
            // Translate "Current" (empty string) to actual physical date for the backend
            const today = new Date();
            const targetYear = filters.year !== '' ? filters.year : today.getFullYear();
            const targetMonth = filters.month !== '' ? filters.month : (today.getMonth() + 1);

            const queryParams = `?year=${targetYear}&month=${targetMonth}`;

            // Execute all requests concurrently via Promise.allSettled
            const results = await Promise.allSettled([
                fetchTotalsData(token, queryParams),
                fetchAverageData(token, queryParams),
                fetchTrendData(token, queryParams),
                fetchBreakdownData(token, queryParams),
                fetchMomData(token, queryParams),
                fetchTopData(token, queryParams),
                fetchGaugeData(token, queryParams)
            ]);

            // Safely extract results and enforce data types to prevent rendering crashes
            const totalsRes = results[0].status === 'fulfilled' ? results[0].value : {};
            const averageRes = results[1].status === 'fulfilled' ? results[1].value : {};
            const trendRes = results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : [];
            const breakdownRes = results[3].status === 'fulfilled' && Array.isArray(results[3].value) ? results[3].value : [];
            const momRes = results[4].status === 'fulfilled' ? results[4].value : {};
            const topRes = results[5].status === 'fulfilled' && Array.isArray(results[5].value) ? results[5].value : [];
            const gaugeRes = results[6].status === 'fulfilled' ? results[6].value : 0;

            // Set centralized storage with fallbacks
            setStatsData({
                totals: {
                    income: totalsRes.income || 0,
                    expense: totalsRes.expense || 0,
                    balance: totalsRes.balance || 0
                },
                dailyAverage: averageRes.dailyAverage || 0,
                trend: trendRes,
                breakdown: breakdownRes,
                mom: {
                    currentExpense: momRes.currentExpense || momRes.currentMonthTotal || 0,
                    previousExpense: momRes.previousExpense || momRes.previousMonthTotal || 0,
                    trend: momRes.trend || 'flat'
                },
                topExpenses: topRes,
                budgetGaugeValue: gaugeRes
            });

        } catch (error) {
            console.error("Error aggregating statistics data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch metrics on mount
    useEffect(() => {
        fetchStatistics(appliedFilters);
    }, []);

    // Form submission handler for applying filters
    const handleApplyFilters = () => {
        setAppliedFilters(selectedFilters);
        fetchStatistics(selectedFilters);
    };

    // Custom handler to validate the Month selection rule (requires a Year first)
    const handleYearSelect = (yearId) => {
        setSelectedFilters(prev => {
            const newState = { ...prev, year: yearId };
            if (!yearId) newState.month = ''; 
            return newState;
        });
    };

    // === Dropdown Dataset Preparation ===
    const currentYear = new Date().getFullYear();
    const yearData = [
        { id: '', name: t('statistics.current') },
        ...Array.from({ length: 5 }, (_, i) => ({ id: currentYear - i, name: `${currentYear - i}` }))
    ];

    const monthData = [
        { id: '', name: t('statistics.current') },
        ...Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `${i + 1}` }))
    ];

    // === Chart Data Transformations ===
    
    // Dynamic formatter to handle both daily format and monthly format 
    // gracefully without squashing points together
    const formatTrendLabel = (item) => {
        if (item.day || item.date) {
            return `${item.day || item.date}/${item.month || ''}`;
        }
        return `${item.month || '?'}/${String(item.year || '').slice(-2)}`;
    };

    const incomeTrendData = statsData.trend.map(item => ({
        label: formatTrendLabel(item),
        value: parseFloat(item.income || item.totalAmount || 0)
    }));

    const expenseTrendData = statsData.trend.map(item => ({
        label: formatTrendLabel(item),
        value: parseFloat(item.expense || item.totalAmount || 0)
    }));

    const breakdownDonutData = statsData.breakdown.map(item => {
        const categoryLabel = item.category || item.categoryName || 'Unknown';
        return {
            label: t(`categories.${categoryLabel}`) !== `categories.${categoryLabel}` ? t(`categories.${categoryLabel}`) : categoryLabel,
            value: parseFloat(item.total || item.totalAmount || 0)
        };
    });

    const momBarData = [
        { label: t('statistics.previousMonth') || 'Prev Month', value: parseFloat(statsData.mom.previousExpense) || 0 },
        { label: t('statistics.currentMonth') || 'Current Month', value: parseFloat(statsData.mom.currentExpense) || 0 }
    ];

    return (
        <div className="statistics-content-wrapper">
            
            {/* 1. Universal Filters Section */}
            <div className="statistics-filter-card">
                <div className="statistics-card-header">
                    <h2>{t('statistics.filtersTitle') || 'Filters'}</h2>
                </div>
                <div className="statistics-filters-container">
                    <div className="filter-item">
                        <label>{t('statistics.yearLabel') || 'Year'}</label>
                        <Dropdown 
                            dataArr={yearData} 
                            width="100%" 
                            displayLabel={t('statistics.current')} 
                            onSelect={handleYearSelect} 
                            labelKey="name"
                        />
                    </div>
                    <div className="filter-item">
                        <label>{t('statistics.monthLabel') || 'Month'}</label>
                        <Dropdown 
                            dataArr={monthData} 
                            width="100%" 
                            displayLabel={t('statistics.current')} 
                            onSelect={(id) => setSelectedFilters({...selectedFilters, month: id})}
                            labelKey="name"
                            disabled={!selectedFilters.year}
                        />
                    </div>
                    <button className="apply-filters-btn" onClick={handleApplyFilters}>
                        {t('statistics.applyBtn') || 'Apply Filters'}
                    </button>
                </div>
            </div>

            {/* 2. Metrics Totals Overview Cards */}
            <div className="statistics-totals-row">
                <div className="stat-mini-card income-card">
                    <span className="stat-card-title">{t('statistics.incomeTitle') || 'Income'}</span>
                    <span className="stat-card-value" style={{ color:"var(--green-color)" }}>+{formatMoney(statsData.totals.income)} {userCurrency}</span>
                </div>
                <div className="stat-mini-card expense-card">
                    <span className="stat-card-title">{t('statistics.expenseTitle') || 'Expenses'}</span>
                    <span className="stat-card-value" style={{ color:"var(--red-color)" }}>-{formatMoney(statsData.totals.expense)} {userCurrency}</span>
                </div>
                <div className="stat-mini-card balance-card">
                    <span className="stat-card-title">{t('statistics.balanceTitle') || 'Total Balance'}</span>
                    <span className="stat-card-value">{formatMoney(statsData.totals.balance)} {userCurrency}</span>
                </div>
                <div className="stat-mini-card average-card">
                    <span className="stat-card-title">{t('statistics.dailyAverage') || 'Daily Average'}</span>
                    <span className="stat-card-value" style={{ color:"var(--orange-color)" }}>{formatMoney(statsData.dailyAverage)} {userCurrency}</span>
                </div>
            </div>

            {/* 3. Historical Trends Section (Two Independent Line Charts) */}
            <div className="statistics-charts-row">
                <div className="statistics-large-card">
                    <div className="statistics-card-header">
                        <h2>{t('statistics.incomeTrendTitle')}</h2>
                    </div>
                    <LineChartComponent 
                        data={incomeTrendData} 
                        color="var(--green-color)" 
                        gradientColor="var(--green-color)" 
                        lineThickness={7} 
                        unit={userCurrency} 
                    />
                </div>
                <div className="statistics-large-card">
                    <div className="statistics-card-header">
                        <h2>{t('statistics.expenseTrendTitle')}</h2>
                    </div>
                    <LineChartComponent 
                        data={expenseTrendData} 
                        color="var(--red-color)" 
                        gradientColor="var(--red-color)" 
                        lineThickness={7} 
                        unit={userCurrency} 
                    />
                </div>
            </div>

            {/* 4. Distribution Breakdown / MoM / Budget Gauges Sections */}
            <div className="statistics-breakdown-row">
                <div className="statistics-grid-card">
                    <div className="statistics-card-header">
                        <h2>{t('statistics.breakdownTitle') || 'Expense Breakdown'}</h2>
                    </div>
                    <DonutChartComponent data={breakdownDonutData} unit={userCurrency} />
                </div>

                <div className="statistics-grid-card">
                    <div className="statistics-card-header">
                        <h2>{t('statistics.momTitle') || 'Month over Month'}</h2>
                    </div>
                    <BarChartComponent 
                        data={momBarData} 
                        colors={statsData.mom.trend === 'up' ? ["#ef4444"] : ["var(--green-color)"]} 
                        unit={userCurrency}
                        barThickness='100px'
                        gap="60px"
                    />
                </div>

                <div className="statistics-grid-card">
                    <div className="statistics-card-header">
                        <h2>{t('statistics.budgetConsumptionTitle') || 'Budget Consumption'}</h2>
                    </div>
                    <RadialGaugeComponent 
                        targetPercentage={statsData.budgetGaugeValue} 
                        color={statsData.budgetGaugeValue >= 80 ? "var(--red-color)" : "var(--green-color)"}
                    />
                </div>
            </div>

            {/* 5. Top Biggest Transactions Subsection */}
            <div className="statistics-top-card">
                <div className="statistics-card-header">
                    <h2>{t('statistics.topExpensesTitle') || 'Top Biggest Expenses'}</h2>
                </div>
                <div className="statistics-top-list">
                    {statsData.topExpenses.length > 0 ? (
                        statsData.topExpenses.map(tx => {
                            const formattedTx = {
                                ...tx,
                                name: tx.Category?.name || tx.name,
                                iconFile: tx.Category?.iconFile || tx.iconFile,
                                type: tx.Category?.type || tx.type
                            };
                            return <Transaction key={tx.id} transaction={formattedTx} user={user} />;
                        })
                    ) : (
                        <p className="no-statistics-message">{t('statistics.noData') || 'No transactions found.'}</p>
                    )}
                </div>
            </div>

        </div>
    );
}

export default StatisticsContent;