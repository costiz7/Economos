import './Saving.css';
import ProgressBarComponent from '../ChartComponents/ProgressBarComponent/ProgressBarComponent';
import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import SavingsIcon from '../Icons/SavingsIcon'; // Folosim iconița ta default de economii

function Saving({ goal, user, onOpenAddFunds, onOpenWithdraw, onOpenDelete }) {
    const [ isExpanded, setIsExpanded ] = useState(false);
    const { t } = useLanguage();

    function toggleExpansion() {
        setIsExpanded(!isExpanded);
    }
    const targetAmount = parseFloat(goal.targetAmount) || 0;
    const currentAmount = parseFloat(goal.currentAmount) || 0;

    const isCompleted = currentAmount >= targetAmount;

    const progressBarColor = isCompleted ? 'var(--blue-color)' : 'var(--green-color)';

    const deadlineDate = new Date(goal.deadline).toLocaleDateString();

    return (
        <div className="saving-card-wrapper">
            <div className="saving-header" onClick={toggleExpansion}>
                <div className="header-top-row">
                    <div className="header-left-side">
                        <SavingsIcon style={{ height: "35px", width: "auto" }}/>
                        <p className="header-saving-title">{goal.name}</p>       
                    </div>
                </div>

                <div className="header-progress-container">
                    <ProgressBarComponent 
                        currentValue={currentAmount}
                        maxValue={targetAmount}
                        color={progressBarColor}
                        height="16px" 
                        unit={user?.currency || "RON"}
                        showLabels={true} 
                    />
                </div>
            </div>
            <div className={`saving-body-wrapper ${isExpanded ? 'expanded' : ''}`}>
                <div className="saving-body">
                    <div className="body-saving-details">
                        <span className="body-detail-label">{t('savings.deadline') || 'Deadline'}</span>
                        <span className="body-detail-value">
                            {deadlineDate}
                        </span>

                        <span className="body-detail-label">{t('savings.status') || 'Status'}</span>
                        <span className="body-detail-value" style={{ color: progressBarColor, fontWeight: '900', textTransform: 'uppercase' }}>
                            {isCompleted ? (t('savings.status_completed') || 'COMPLETED') : (t('savings.status_in_progress') || 'IN PROGRESS')}
                        </span>

                        <div className="saving-actions-row">
                            <button className="saving-action-btn" onClick={(e) => { e.stopPropagation(); onOpenAddFunds(goal); }}>
                                {t('savings.addFundsBtn')}
                            </button>
                            <button className="saving-action-btn" onClick={(e) => { e.stopPropagation(); onOpenWithdraw(goal); }}>
                                {t('savings.withdrawBtn')}
                            </button>
                            <button className="saving-action-btn delete-btn" onClick={(e) => { e.stopPropagation(); onOpenDelete(goal); }}>
                                {t('savings.deleteBtn')}
                            </button>
                        </div>
                    </div>    
                </div>
            </div>
            
        </div>
    );
}

export default Saving;