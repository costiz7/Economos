import './Budget.css';
import CategoryIcon from '../Icons/Categories/CategoryIcon';
import ProgressBarComponent from '../ChartComponents/ProgressBarComponent/ProgressBarComponent';
import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

function Budget({ budget, user, onOpenModifyModal, onOpenDeleteModal }) {
    const [ isExpanded, setIsExpanded ] = useState(false);
    const { t } = useLanguage();

    function toggleExpansion() {
        setIsExpanded(!isExpanded);
    }

    const isGeneral = budget.categoryId === null;
    const periodText = t(`budgets.period.${budget.period}`);

    // Construim titlul pe baza numelui returnat de status endpoint
    let title = '';
    if (isGeneral) {
        title = `${t('budgets.general')} ${periodText}`;
    } else {
        const catName = t(`categories.${budget.categoryName}`) !== `categories.${budget.categoryName}` 
                            ? t(`categories.${budget.categoryName}`) 
                            : budget.categoryName;
        title = `${catName} (${periodText})`;
    }

    let statusColor = 'var(--black-color)';
    if (budget.status === 'safe' || budget.status === 'untouched') statusColor = 'var(--green-color)';
    if (budget.status === 'warning') statusColor = 'var(--orange-color)';
    if (budget.status === 'exceeded') statusColor = 'var(--red-color)';

    return (
        <div className="budget-card-wrapper">
            
            <div className="budget-header" onClick={toggleExpansion}>
                <div className="header-top-row">
                    <div className="header-left-side">
                        {!isGeneral && (
                            <CategoryIcon iconFile={budget.categoryIcon} style={{ height: "35px", width: "auto" }}/>
                        )}
                        <p className="header-budget-title">{title}</p>       
                    </div>
                </div>

                <div className="header-progress-container">
                    <ProgressBarComponent 
                        currentValue={budget.spent}
                        maxValue={budget.limit}
                        color={statusColor}
                        height="16px" 
                        unit={user?.currency || "RON"}
                        showLabels={true} 
                    />
                </div>
            </div>

            <div className={`budget-body-wrapper ${isExpanded ? 'expanded' : ''}`}>
                <div className="budget-body">
                    <div className="body-budget-details">
                        <span className="body-detail-label">{t('budgets.status')}</span>
                        <span className="body-detail-value" style={{ color: statusColor, fontWeight: '900', textTransform: 'uppercase' }}>
                            {t(`budgets.status_${budget.status}`)}
                        </span>

                        <div className="budget-actions-row">
                            <button className="budget-action-btn" onClick={(e) => { e.stopPropagation(); onOpenModifyModal(budget); }}>
                                {t('budgets.modifyBtn')}
                            </button>
                            <button className="budget-action-btn delete-btn" onClick={(e) => { e.stopPropagation(); onOpenDeleteModal(budget); }}>
                                {t('budgets.deleteBtn')}
                            </button>
                        </div>
                    </div>    
                </div>
            </div>
            
        </div>
    );
}

export default Budget;