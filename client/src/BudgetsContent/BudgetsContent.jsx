import React, { useState, useEffect } from 'react';
import './BudgetsContent.css';
import { useLanguage } from '../context/LanguageContext';
import { useLoading } from '../context/LoadingContext';
import Budget from '../Budget/Budget';
import Dropdown from '../Dropdown/Dropdown';

function BudgetsContent() {
    const { t } = useLanguage();
    const { setIsLoading } = useLoading();

    //Global data states
    const [user] = useState(() => JSON.parse(localStorage.getItem("user")));
    const [budgets, setBudgets] = useState([]);
    const [categories, setCategories] = useState([]);

    //Modal states
    const [activeModal, setActiveModal] = useState(null); 
    const [isClosing, setIsClosing] = useState(false);
    const [modalError, setModalError] = useState("");

    //Form states in modal
    const [selectedCategory, setSelectedCategory] = useState(null); 
    const [selectedPeriod, setSelectedPeriod] = useState("monthly");
    const [budgetAmount, setBudgetAmount] = useState("");
    const [selectedBudget, setSelectedBudget] = useState(null);

    //Fetching budgets and categories lists
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const token = localStorage.getItem('token');

                const [budgetsResObj, categoriesResObj] = await Promise.allSettled([
                    fetch(`${import.meta.env.VITE_API_URL}/api/budgets/status`, { headers: { 'token': token } }),
                    fetch(`${import.meta.env.VITE_API_URL}/api/categories`, { headers: { 'token': token } })
                ]);

                if (budgetsResObj.status === 'fulfilled' && budgetsResObj.value.ok) {
                    setBudgets(await budgetsResObj.value.json());
                }

                if (categoriesResObj.status === 'fulfilled' && categoriesResObj.value.ok) {
                    const data = await categoriesResObj.value.json();
                    setCategories(data.filter(c => c.type === 'expense'));
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [setIsLoading]);

    //Function for when opening a modal
    const openModal = (modalId, budget = null) => {
        setIsClosing(false);
        setModalError("");
        setSelectedBudget(budget);
        
        if (budget && (modalId === 'MODIFY')) {
            setSelectedCategory(budget.categoryId);
            setSelectedPeriod(budget.period || "monthly");
            setBudgetAmount(budget.limit || "");
        } else {
            setSelectedCategory(null);
            setSelectedPeriod("monthly");
            setBudgetAmount("");
        }
        setActiveModal(modalId);
    };

    const closeModal = () => {
        setIsClosing(true);
        setTimeout(() => {
            setActiveModal(null);
            setIsClosing(false);
            setModalError("");
            setSelectedBudget(null);
        }, 400); 
    };

    const handleSaveBudget = async () => {
        setModalError("");
        
        // 1. Translated frontend validation
        if (!budgetAmount || budgetAmount <= 0) {
            return setModalError(t('budgets.error_AMOUNT_GREATER_THAN_ZERO'));
        }

        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                amount: budgetAmount,
                period: selectedPeriod,
                categoryId: selectedCategory
            };

            const url = activeModal === 'MODIFY' 
                ? `${import.meta.env.VITE_API_URL}/api/budgets/${selectedBudget.budgetId}`
                : `${import.meta.env.VITE_API_URL}/api/budgets`;

            const method = activeModal === 'MODIFY' ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'token': token },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                const refreshRes = await fetch(`${import.meta.env.VITE_API_URL}/api/budgets/status`, { headers: { 'token': token } });
                if (refreshRes.ok) setBudgets(await refreshRes.json());
                closeModal();
            } else {
                // 2. Translated backend errors with a translated fallback
                if (data.errorCode) {
                    setModalError(t(`budgets.error_${data.errorCode}`));
                } else {
                    setModalError(t('budgets.error_SERVER_ERROR'));
                }
            }
        } catch (error) {
            // 3. Translated network error
            setModalError(t('budgets.error_CONNECTION_FAILED'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteBudget = async () => {
        if (!selectedBudget) return;
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/budgets/${selectedBudget.budgetId}`, {
                method: 'DELETE',
                headers: { 'token': token }
            });

            if (response.ok) {
                setBudgets(budgets.filter(b => b.budgetId !== selectedBudget.budgetId));
                closeModal();
            } else {
                const data = await response.json();
                if (data.errorCode) {
                    setModalError(t(`budgets.error_${data.errorCode}`));
                } else {
                    setModalError(t('budgets.error_SERVER_ERROR'));
                }
            }
        } catch (error) {
            setModalError(t('budgets.error_CONNECTION_FAILED'));
        } finally {
            setIsLoading(false);
        }
    };

    const sortedBudgets = [...budgets].sort((a, b) => {
        if (a.categoryId === null && b.categoryId !== null) return -1;
        if (a.categoryId !== null && b.categoryId === null) return 1;
        return 0; 
    });

    const categoriesDropdownData = [
        { id: 'general', label: t('budgets.selectCategory') },
        ...categories.map(cat => ({
            id: cat.id,
            label: t(`categories.${cat.name}`) !== `categories.${cat.name}` ? t(`categories.${cat.name}`) : cat.name
        }))
    ];

    const periodsDropdownData = [
        { id: 'monthly', label: t('budgets.period.monthly') },
        { id: 'weekly', label: t('budgets.period.weekly') },
        { id: 'yearly', label: t('budgets.period.yearly') }
    ];

    return (
        <div className="budgets-content-wrapper">
            <div className="budgets-header">
                <h2>{t('budgets.pageTitle')}</h2>
                <button className="budgets-header-btn" onClick={() => openModal('ADD')}>
                    {t('budgets.addBtn')}
                </button>
            </div>

            <div className="budgets-page-list">
                {sortedBudgets.map(budget => (
                    <Budget 
                        key={budget.budgetId} 
                        budget={budget} 
                        user={user} 
                        onOpenModifyModal={(b) => openModal('MODIFY', b)}
                        onOpenDeleteModal={(b) => openModal('DELETE', b)}
                    />
                ))}
            </div>

            {activeModal && (
                <div className={`budget-page-modal-overlay ${isClosing ? 'budget-page-modal-closing' : ''}`}>
                    <div className="budget-page-modal-card">
                        
                        {(activeModal === 'ADD' || activeModal === 'MODIFY') && (
                            <>
                                <h3>{activeModal === 'ADD' ? t('budgets.modalAddTitle') : t('budgets.modalModifyTitle')}</h3>
                                
                                {modalError && <div className="budget-page-modal-error">{modalError}</div>}
                                
                                <div className="budget-page-form-group budget-page-z-index-high">
                                    <Dropdown 
                                        key={`cat-${activeModal}-${selectedCategory}`} 
                                        dataArr={categoriesDropdownData}
                                        width="100%"
                                        height="50px"
                                        displayLabel={categoriesDropdownData.find(c => c.id === (selectedCategory || 'general'))?.label}
                                        labelKey="label"
                                        onSelect={(id) => setSelectedCategory(id === 'general' ? null : id)}
                                        disabled={activeModal === 'MODIFY'}
                                    />
                                </div>

                                <div className="budget-page-form-group budget-page-z-index-medium">
                                    <Dropdown 
                                        key={`per-${activeModal}-${selectedPeriod}`}
                                        dataArr={periodsDropdownData}
                                        width="100%"
                                        height="50px"
                                        displayLabel={periodsDropdownData.find(p => p.id === selectedPeriod)?.label}
                                        labelKey="label"
                                        onSelect={(id) => setSelectedPeriod(id)}
                                        disabled={activeModal === 'MODIFY'}
                                    />
                                </div>

                                <div className="budget-page-form-group">
                                    <div className="budget-page-form-input">
                                        <input type="number" 
                                                id="budgetAmount" 
                                                value={budgetAmount}
                                                onChange={(e) => setBudgetAmount(e.target.value)}
                                                placeholder=' ' />
                                        <label htmlFor="budgetAmount">{t('budgets.limit')}</label>
                                    </div>
                                </div>

                                <div className="budget-page-modal-actions">
                                    <button className="budget-page-modal-btn" onClick={closeModal}>{t('budgets.modalNo')}</button>
                                    <button className="budget-page-modal-btn budget-page-modal-btn-primary" onClick={handleSaveBudget}>{t('budgets.saveBtn')}</button>
                                </div>
                            </>
                        )}

                        {activeModal === 'DELETE' && (
                            <>
                                <h3>{t('budgets.modalDeleteTitle')}</h3>
                                <p className="budget-page-delete-text">
                                    {t('budgets.modalDeleteDesc')}
                                </p>
                                <div className="budget-page-modal-actions">
                                    <button className="budget-page-modal-btn" onClick={closeModal}>{t('budgets.modalNo')}</button>
                                    <button className="budget-page-modal-btn budget-page-modal-btn-delete" onClick={handleDeleteBudget}>
                                        {t('budgets.modalYes')}
                                    </button>
                                </div>
                            </>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
}

export default BudgetsContent;