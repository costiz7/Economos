import React, { useState, useEffect } from 'react';
import './SavingsContent.css';
import { useLanguage } from '../context/LanguageContext';
import { useLoading } from '../context/LoadingContext';
import Saving from '../Saving/Saving';

function SavingsContent() {
    const { t } = useLanguage();
    const { setIsLoading } = useLoading();

    const [user] = useState(() => {
        const storedUser = localStorage.getItem("user");
        return storedUser ? JSON.parse(storedUser) : null;
    });

    const [goals, setGoals] = useState([]);

    // Active Modal Pattern States (ADD_GOAL, ADD_FUNDS, WITHDRAW, DELETE_GOAL)
    const [activeModal, setActiveModal] = useState(null); 
    const [isClosing, setIsClosing] = useState(false);
    const [modalError, setModalError] = useState("");

    // Form states for creating a goal
    const [goalName, setGoalName] = useState(""); 
    const [targetAmount, setTargetAmount] = useState("");
    const [deadline, setDeadline] = useState("");

    // Form states for adding/withdrawing funds
    const [transactionAmount, setTransactionAmount] = useState("");

    // Parses amount safely — handles comma as decimal separator too
    const parseAmount = (val) => {
        const normalized = String(val).trim().replace(',', '.');
        const parsed = parseFloat(normalized);
        return isNaN(parsed) ? null : parsed;
    };

    // Tracking the currently selected goal item for modal actions
    const [selectedGoal, setSelectedGoal] = useState(null);

    // Initial Fetch for Savings Goals
    useEffect(() => {
        const fetchGoalsData = async () => {
            setIsLoading(true);
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${import.meta.env.VITE_API_URL}/api/savings`, { 
                    headers: { 'token': token } 
                });

                if (response.ok) {
                    const data = await response.json();
                    setGoals(data);
                }
            } catch (error) {
                console.error("Error fetching savings goals:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchGoalsData();
    }, [setIsLoading]);

    // Modal Manager Handlers
    const openModal = (modalId, goal = null) => {
        setIsClosing(false);
        setModalError("");
        setSelectedGoal(goal);
        
        // Reset inputs on opening
        setGoalName("");
        setTargetAmount("");
        setDeadline("");
        setTransactionAmount("");

        setActiveModal(modalId);
    };

    const closeModal = () => {
        setIsClosing(true);
        setTimeout(() => {
            setActiveModal(null);
            setIsClosing(false);
            setModalError("");
            setSelectedGoal(null);
        }, 400); 
    };

    // API Call: Create New Savings Goal
    const handleCreateGoal = async () => {
        setModalError("");
        if (!goalName.trim()) return setModalError(t('errors.MISSING_TITLE') || "Please enter a name");
        const parsedTarget = parseAmount(targetAmount);
        if (parsedTarget === null || parsedTarget <= 0) return setModalError(t('errors.INVALID_AMOUNT') || "Amount must be greater than 0");
        if (!deadline) return setModalError(t('errors.MISSING_GOAL_FIELDS') || "Please select a deadline");

        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                name: goalName,
                targetAmount: parsedTarget,
                deadline: deadline
            };

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/savings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'token': token },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                // Fetch the fully updated and formatted array from the server
                const refreshRes = await fetch(`${import.meta.env.VITE_API_URL}/api/savings`, { headers: { 'token': token } });
                if (refreshRes.ok) setGoals(await refreshRes.json());
                closeModal();
            } else {
                const code = data.errorCode || 'SERVER_ERROR';
                setModalError(t(`errors.${code}`));
            }
        } catch (error) {
            setModalError(t('login.serverError'));
        } finally {
            setIsLoading(false);
        }
    };

    // API Call: Deposit Funds into the selected target pod
    const handleAddFunds = async () => {
        setModalError("");
        const parsedAmount = parseAmount(transactionAmount);
        if (parsedAmount === null || parsedAmount <= 0) return setModalError(t('errors.INVALID_AMOUNT') || "Amount must be greater than 0");

        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/savings/${selectedGoal.id}/add`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'token': token },
                body: JSON.stringify({ amountToAdd: parsedAmount })
            });

            const data = await response.json();

            if (response.ok) {
                const refreshRes = await fetch(`${import.meta.env.VITE_API_URL}/api/savings`, { headers: { 'token': token } });
                if (refreshRes.ok) setGoals(await refreshRes.json());
                closeModal();
            } else {
                const code = data.errorCode || 'SERVER_ERROR';
                setModalError(t(`errors.${code}`));
            }
        } catch (error) {
            setModalError(t('login.serverError'));
        } finally {
            setIsLoading(false);
        }
    };

    // API Call: Withdraw emergency cash back out of the pod
    const handleWithdrawFunds = async () => {
        setModalError("");
        const parsedAmount = parseAmount(transactionAmount);
        if (parsedAmount === null || parsedAmount <= 0) return setModalError(t('errors.INVALID_AMOUNT') || "Amount must be greater than 0");

        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/savings/${selectedGoal.id}/withdraw`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'token': token },
                body: JSON.stringify({ amountToWithdraw: parsedAmount })
            });

            const data = await response.json();

            if (response.ok) {
                const refreshRes = await fetch(`${import.meta.env.VITE_API_URL}/api/savings`, { headers: { 'token': token } });
                if (refreshRes.ok) setGoals(await refreshRes.json());
                closeModal();
            } else {
                const code = data.errorCode || 'SERVER_ERROR';
                setModalError(t(`errors.${code}`));
            }
        } catch (error) {
            setModalError(t('login.serverError'));
        } finally {
            setIsLoading(false);
        }
    };

    // API Call: Terminate and delete the savings goal record completely
    const handleDeleteGoal = async () => {
        if (!selectedGoal) return;
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/savings/${selectedGoal.id}`, {
                method: 'DELETE',
                headers: { 'token': token }
            });

            if (response.ok) {
                setGoals(goals.filter(g => g.id !== selectedGoal.id));
                closeModal();
            }
        } catch (error) {
            console.error("Delete savings goal failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="savings-content-wrapper">
            <div className="savings-header">
                <h2>{t('savings.pageTitle')}</h2>
                <button className="savings-header-btn" onClick={() => openModal('ADD_GOAL')}>
                    {t('savings.addBtn')}
                </button>
            </div>

            <div className="savings-list">
                {goals.map(goal => (
                    <Saving 
                        key={goal.id} 
                        goal={goal} 
                        user={user} 
                        onOpenAddFunds={(g) => openModal('ADD_FUNDS', g)}
                        onOpenWithdraw={(g) => openModal('WITHDRAW', g)}
                        onOpenDelete={(g) => openModal('DELETE_GOAL', g)}
                    />
                ))}
            </div>
            {activeModal && (
                <div className={`savings-modal-overlay ${isClosing ? 'closing' : ''}`}>
                    <div className="savings-modal-card">
                        
                        {activeModal === 'ADD_GOAL' && (
                            <>
                                <h3>{t('savings.modalAddTitle') || 'Create New Goal'}</h3>
                                
                                {modalError && <div className="savings-modal-error">{modalError}</div>}
                                
                                <div className="savings-form-group">
                                    <div className="savings-form-input">
                                        <input type="text" 
                                                id="goalName" 
                                                value={goalName}
                                                onChange={(e) => setGoalName(e.target.value)}
                                                placeholder=' ' />
                                        <label htmlFor="goalName">{t('savings.goalNameLabel') || 'Goal Name'}</label>
                                    </div>
                                </div>

                                <div className="savings-form-group">
                                    <div className="savings-form-input">
                                        <input type="text" 
                                                inputMode="decimal"
                                                id="targetAmount" 
                                                value={targetAmount}
                                                onChange={(e) => setTargetAmount(e.target.value)}
                                                placeholder=' ' />
                                        <label htmlFor="targetAmount">{t('savings.targetAmountLabel') || 'Target Amount'}</label>
                                    </div>
                                </div>

                                <div className="savings-form-group">
                                    <div className="savings-form-input label-always-floating">
                                        <input type="date" 
                                                id="deadline" 
                                                value={deadline}
                                                onChange={(e) => setDeadline(e.target.value)}
                                                placeholder=' ' />
                                        <label htmlFor="deadline">{t('savings.deadlineLabel') || 'Target Deadline'}</label>
                                    </div>
                                </div>

                                <div className="savings-modal-actions">
                                    <button className="savings-modal-btn" onClick={closeModal}>{t('budgets.modalNo')}</button>
                                    <button className="savings-modal-btn primary" onClick={handleCreateGoal}>{t('budgets.saveBtn')}</button>
                                </div>
                            </>
                        )}

                        {activeModal === 'ADD_FUNDS' && (
                            <>
                                <h3>{t('savings.modalDepositTitle')}</h3>
                                <p className="modal-subtitle-context">{selectedGoal?.name}</p>
                                
                                {modalError && <div className="savings-modal-error">{modalError}</div>}
                                
                                <div className="savings-form-group">
                                    <div className="savings-form-input">
                                        <input type="text" 
                                                inputMode="decimal"
                                                id="transactionAmount" 
                                                value={transactionAmount}
                                                onChange={(e) => setTransactionAmount(e.target.value)}
                                                placeholder=' ' />
                                        <label htmlFor="transactionAmount">{t('savings.depositAmountLabel')}</label>
                                    </div>
                                </div>

                                <div className="savings-modal-actions">
                                    <button className="savings-modal-btn" onClick={closeModal}>{t('budgets.modalNo')}</button>
                                    <button className="savings-modal-btn primary" onClick={handleAddFunds}>{t('savings.confirmDepositBtn')}</button>
                                </div>
                            </>
                        )}

                        {activeModal === 'WITHDRAW' && (
                            <>
                                <h3>{t('savings.modalWithdrawTitle')}</h3>
                                <p className="modal-subtitle-context">{selectedGoal?.name}</p>
                                
                                {modalError && <div className="savings-modal-error">{modalError}</div>}
                                
                                <div className="savings-form-group">
                                    <div className="savings-form-input">
                                        <input type="text" 
                                                inputMode="decimal"
                                                id="transactionAmount" 
                                                value={transactionAmount}
                                                onChange={(e) => setTransactionAmount(e.target.value)}
                                                placeholder=' ' />
                                        <label htmlFor="transactionAmount">{t('savings.withdrawAmountLabel')}</label>
                                    </div>
                                </div>

                                <div className="savings-modal-actions">
                                    <button className="savings-modal-btn" onClick={closeModal}>{t('budgets.modalNo')}</button>
                                    <button className="savings-modal-btn primary" onClick={handleWithdrawFunds}>{t('savings.confirmWithdrawBtn')}</button>
                                </div>
                            </>
                        )}
                        {activeModal === 'DELETE_GOAL' && (
                            <>
                                <h3>{t('savings.modalDeleteTitle')}</h3>
                                <p style={{ color: 'var(--black-color)', textAlign: 'center', marginBottom: '25px', fontWeight: '500' }}>
                                    {t('savings.modalDeleteDesc')}
                                </p>
                                <div className="savings-modal-actions">
                                    <button className="savings-modal-btn" onClick={closeModal}>{t('budgets.modalNo')}</button>
                                    <button className="savings-modal-btn delete-confirm-btn" onClick={handleDeleteGoal}>
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

export default SavingsContent;