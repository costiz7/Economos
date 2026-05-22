import { Budget, Category, Transaction } from "../../database/associations.js";
import { Op } from "sequelize";

/**
 * Creates a new budget for a specific category and period.
 * 
 * The function validates the required fields (amount and categoryId), checks if a 
 * budget already exists for the user in the specified category and period, and 
 * creates a new budget record in the database.
 *
 * @async
 * @function createBudget
 * @param {Object} req - The Express request object.
 * @param {Object} req.body - The request body containing budget details.
 * @param {number} req.body.amount - The monetary amount for the budget.
 * @param {number|string} req.body.categoryId - The ID of the category associated with the budget.
 * @param {string} [req.body.period='monthly'] - (Optional) The time period for the budget. Defaults to 'monthly'.
 * @param {Object} req.user - The authenticated user object (provided by authentication middleware).
 * @param {number|string} req.user.id - The ID of the authenticated user.
 * @param {Object} res - The Express response object.
 * @returns {Promise<Object>} Returns a JSON response with the newly created budget data (status 201),
 *                            or an error message for missing fields/duplicate budgets (status 400) or server errors (status 500).
 */
const createBudget = async (req, res) => {
    try {
        const { amount, period, categoryId = null } = req.body;

        if (!amount) {
            return res.status(400).json({ errorCode: 'MISSING_AMOUNT' });
        }

        const existingBudget = await Budget.findOne({
            where: {
                userId: req.user.id,
                categoryId: categoryId,
                period: period || 'monthly'
            }
        });

        if (existingBudget) {
            return res.status(400).json({ errorCode: 'BUDGET_ALREADY_EXISTS' });
        }

        const newBudget = await Budget.create({
            amount,
            period: period || 'monthly',
            categoryId,
            userId: req.user.id
        });

        
        res.status(201).json(newBudget);

    } catch (error) {
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
};

/**
 * Creates a new budget for a specific category and period.
 * 
 * The function validates the required fields (amount and categoryId), checks if a 
 * budget already exists for the user in the specified category and period, and 
 * creates a new budget record in the database.
 *
 * @async
 * @function createBudget
 * @param {Object} req - The Express request object.
 * @param {Object} req.body - The request body containing budget details.
 * @param {number} req.body.amount - The monetary amount for the budget.
 * @param {number|string} req.body.categoryId - The ID of the category associated with the budget.
 * @param {string} [req.body.period='monthly'] - (Optional) The time period for the budget. Defaults to 'monthly'.
 * @param {Object} req.user - The authenticated user object (provided by authentication middleware).
 * @param {number|string} req.user.id - The ID of the authenticated user.
 * @param {Object} res - The Express response object.
 * @returns {Promise<Object>} Returns a JSON response with the newly created budget data (status 201),
 *                            or an error message for missing fields/duplicate budgets (status 400) or server errors (status 500).
 */
const modifyBudget = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, period } = req.body;

        const budget = await Budget.findOne({
            where: {
                id: id,
                userId: req.user.id
            }
        });

        if (!budget) {
            return res.status(404).json({ errorCode: 'BUDGET_NOT_FOUND' });
        }

        if (amount) budget.amount = amount;
        if (period) budget.period = period;

        await budget.save();

        res.status(200).json(budget);
    } catch (error) {
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
}

/**
 * Retrieves all budgets for the authenticated user.
 * 
 * The function fetches the user's budget records from the database, sorted by 
 * creation date in descending order. It also includes associated category details 
 * (name, icon, and type) for each budget.
 *
 * @async
 * @function getMyBudgets
 * @param {Object} req - The Express request object.
 * @param {Object} req.user - The authenticated user object (provided by authentication middleware).
 * @param {number|string} req.user.id - The ID of the authenticated user.
 * @param {Object} res - The Express response object.
 * @returns {Promise<Object>} Returns a JSON array of the user's budget objects (status 200),
 *                            or an error message if a server error occurs (status 500).
 */
