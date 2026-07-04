import { useEffect, useState } from 'react';
import './TransactionsContent.css';
import { useLanguage } from '../context/LanguageContext';
import { useLoading } from '../context/LoadingContext';
import Dropdown from '../Dropdown/Dropdown';
import Transaction from '../Transaction/Transaction';

function TransactionsContent() {
    const { t } = useLanguage();
    const { setIsLoading } = useLoading();

    // Retrieve and parse the user object from local storage
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem("user");
        return storedUser ? JSON.parse(storedUser) : null;
    });

    // State for storing the list of transactions and available categories
    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    
    // State for managing pagination data returned from the API
    const [pagination, setPagination] = useState({
        totalItems: 0,
        totalPages: 1,
        currentPage: 1,
        itemsPerPage: 20
    });

    // Temporary filters selected by the user in the UI (not yet applied)
    const [selectedFilters, setSelectedFilters] = useState({
        categoryId: '',
        type: '',
        month: '',
        year: ''
    });

    // Filters that are actually sent to the API when "Apply Filters" is clicked
    const [appliedFilters, setAppliedFilters] = useState({
        categoryId: '',
        type: '',
        month: '',
        year: ''
    });

    // Fetch categories on component mount to populate the Category dropdown
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${import.meta.env.VITE_API_URL}/api/categories`, {
                    headers: { 'token': token }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    setCategories(data);
                }
            } catch (error) {
                console.error("Failed to fetch categories:", error);
            }
        };
        fetchCategories();
    }, []);

    // Main function to fetch transactions based on pagination and applied filters
    const fetchTransactions = async (page = 1, filters = appliedFilters) => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            
            // Build the query string dynamically based on active filters
            let queryUrl = `?page=${page}&limit=20`;
            if (filters.categoryId) queryUrl += `&categoryId=${filters.categoryId}`;
            if (filters.type) queryUrl += `&type=${filters.type}`;
            if (filters.month) queryUrl += `&month=${filters.month}`;
            if (filters.year) queryUrl += `&year=${filters.year}`;

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/transactions${queryUrl}`, {
                headers: { 'token': token }
            });

            if (response.ok) {
                const data = await response.json();
                
                // Flatten the nested Category object from Sequelize so the Transaction component can read it easily
                const formattedTransactions = data.transactions.map(obj => ({
                    id: obj.id,
                    amount: obj.amount,
                    date: obj.date,
                    title: obj.title,
                    description: obj.description,
                    source: obj.source,
                    name: obj.Category?.name,
                    iconFile: obj.Category?.iconFile,
                    type: obj.Category?.type
                }));

                // Update state with the fetched data
                setTransactions(formattedTransactions);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error("Error fetching transactions:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Initial fetch when the component mounts
    useEffect(() => {
        fetchTransactions(1, appliedFilters);
    }, []);

    // Handler for the "Apply Filters" button
    const handleApplyFilters = () => {
        setAppliedFilters(selectedFilters);
        // Always reset to the first page when applying new filters
        fetchTransactions(1, selectedFilters);
    };

    // Handler for pagination buttons
    const handlePageChange = (newPage) => {
        // Ensure the new page is within valid bounds
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchTransactions(newPage, appliedFilters);
        }
    };

    // Custom handler for Year selection to handle Month validation
    const handleYearSelect = (yearId) => {
        setSelectedFilters(prev => {
            const newState = { ...prev, year: yearId };
            // If the user clears the year, we must automatically clear the month as well
            if (!yearId) {
                newState.month = '';
            }
            return newState;
        });
    };

    // === Data Preparation for Dropdowns ===

    const typeData = [
        { id: '', name: t('transactions.all') || 'All' },
        { id: 'income', name: t('transactions.income') || 'Income' },
        { id: 'expense', name: t('transactions.expense') || 'Expense' }
    ];

    const categoryData = [
        { id: '', name: t('transactions.all') || 'All' },
        ...categories.map(cat => ({
            id: cat.id, 
            name: t(`categories.${cat.name}`) !== `categories.${cat.name}` ? t(`categories.${cat.name}`) : cat.name
        }))
    ];

    const currentYear = new Date().getFullYear();
    const yearData = [
        { id: '', name: t('transactions.all') || 'All' },
        ...Array.from({ length: 5 }, (_, i) => ({ id: currentYear - i, name: `${currentYear - i}` }))
    ];

    // Standard month generation. The disabling logic is handled on the Dropdown component level now.
    const monthData = [
        { id: '', name: t('transactions.all') || 'All' },
        ...Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `${i + 1}` }))
    ];

    // === Pagination Logic ===
    const generatePaginationNumbers = () => {
        const { currentPage, totalPages } = pagination;
        const current = Number(currentPage);
        const last = Number(totalPages);
        const delta = 1; 
        const left = current - delta;
        const right = current + delta;
        const range = [];
        const rangeWithDots = [];
        let l;

        for (let i = 1; i <= last; i++) {
            if (i === 1 || i === last || (i >= left && i <= right)) {
                range.push(i);
            }
        }

        for (let i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l !== 1) {
                    rangeWithDots.push('...');
                }
            }
            rangeWithDots.push(i);
            l = i;
        }

        return rangeWithDots;
    };

    return (
        <div className="transactions-content-wrapper">
            <div className="transactions-header">
                <h2>{t('transactions.pageTitle')}</h2>
                <button className="transactions-header-btn" onClick={() => openModal('ADD')}>
                    {t('transactions.addBtn')}
                </button>
            </div>
            
            {/* Filters Section */}
            <div className="transactions-filter-card">
                <div className="transactions-card-header">
                    <h2>{t('transactions.filtersTitle') || 'Filters'}</h2>
                </div>
                
                <div className="transactions-filters-container">
                    <div className="filter-item">
                        <label>{t('transactions.typeLabel') || 'Type'}</label>
                        <Dropdown 
                            dataArr={typeData} 
                            width="100%" 
                            displayLabel={t('transactions.all') || 'All'} 
                            onSelect={(id) => setSelectedFilters({...selectedFilters, type: id})}
                            labelKey="name"
                        />
                    </div>
                    
                    <div className="filter-item">
                        <label>{t('transactions.categoryLabel') || 'Category'}</label>
                        <Dropdown 
                            dataArr={categoryData} 
                            width="100%" 
                            displayLabel={t('transactions.all') || 'All'} 
                            onSelect={(id) => setSelectedFilters({...selectedFilters, categoryId: id})}
                            labelKey="name"
                        />
                    </div>

                    <div className="filter-item">
                        <label>{t('transactions.yearLabel') || 'Year'}</label>
                        <Dropdown 
                            dataArr={yearData} 
                            width="100%" 
                            displayLabel={t('transactions.all') || 'All'} 
                            onSelect={handleYearSelect} 
                            labelKey="name"
                        />
                    </div>

                    <div className="filter-item">
                        <label>{t('transactions.monthLabel') || 'Month'}</label>
                        <Dropdown 
                            dataArr={monthData} 
                            width="100%" 
                            displayLabel={t('transactions.all') || 'All'} 
                            onSelect={(id) => setSelectedFilters({...selectedFilters, month: id})}
                            labelKey="name"
                            disabled={!selectedFilters.year} // Disables the dropdown if no year is selected
                        />
                    </div>

                    <button className="apply-filters-btn" onClick={handleApplyFilters}>
                        {t('transactions.applyBtn') || 'Apply Filters'}
                    </button>
                </div>
            </div>

            {/* Transactions List Section */}
            <div className="transactions-list-card">
                <div className="transactions-card-header">
                    <h2>{t('transactions.listTitle') || 'Transactions'}</h2>
                </div>
                
                <div className="transactions-list">
                    {transactions.length > 0 ? (
                        transactions.map(transaction => (
                            <Transaction 
                                key={transaction.id} 
                                transaction={transaction} 
                                user={user}
                            />
                        ))
                    ) : (
                        <p className="no-transactions-message">
                            {t('transactions.noData') || 'No transactions found.'}
                        </p>
                    )}
                </div>

                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                    <div className="pagination-container">
                        <button 
                            className="pagination-btn"
                            disabled={pagination.currentPage === 1}
                            onClick={() => handlePageChange(pagination.currentPage - 1)}
                        >
                            {t('transactions.prevBtn') || 'Previous'}
                        </button>

                        {generatePaginationNumbers().map((pageNumber, index) => {
                            if (pageNumber === '...') {
                                return <span key={index} className="pagination-dots">...</span>;
                            }
                            return (
                                <button 
                                    key={index}
                                    className={`pagination-btn ${pagination.currentPage === pageNumber ? 'active' : ''}`}
                                    onClick={() => handlePageChange(pageNumber)}
                                >
                                    {pageNumber}
                                </button>
                            );
                        })}

                        <button 
                            className="pagination-btn"
                            disabled={pagination.currentPage === pagination.totalPages}
                            onClick={() => handlePageChange(pagination.currentPage + 1)}
                        >
                            {t('transactions.nextBtn') || 'Next'}
                        </button>
                    </div>
                )}
            </div>

        </div>
    );
}

export default TransactionsContent;