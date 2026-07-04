import { useEffect, useState } from 'react';
import './TransactionsContent.css';
import { useLanguage } from '../context/LanguageContext';
import { useLoading } from '../context/LoadingContext';
import Dropdown from '../Dropdown/Dropdown';
import Transaction from '../Transaction/Transaction';

function TransactionsContent() {
    const { t } = useLanguage();
    const { setIsLoading } = useLoading();

    // Stocarea datelor globale
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem("user");
        return storedUser ? JSON.parse(storedUser) : null;
    });

    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    
    // Paginare și Filtrare
    const [pagination, setPagination] = useState({
        totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 20
    });

    const [selectedFilters, setSelectedFilters] = useState({
        categoryId: '', type: '', month: '', year: ''
    });

    const [appliedFilters, setAppliedFilters] = useState({
        categoryId: '', type: '', month: '', year: ''
    });

    // ==========================================
    // STĂRI PENTRU MODALUL DE ADĂUGARE MANUALĂ
    // ==========================================
    const [activeModal, setActiveModal] = useState(null); 
    const [isClosing, setIsClosing] = useState(false);
    const [modalError, setModalError] = useState("");

    // Câmpurile formularului
    const [modalType, setModalType] = useState("expense");
    const [modalCategory, setModalCategory] = useState("");
    const [title, setTitle] = useState("");
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState("");
    const [description, setDescription] = useState("");

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

    const fetchTransactions = async (page = 1, filters = appliedFilters) => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            
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

                setTransactions(formattedTransactions);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error("Error fetching transactions:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions(1, appliedFilters);
    }, []);

    const handleApplyFilters = () => {
        setAppliedFilters(selectedFilters);
        fetchTransactions(1, selectedFilters);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchTransactions(newPage, appliedFilters);
        }
    };

    const handleYearSelect = (yearId) => {
        setSelectedFilters(prev => {
            const newState = { ...prev, year: yearId };
            if (!yearId) newState.month = '';
            return newState;
        });
    };

    // ==========================================
    // LOGICA PENTRU MODAL ȘI TRANZACȚIE MANUALĂ
    // ==========================================
    const openModal = () => {
        setIsClosing(false);
        setModalError("");
        
        setTitle("");
        setAmount("");
        setDescription("");
        setModalType("expense");
        setModalCategory("");
        setDate(new Date().toISOString().split('T')[0]); 
        
        setActiveModal('ADD');
    };

    const closeModal = () => {
        setIsClosing(true);
        setTimeout(() => {
            setActiveModal(null);
            setIsClosing(false);
            setModalError("");
        }, 400); 
    };

    const handleAddTransaction = async () => {
        setModalError("");

        if (!title.trim()) return setModalError(t('errors.MISSING_TITLE'));
        if (!modalCategory) return setModalError(t('errors.MISSING_CATEGORY'));
        
        const parsedAmount = parseFloat(String(amount).replace(',', '.'));
        if (!parsedAmount || parsedAmount <= 0) return setModalError(t('errors.INVALID_AMOUNT'));

        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                title: title.trim(),
                amount: parsedAmount,
                categoryId: modalCategory,
                date: date || new Date().toISOString().split('T')[0],
                description: description.trim() || null
            };

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'token': token },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                closeModal();
                fetchTransactions(1, appliedFilters);
            } else {
                setModalError(t(`errors.${data.errorCode}`));
            }
        } catch (error) {
            setModalError(t('errors.SERVER_ERROR'));
        } finally {
            setIsLoading(false);
        }
    };

    // ==========================================
    // DATE PENTRU DROPDOWN-URI
    // ==========================================
    const typeData = [
        { id: '', name: t('transactions.all') },
        { id: 'income', name: t('transactions.income') },
        { id: 'expense', name: t('transactions.expense') }
    ];

    const categoryData = [
        { id: '', name: t('transactions.all') },
        ...categories.map(cat => ({
            id: cat.id, 
            name: t(`categories.${cat.name}`) !== `categories.${cat.name}` ? t(`categories.${cat.name}`) : cat.name
        }))
    ];

    const filteredModalCategories = categories.filter(c => c.type === modalType);
    const modalCategoryData = [
        { id: '', name: t('transactions.selectCategory') },
        ...filteredModalCategories.map(cat => ({
            id: cat.id,
            name: t(`categories.${cat.name}`) !== `categories.${cat.name}` ? t(`categories.${cat.name}`) : cat.name
        }))
    ];

    const currentYear = new Date().getFullYear();
    const yearData = [
        { id: '', name: t('transactions.all') },
        ...Array.from({ length: 5 }, (_, i) => ({ id: currentYear - i, name: `${currentYear - i}` }))
    ];

    const monthData = [
        { id: '', name: t('transactions.all') },
        ...Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `${i + 1}` }))
    ];

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
                <button className="transactions-header-btn" onClick={openModal}>
                    {t('transactions.addBtn')}
                </button>
            </div>
            
            <div className="transactions-filter-card">
                <div className="transactions-card-header">
                    <h2>{t('transactions.filtersTitle')}</h2>
                </div>
                
                <div className="transactions-filters-container">
                    <div className="filter-item">
                        <label>{t('transactions.typeLabel')}</label>
                        <Dropdown 
                            dataArr={typeData} 
                            width="100%" 
                            displayLabel={t('transactions.all')} 
                            onSelect={(id) => setSelectedFilters({...selectedFilters, type: id})}
                            labelKey="name"
                        />
                    </div>
                    
                    <div className="filter-item">
                        <label>{t('transactions.categoryLabel')}</label>
                        <Dropdown 
                            dataArr={categoryData} 
                            width="100%" 
                            displayLabel={t('transactions.all')} 
                            onSelect={(id) => setSelectedFilters({...selectedFilters, categoryId: id})}
                            labelKey="name"
                        />
                    </div>

                    <div className="filter-item">
                        <label>{t('transactions.yearLabel')}</label>
                        <Dropdown 
                            dataArr={yearData} 
                            width="100%" 
                            displayLabel={t('transactions.all')} 
                            onSelect={handleYearSelect} 
                            labelKey="name"
                        />
                    </div>

                    <div className="filter-item">
                        <label>{t('transactions.monthLabel')}</label>
                        <Dropdown 
                            dataArr={monthData} 
                            width="100%" 
                            displayLabel={t('transactions.all')} 
                            onSelect={(id) => setSelectedFilters({...selectedFilters, month: id})}
                            labelKey="name"
                            disabled={!selectedFilters.year} 
                        />
                    </div>

                    <button className="apply-filters-btn" onClick={handleApplyFilters}>
                        {t('transactions.applyBtn')}
                    </button>
                </div>
            </div>

            <div className="transactions-list-card">
                <div className="transactions-card-header">
                    <h2>{t('transactions.listTitle')}</h2>
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
                            {t('transactions.noData')}
                        </p>
                    )}
                </div>

                {pagination.totalPages > 1 && (
                    <div className="pagination-container">
                        <button 
                            className="pagination-btn"
                            disabled={pagination.currentPage === 1}
                            onClick={() => handlePageChange(pagination.currentPage - 1)}
                        >
                            {t('transactions.prevBtn')}
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
                            {t('transactions.nextBtn')}
                        </button>
                    </div>
                )}
            </div>

            {activeModal === 'ADD' && (
                <div className={`transactions-modal-overlay ${isClosing ? 'closing' : ''}`}>
                    <div className="transactions-modal-card">
                        <h3>{t('transactions.addModalTitle')}</h3>
                        
                        {modalError && <div className="transactions-modal-error">{modalError}</div>}

                        <div className="transactions-dropdowns-row">
                            <div className="transactions-form-group transactions-z-index-high no-margin-bottom">
                                <label className="modal-dropdown-label">{t('transactions.typeLabel')}</label>
                                <Dropdown 
                                    dataArr={[
                                        { id: 'expense', name: t('transactions.expense') },
                                        { id: 'income', name: t('transactions.income') }
                                    ]}
                                    width="100%"
                                    height="50px"
                                    displayLabel={modalType === 'income' ? t('transactions.income') : t('transactions.expense')}
                                    onSelect={(id) => { setModalType(id); setModalCategory(''); }} 
                                    labelKey="name"
                                />
                            </div>

                            <div className="transactions-form-group transactions-z-index-medium no-margin-bottom">
                                <label className="modal-dropdown-label">{t('transactions.categoryLabel')}</label>
                                <Dropdown 
                                    dataArr={modalCategoryData}
                                    width="100%"
                                    height="50px"
                                    displayLabel={modalCategoryData.find(c => c.id === modalCategory)?.name || t('transactions.selectCategory')}
                                    onSelect={(id) => setModalCategory(id)}
                                    labelKey="name"
                                />
                            </div>
                        </div>

                        <div className="transactions-form-group">
                            <div className="transactions-form-input">
                                <input type="text" 
                                        id="txTitle" 
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder=' ' />
                                <label htmlFor="txTitle">{t('transactions.titleLabel')}</label>
                            </div>
                        </div>

                        <div className="transactions-form-group">
                            <div className="transactions-form-input">
                                <input type="text" 
                                        inputMode="decimal"
                                        id="txAmount" 
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder=' ' />
                                <label htmlFor="txAmount">{t('transactions.amountLabel')}</label>
                            </div>
                        </div>

                        <div className="transactions-form-group">
                            <div className="transactions-form-input label-always-floating">
                                <input type="date" 
                                        id="txDate" 
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        placeholder=' ' />
                                <label htmlFor="txDate">{t('transactions.dateLabel')}</label>
                            </div>
                        </div>

                        <div className="transactions-form-group">
                            <div className="transactions-form-input">
                                <input type="text" 
                                        id="txDesc" 
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder=' ' />
                                <label htmlFor="txDesc">{t('transactions.descLabel')}</label>
                            </div>
                        </div>

                        <div className="transactions-modal-actions">
                            <button className="transactions-modal-btn" onClick={closeModal}>{t('budgets.modalNo')}</button>
                            <button className="transactions-modal-btn primary" onClick={handleAddTransaction}>{t('budgets.saveBtn')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TransactionsContent;