const getMyBudgets = async (req, res) => {
    try {
        const budgets = await Budget.findAll({
            where: {
                userId: req.user.id
            },
            include: [
                {
                    model: Category,
                    attributes: ['name', 'iconFile', 'type']
                }
            ],
            order: [
                ['createdAt', 'DESC']
            ]
        });

        res.status(200).json(budgets);
    } catch (error) {
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
}

/**
 * Deletes a specific budget for the authenticated user.
 * 
 * The function looks for a budget by its ID, ensuring that it belongs to 
 * the currently authenticated user. If found, it permanently removes the 
 * budget record from the database.
 *
 * @async
 * @function deleteBudget
 * @param {Object} req - The Express request object.
 * @param {Object} req.params - The route parameters.
 * @param {number|string} req.params.id - The ID of the budget to be deleted.
 * @param {Object} req.user - The authenticated user object (provided by authentication middleware).
 * @param {number|string} req.user.id - The ID of the authenticated user.
 * @param {Object} res - The Express response object.
 * @returns {Promise<Object>} Returns a JSON response with a success message (status 200),
 *                            an error message if the budget is not found or unauthorized (status 404),
 *                            or a server error message (status 500).
 */
const deleteBudget = async (req, res) => {
    try {
        const { id } = req.params;

        const budget = await Budget.findOne({
            where: {
                id: id,
                userId: req.user.id
            }
        });

        if (!budget) {
            return res.status(404).json({ errorCode: 'BUDGET_NOT_FOUND_OR_UNAUTHORIZED' });
        }

        await budget.destroy();

        res.status(200).json({ message: 'The budget was successfully deleted.' });
    } catch (error) {
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
}

/**
 * Calculates and retrieves the status of the user's budgets for a specific month and year.
 * 
 * The function fetches the user's budgets and corresponding expense transactions 
 * within the given timeframe. It then calculates the total spent per category, 
 * the remaining amount, the percentage of the budget used, and assigns a status 
 * ('untouched', 'safe', 'warning', or 'exceeded') to each budget.
 *
 * @async
 * @function checkBudgetStatus
 * @param {Object} req - The Express request object.
 * @param {Object} req.query - The URL query parameters.
 * @param {string|number} [req.query.month] - (Optional) The target month (1-12). Defaults to the current month.
 * @param {string|number} [req.query.year] - (Optional) The target year. Defaults to the current year.
 * @param {Object} req.user - The authenticated user object (provided by authentication middleware).
 * @param {number|string} req.user.id - The ID of the authenticated user.
 * @param {Object} res - The Express response object.
 * @returns {Promise<Object>} Returns a JSON array containing the status objects for each budget (status 200),
 *                            or a server error message if something goes wrong (status 500).
 */
const checkBudgetStatus = async (req, res) => {
    try {
        const { month, year } = req.query;

        // 1. Stabilim data de referință (fie luna cerută, fie ziua de azi)
        const refDate = new Date();
        if (month && year) {
            // Folosim ziua 15 pentru a evita problemele de shiftare pe timezone-uri
            refDate.setFullYear(parseInt(year), parseInt(month) - 1, 15);
        }

        const budgets = await Budget.findAll({
            where: { 
                userId: req.user.id 
            },
            include: [{ 
                model: Category, 
                attributes: ['name', 'iconFile', 'type'] 
            }]
        });

        if (!budgets.length) {
            return res.status(200).json([]);
        }

        // 2. Mapăm fiecare buget și calculăm fereastra de timp specifică LUI
        const budgetStatusesPromises = budgets.map(async (budget) => {
            let startDate, endDate;

            if (budget.period === 'yearly') {
                startDate = new Date(refDate.getFullYear(), 0, 1);
                endDate = new Date(refDate.getFullYear(), 11, 31, 23, 59, 59, 999);
            } 
            else if (budget.period === 'weekly') {
                // Logica pentru a găsi Luni - Duminică a săptămânii de referință
                const currentDay = new Date(refDate);
                const dayOfWeek = currentDay.getDay(); // 0 este Duminică, 1 este Luni
                const diffToMonday = currentDay.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                
                startDate = new Date(currentDay.setDate(diffToMonday));
                startDate.setHours(0, 0, 0, 0);
                
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                endDate.setHours(23, 59, 59, 999);
            } 
            else {
                // Default: 'monthly'
                startDate = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
                endDate = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59, 999);
            }

            // 3. Facem query pe tranzacții STRICT pentru perioada și categoria acestui buget
            const transactionWhere = {
                userId: req.user.id,
                date: { [Op.between]: [startDate, endDate] }
            };

            if (budget.categoryId) {
                transactionWhere.categoryId = budget.categoryId;
            }

            const expenses = await Transaction.findAll({
                where: transactionWhere,
                include: [{ model: Category, where: { type: 'expense' }, attributes: ['id'] }]
            });

            // 4. Calculăm suma
            const spent = expenses.reduce((total, t) => total + parseFloat(t.amount), 0);
            const limit = parseFloat(budget.amount);
            const remaining = limit - spent;
            
            let percentage = (spent / limit) * 100;
            percentage = Math.round(percentage * 100) / 100;

            let status = 'safe';
            if (spent === 0) {
                status = 'untouched';
            } else if (percentage >= 100) {
                status = 'exceeded';
            } else if (percentage >= 80) {
                status = 'warning';
            }

            return {
                budgetId: budget.id,
                categoryId: budget.categoryId,
                categoryName: budget.Category?.name || 'Global Budget',
                categoryIcon: budget.Category?.iconFile || 'global_icon',
                period: budget.period,
                limit: limit,
                spent: spent,
                remaining: remaining < 0 ? 0 : remaining,
                percentage: percentage,
                status: status
            };
        });

        // Așteptăm ca toate bugetele să își termine calculele în paralel
        const budgetStatuses = await Promise.all(budgetStatusesPromises);
        res.status(200).json(budgetStatuses);

    } catch (error) {
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
}

export default {
    createBudget,
    modifyBudget,
    getMyBudgets,
    deleteBudget,
    checkBudgetStatus
}