import { Category, Transaction, User, SavingsGoal } from "../../database/associations.js";
import { Op } from "sequelize";
import { GoogleGenAI } from '@google/genai';

/**
 * Retrieves a list of transactions for the authenticated user with optional filtering.
 * 
 * The function fetches transactions from the database and allows filtering by 
 * a specific month and year, a specific category ID, or a transaction type 
 * (e.g., 'income' or 'expense'). The results are sorted by date and creation 
 * time in descending order.
 *
 * @async
 * @function getTransactions
 * @param {Object} req - The Express request object.
 * @param {Object} req.query - The URL query parameters for filtering.
 * @param {string|number} [req.query.month] - (Optional) The month to filter transactions by (1-12). Must be used with year.
 * @param {string|number} [req.query.year] - (Optional) The year to filter transactions by.
 * @param {string|number} [req.query.categoryId] - (Optional) The ID of a specific category to filter by.
 * @param {string} [req.query.type] - (Optional) The type of transaction to filter by (e.g., 'income' or 'expense').
 * @param {Object} req.user - The authenticated user object (provided by authentication middleware).
 * @param {number|string} req.user.id - The ID of the authenticated user.
 * @param {Object} res - The Express response object.
 * @returns {Promise<Object>} Returns a JSON array of transaction objects that match the filters (status 200),
 *                            or a server error message if the query fails (status 500).
 */
const getTransactions = async (req, res) => {
    try {
        let { 
            month, 
            year, 
            categoryId, 
            type, 
            page = 1, 
            limit = 20 
        } = req.query;

        page = parseInt(page);
        limit = parseInt(limit);
        const offset = (page - 1) * limit;

        const whereClause = {
            userId: req.user.id
        };

        if (year) {
            if (month) {
                const startDate = new Date(year, month - 1, 1);
                const endDate = new Date(year, month, 0, 23, 59, 59);
                
                whereClause.date = {
                    [Op.between]: [startDate, endDate]
                };
            } else {
                const startDate = new Date(year, 0, 1);
                const endDate = new Date(year, 11, 31, 23, 59, 59);
                
                whereClause.date = {
                    [Op.between]: [startDate, endDate]
                };
            }
        }

        if (categoryId) {
            const categoryIds = Array.isArray(categoryId) 
                ? categoryId 
                : categoryId.toString().split(',');
            
            whereClause.categoryId = {
                [Op.in]: categoryIds
            };
        }

        const categoryInclude = {
            model: Category,
            attributes: ['name', 'iconFile', 'type'],
            where: {}
        };

        if (type) {
            categoryInclude.where.type = type;
        } else {
            delete categoryInclude.where;
        }

        const { count, rows } = await Transaction.findAndCountAll({
            where: whereClause,
            include: [categoryInclude],
            order: [['date', 'DESC'], ['createdAt', 'DESC']],
            limit: limit,
            offset: offset,
            distinct: true 
        });

        res.status(200).json({
            transactions: rows,
            pagination: {
                totalItems: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                itemsPerPage: limit
            }
        });

    } catch (error) {
        res.status(500).json({ 
            errorCode: 'SERVER_ERROR', 
            error: error.message 
        });
    }
};

/**
 * Creates a new transaction for the authenticated user.
 * 
 * The function validates that the required amount and category ID are provided. 
 * It then verifies that the selected category exists and is accessible to the user 
 * (either a custom user category or a global default category) before creating 
 * the transaction record in the database.
 *
 * @async
 * @function addTransaction
 * @param {Object} req - The Express request object.
 * @param {Object} req.body - The request body containing transaction details.
 * @param {number|string} req.body.amount - The monetary amount of the transaction.
 * @param {number|string} req.body.categoryId - The ID of the category associated with the transaction.
 * @param {string|Date} [req.body.date] - (Optional) The date of the transaction.
 * @param {string} [req.body.description] - (Optional) A brief description or note for the transaction.
 * @param {Object} req.user - The authenticated user object (provided by authentication middleware).
 * @param {number|string} req.user.id - The ID of the authenticated user.
 * @param {Object} res - The Express response object.
 * @returns {Promise<Object>} Returns a JSON response with the newly created transaction data (status 201),
 *                            an error message for missing fields (status 400) or invalid category (status 404),
 *                            or a server error message (status 500).
 */
const addTransaction = async (req, res) => {
    try {
        const { amount, date, title, description, categoryId } = req.body;

        if(!title) {
            return res.status(400).json({ errorCode: 'MISSING_TITLE' });
        }

        if(!amount) {
            return res.status(400).json({ errorCode: 'MISSING_AMOUNT' });
        }

        if(!categoryId) {
            return res.status(400).json({ errorCode: 'MISSING_CATEGORY' });
        }

        const category = await Category.findOne({
            where: {
                id: categoryId,
                [Op.or]: [
                    { userId: req.user.id },
                    { userId: null }
                ]
            }
        });

        if(!category) {
            return res.status(404).json({ errorCode: 'CATEGORY_NOT_FOUND' });
        }

        const newTransaction = await Transaction.create({
            amount,
            date,
            description,
            title,
            userId: req.user.id,
            categoryId
        });

        res.status(201).json(newTransaction);
    } catch (error) {
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
}

/**
 * Deletes a specific transaction for the authenticated user.
 * 
 * The function looks for a transaction by its ID, ensuring that it belongs 
 * to the currently authenticated user. If the transaction is found, it is 
 * permanently removed from the database.
 *
 * @async
 * @function deleteTransaction
 * @param {Object} req - The Express request object.
 * @param {Object} req.params - The route parameters.
 * @param {number|string} req.params.id - The ID of the transaction to be deleted.
 * @param {Object} req.user - The authenticated user object (provided by authentication middleware).
 * @param {number|string} req.user.id - The ID of the authenticated user.
 * @param {Object} res - The Express response object.
 * @returns {Promise<Object>} Returns a JSON response with a success message (status 200),
 *                            an error message if the transaction is not found or unauthorized (status 404),
 *                            or a server error message (status 500).
 */
const deleteTransaction = async (req, res) => {
    try {
        const { id } = req.params;

        const transaction = await Transaction.findOne({
            where: {
                id: id,
                userId: req.user.id
            }
        });

        if (!transaction) {
            return res.status(404).json({ errorCode: 'TRANSACTION_NOT_FOUND_OR_UNAUTHORIZED' });
        }

        await transaction.destroy();

        res.status(200).json({ message: "Transaction deleted successfully." });
    } catch (error) {
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
};

/**
 * Calculates the total income, total expenses, and net balance for a specific month.
 * 
 * The function determines the target month and year (defaulting to the current 
 * date if not provided), fetches all transactions for the authenticated user 
 * within that timeframe, and sums up the amounts based on the category type 
 * ('income' vs 'expense'). Finally, it calculates the overall balance.
 *
 * @async
 * @function getMonthlyTotals
 * @param {Object} req - The Express request object.
 * @param {Object} req.query - The URL query parameters for timeframe selection.
 * @param {string|number} [req.query.month] - (Optional) The target month (1-12). Defaults to the current month.
 * @param {string|number} [req.query.year] - (Optional) The target year. Defaults to the current year.
 * @param {Object} req.user - The authenticated user object (provided by authentication middleware).
 * @param {number|string} req.user.id - The ID of the authenticated user.
 * @param {Object} res - The Express response object.
 * @returns {Promise<Object>} Returns a JSON response containing the calculated `income`, `expense`, and `balance` (status 200),
 *                            or a server error message if the calculation fails (status 500).
 */
const getMonthlyTotals = async (req, res) => {
    try {
        const { month, year } = req.query;

        const currentDate = new Date();
        const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const targetYear = year ? parseInt(year) : currentDate.getFullYear();

        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0);

        const transactions = await Transaction.findAll({
            where: {
                userId: req.user.id,
                date: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: [
                {
                    model: Category,
                    attributes: ['type']
                }
            ]
        });

        let totalIncome = 0;
        let totalExpense = 0;

        transactions.forEach(transaction => {
            const amount = parseFloat(transaction.amount);
            if(transaction.Category.type === 'income') {
                totalIncome += amount;
            } else if(transaction.Category.type === 'expense') {
                totalExpense += amount;
            }
        });

        const balance = totalIncome - totalExpense;

        res.status(200).json({
            income: totalIncome,
            expense: totalExpense,
            balance: balance
        });
    } catch (error) {
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
}

/**
 * Retrieves a breakdown of expenses by category for a specific month and year.
 * 
 * The function fetches all expense transactions for the authenticated user 
 * within the specified timeframe. It then groups these expenses by category, 
 * calculates the total amount spent per category, and returns the results 
 * sorted in descending order by the total amount spent.
 *
 * @async
 * @function getExpenseBreakdown
 * @param {Object} req - The Express request object.
 * @param {Object} req.query - The URL query parameters for timeframe selection.
 * @param {string|number} [req.query.month] - (Optional) The target month (1-12). Defaults to the current month.
 * @param {string|number} [req.query.year] - (Optional) The target year. Defaults to the current year.
 * @param {Object} req.user - The authenticated user object (provided by authentication middleware).
 * @param {number|string} req.user.id - The ID of the authenticated user.
 * @param {Object} res - The Express response object.
 * @returns {Promise<Object>} Returns a JSON array of categorized expense objects sorted by total spent (status 200),
 *                            or a server error message if the query fails (status 500).
 */
const getExpenseBreakdown = async (req, res) => {
    try {
        const { month, year } = req.query;

        const currentDate = new Date();
        const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const targetYear = year ? parseInt(year) : currentDate.getFullYear();

        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0);

        const expenses = await Transaction.findAll({
            where: {
                userId: req.user.id,
                date: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: [
                {
                    model: Category,
                    attributes: ['name', 'iconFile', 'type'],
                    where: { type: 'expense' }
                }
            ]
        });

        const breakdownObj = expenses.reduce((acc, transaction) => {
            const categoryName = transaction.Category.name;
            const categoryIcon = transaction.Category.iconFile;
            const amount = parseFloat(transaction.amount);

            if(!acc[categoryName]) {
                acc[categoryName] = {
                    category: categoryName,
                    icon: categoryIcon,
                    total: 0
                };
            }

            acc[categoryName].total += amount;

            return acc;
        }, {});

        const breakdownArray = Object.values(breakdownObj);
        breakdownArray.sort((a, b) => b.total - a.total);

        res.status(200).json(breakdownArray);
    } catch (error) {
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
}

/**
 * Retrieves income and expense trends for a 7-month window leading up to the selected timeframe.
 * If no filters are provided, it dynamically anchors to the user's most recent transaction date.
 * * @async
 * @function getSevenMonthsTrend
 * @param {Object} req - The Express request object.
 * @param {Object} req.query - URL query parameters containing optional month and year.
 * @param {Object} res - The Express response object.
 */
const getSevenMonthsTrend = async (req, res) => {
    try {
        const { month, year } = req.query;
        let targetMonth, targetYear;

        if (year && month) {
            targetYear = parseInt(year);
            targetMonth = parseInt(month) - 1; // JavaScript months are 0-indexed
        } else if (year && !month) {
            targetYear = parseInt(year);
            targetMonth = 11; // Anchor to December if only the year is selected
        } else {
            // No filters applied. Find the most recent transaction date for this user.
            const latestTransaction = await Transaction.findOne({
                where: { userId: req.user.id },
                order: [['date', 'DESC']]
            });

            if (latestTransaction) {
                const latestDate = new Date(latestTransaction.date);
                targetYear = latestDate.getFullYear();
                targetMonth = latestDate.getMonth();
            } else {
                // New user with 0 transactions. Fallback to current date to show flat lines.
                const currentDate = new Date();
                targetYear = currentDate.getFullYear();
                targetMonth = currentDate.getMonth();
            }
        }

        // 1. Generate the 7-month bucket sequence dynamically backwards from the anchor date
        const trendData = [];
        for(let i = 6; i >= 0; i--) {
            const d = new Date(targetYear, targetMonth - i, 1);
            trendData.push({
                month: d.getMonth() + 1,
                year: d.getFullYear(),
                income: 0,   // Initializes flat at the ground
                expense: 0   // Initializes flat at the ground
            });
        }

        // 2. Set the strict boundaries for the database window search
        const startDate = new Date(targetYear, targetMonth - 6, 1);
        const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

        const transactions = await Transaction.findAll({
            where: {
                userId: req.user.id,
                date: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: [
                {
                    model: Category,
                    attributes: ['type']
                }
            ]
        });

        // 3. Aggregate transaction data into corresponding timeline buckets
        // Months without transactions will remain 0, keeping the line flat.
        transactions.forEach(transaction => {
            const tDate = new Date(transaction.date);
            const tMonth = tDate.getMonth() + 1;
            const tYear = tDate.getFullYear();
            const amount = parseFloat(transaction.amount);
            const type = transaction.Category.type;

            const monthBucket = trendData.find(m => m.month === tMonth && m.year === tYear);
            if(monthBucket) {
                if(type === 'income') {
                    monthBucket.income += amount;
                } else if (type === 'expense') {
                    monthBucket.expense += amount;
                }
            }
        });

        res.status(200).json(trendData);

    } catch (error) {
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
}

/**
 * Calculates a month-over-month comparison of the user's expenses.
 * 
 * The function determines the target month and the preceding month, fetches all 
 * expense transactions for both periods, and sums them up. It then calculates the 
 * percentage change between the two months and identifies the spending trend 
 * ('up', 'down', or 'flat').
 *
 * @async
 * @function getMonthOverMonthComparison
 * @param {Object} req - The Express request object.
 * @param {Object} req.query - The URL query parameters for timeframe selection.
 * @param {string|number} [req.query.month] - (Optional) The target month (1-12). Defaults to the current month.
 * @param {string|number} [req.query.year] - (Optional) The target year. Defaults to the current year.
 * @param {Object} req.user - The authenticated user object (provided by authentication middleware).
 * @param {number|string} req.user.id - The ID of the authenticated user.
 * @param {Object} res - The Express response object.
 * @returns {Promise<Object>} Returns a JSON response containing `currentExpense`, `previousExpense`, the percentage change, and the `trend` (status 200),
 *                            or a server error message if the query/calculation fails (status 500).
 */
const getMonthOverMonthComparison = async (req, res) => {
    try {
        const { month, year } = req.query;

        const currentDate = new Date();
        const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const targetYear = year ? parseInt(year) : currentDate.getFullYear();

        const currentStartDate = new Date(targetYear, targetMonth - 1, 1);
        const currentEndDate = new Date(targetYear, targetMonth, 0);

        const prevStartDate = new Date(targetYear, targetMonth - 2, 1);
        const prevEndDate = new Date(targetYear, targetMonth - 1, 0);

        const currentTransactions = await Transaction.findAll({
            where: {
                userId: req.user.id,
                date: {
                    [Op.between]: [currentStartDate, currentEndDate]
                }
            },
            include: [{
                model: Category,
                where: { type: 'expense' },
                attributes: []
            }]
        });

        const prevTransactions = await Transaction.findAll({
            where: {
                userId: req.user.id,
                date: {
                    [Op.between]: [prevStartDate, prevEndDate]
                }
            },
            include: [{
                model: Category,
                where: { type: 'expense' },
                attributes: []
            }]
        });

        const currentExpense = currentTransactions.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
        const previousExpense = prevTransactions.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

        let percentage = 0;
        let trend = 'flat';

        if(previousExpense === 0) {
            percentage = currentExpense > 0 ? 100 : 0;
        } else {
            percentage = ((currentExpense - previousExpense) / previousExpense) * 100;
        }

        percentage = Math.round(percentage * 100) / 100;

        if(percentage > 0) {
            trend = 'up';
        } else if(percentage < 0) {
            trend = 'down';
        }

        res.status(200).json({
            currentExpense,
            previousExpense,
            percentage,
            trend
        });

    } catch (error) {
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
}

/**
 * Retrieves the top 5 highest expenses for a specific month and year.
 * 
 * The function fetches expense transactions for the authenticated user within 
 * the specified timeframe (defaulting to the current month if not provided). 
 * It orders the transactions by amount in descending order and limits the 
 * result to the top 5 largest expenses.
 *
 * @async
 * @function getTopExpenses
 * @param {Object} req - The Express request object.
 * @param {Object} req.query - The URL query parameters for timeframe selection.
 * @param {string|number} [req.query.month] - (Optional) The target month (1-12). Defaults to the current month.
 * @param {string|number} [req.query.year] - (Optional) The target year. Defaults to the current year.
 * @param {Object} req.user - The authenticated user object (provided by authentication middleware).
 * @param {number|string} req.user.id - The ID of the authenticated user.
 * @param {Object} res - The Express response object.
 * @returns {Promise<Object>} Returns a JSON array containing up to 5 of the highest expense transaction objects (status 200),
 *                            or a server error message if the database query fails (status 500).
 */
const getTopExpenses = async (req, res) => {
    try {
        const { month, year } = req.query;

        const currentDate = new Date();
        const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const targetYear = year ? parseInt(year) : currentDate.getFullYear();

        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0);

        const topExpenses = await Transaction.findAll({
            where: {
                userId: req.user.id,
                date: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: [
                {
                    model: Category,
                    attributes: ['name', 'iconFile', 'type'],
                    where: { type: 'expense' }
                }
            ],
            order: [
                ['amount', 'DESC']
            ],
            limit: 5
        });

        res.status(200).json(topExpenses);

    } catch (error) {
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
};

/**
 * Retrieves the 5 most recent transactions for the authenticated user.
 * 
 * The function fetches the user's latest transactions from the database, 
 * including their associated category details. The results are sorted primarily 
 * by transaction date and secondarily by creation time in descending order, 
 * limiting the output to the 5 most recent entries.
 *
 * @async
 * @function getRecentTransactions
 * @param {Object} req - The Express request object.
 * @param {Object} req.user - The authenticated user object (provided by authentication middleware).
 * @param {number|string} req.user.id - The ID of the authenticated user.
 * @param {Object} res - The Express response object.
 * @returns {Promise<Object>} Returns a JSON array containing up to 5 of the most recent transaction objects (status 200),
 *                            or a server error message if the database query fails (status 500).
 */
const getRecentTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.findAll({
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
                ['date', 'DESC'],
                ['createdAt', 'DESC']
            ],
            limit: 5
        });

        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
}

/**
 * Calculates the user's daily spending average for a specific month and year.
 * 
 * The function determines the total expenses for the selected timeframe and divides 
 * them by the number of days elapsed. If the target is the current month, it divides 
 * by the current day of the month; otherwise, it divides by the total number of 
 * days in that month.
 *
 * @async
 * @function getDailyAverage
 * @param {Object} req - The Express request object.
 * @param {Object} req.query - The URL query parameters for timeframe selection.
 * @param {string|number} [req.query.month] - (Optional) The target month (1-12). Defaults to the current month.
 * @param {string|number} [req.query.year] - (Optional) The target year. Defaults to the current year.
 * @param {Object} req.user - The authenticated user object (provided by authentication middleware).
 * @param {number|string} req.user.id - The ID of the authenticated user.
 * @param {Object} res - The Express response object.
 * @returns {Promise<Object>} Returns a JSON response with the calculated `dailyAverage` (status 200),
 *                            or a server error message if the calculation fails (status 500).
 */
export const getDailyAverage = async (req, res) => {
    try {
        const { month, year } = req.query;

        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        const targetMonth = month ? parseInt(month) : currentMonth;
        const targetYear = year ? parseInt(year) : currentYear;

        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0);

        const expenses = await Transaction.findAll({
            where: {
                userId: req.user.id,
                date: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: [{
                model: Category,
                where: { type: 'expense' },
                attributes: []
            }]
        });

        const totalExpense = expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

        let daysToDivide;
        if (targetMonth === currentMonth && targetYear === currentYear) {
            daysToDivide = currentDate.getDate();
        } else {
            daysToDivide = endDate.getDate();
        }

        let dailyAverage = totalExpense / daysToDivide;
        dailyAverage = Math.round(dailyAverage * 100) / 100;

        res.status(200).json({ dailyAverage });

    } catch (error) {
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
};

/**
 * Helper function to generate mock bank transactions for the last 6 months.
 * It iterates through every single day of the past 6 months and generates 
 * between 1 and 3 random transactions per day using a predefined list of merchants.
 * * @returns {Array} An array of raw transaction objects sorted by date (newest first).
 */
const generateMockBankData = () => {
    const merchants = [
            'Lidl', 'Kaufland', 'Mega Image', 'Carrefour', 'Auchan', 'Profi', 'Penny', 'Freshful',
            'Uber', 'Bolt', 'OMV', 'Petrom', 'Rompetrol', 'MOL', 'CFR Călători', 'STB',
            'Netflix', 'Spotify', 'Cinema City', 'Steam', 'HBO Max', 'Disney+', 'PlayStation',
            'E.ON', 'Enel', 'Digi', 'Vodafone', 'Orange', 'Telekom', 'Engie', 'Hidroelectrica',
            'Zara', 'H&M', 'Nike', 'Emag', 'Altex', 'Flanco', 'PC Garage', 'Notino', 'Sephora',
            'KFC', 'McDonalds', 'Starbucks', 'Glovo', 'Tazz', 'Burger King', 'Pizza Hut',
            'Regina Maria', 'MedLife', 'Sanador', 'Farmacia Tei', 'Catena', 'Dr. Max', 'Help Net',
            'World Class', 'Stay Fit', 'Decathlon', 'ESX',
            'Dedeman', 'IKEA', 'Leroy Merlin', 'Jysk', 'Brico Depot',
            'Booking.com', 'Airbnb', 'Wizz Air', 'Ryanair', 'Tarom'
    ];

    const incomeSources = [
        'IT Corp LLC Salary',       
        'Upwork Freelancing',       
        'Fiverr Contract',          
        'Stock Market Dividends',   
        'Tax Refund'                
    ];

    const transactions = [];
    const endDate = new Date();
    const startDate = new Date();
    
    // Set for 7 full months
    startDate.setMonth(startDate.getMonth() - 7);

    let currentMonthTracker = -1;
    
    // Loop through every single day
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        
        // 1. Generate INCOMES (once per month)
        if (d.getMonth() !== currentMonthTracker) {
            currentMonthTracker = d.getMonth(); 
            
            // 1 to 2 incomes per month
            const incomesThisMonth = Math.floor(Math.random() * 2) + 1; 
            
            for(let j = 0; j < incomesThisMonth; j++) {
                const source = incomeSources[Math.floor(Math.random() * incomeSources.length)];
                const amount = (Math.random() * (9000 - 3000) + 3000).toFixed(2); 
                
                const txDate = new Date(d);
                txDate.setHours(9, 30); 

                transactions.push({
                    title: source,
                    description: 'Monthly income deposit',
                    amount: parseFloat(amount),
                    date: txDate,
                    source: 'bank'
                });
            }
        }

        // 2. Generate EXPENSES
        const expensesToday = Math.floor(Math.random() * 4) + 2; 

        for (let i = 0; i < expensesToday; i++) {
            const merchant = merchants[Math.floor(Math.random() * merchants.length)];
            const amount = (Math.random() * (300 - 15) + 15).toFixed(2);
            
            const txDate = new Date(d);
            txDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

            transactions.push({
                title: merchant,
                description: `POS Transaction - ${merchant}`,
                amount: parseFloat(amount),
                date: txDate,
                source: 'bank'
            });
        }
    }

    // Sort descending by date
    return transactions.sort((a, b) => b.date - a.date);
};

/**
 * Endpoint to import mock bank transactions and categorize them using the new Gemini AI SDK.
 * It optimizes the AI prompt by only requesting categorization for unique merchants,
 * mapping them to the user's available category IDs.
 *
 * @async
 * @function importBankTransactions
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @returns {Promise<Object>} JSON response confirming the successful import.
 */
const importBankTransactions = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);

        if (user.hasImportedBankData) {
            return res.status(400).json({ errorCode: 'ALREADY_IMPORTED' });
        }

        const rawTransactions = generateMockBankData();

        // 1. Extract unique merchants to optimize the AI prompt payload
        const uniqueMerchants = [...new Set(rawTransactions.map(tx => tx.title))];

        // 2. Fetch all available categories for this user (both global and custom)
        const categories = await Category.findAll({
            where: {
                [Op.or]: [
                    { userId: req.user.id },
                    { userId: null }
                ]
            }
        });

        const categoryMap = categories.map(cat => ({ 
            id: cat.id, 
            name: cat.name,
            type: cat.type 
        }));
        const fallbackCategoryId = categories.length > 0 ? categories[0].id : null;

        if (!fallbackCategoryId) {
            return res.status(400).json({ errorCode: 'NO_CATEGORIES_FOUND' });
        }

        // 3. Initialize the new Google Gen AI client
        // It automatically uses process.env.GEMINI_API_KEY if not explicitly passed, 
        // but passing it explicitly is safer.
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const prompt = `
        You are a financial API categorization tool.
        I will provide a list of merchant names and a list of available categories with their IDs.
        Your task is to match each merchant to the single most appropriate category ID.
        
        Merchants: ${JSON.stringify(uniqueMerchants)}
        Categories: ${JSON.stringify(categoryMap)}
        
        Rules:
        - Return ONLY a raw JSON object.
        - The keys must be the exact merchant names.
        - The values must be the integer category ID.
        - Do NOT include markdown code blocks (\`\`\`json) or any conversational text.
        `;

        // 4. Send request to Gemini using the new SDK syntax
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        let responseText = response.text;
        
        // Strip markdown backticks in case the AI includes them despite instructions
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        const merchantCategoryMapping = JSON.parse(responseText);

        // 5. Apply the AI mapping to all raw transactions
        const finalTransactions = rawTransactions.map(tx => {
            const mappedCategoryId = merchantCategoryMapping[tx.title];
            
            return {
                amount: tx.amount,
                date: tx.date,
                title: tx.title,
                description: tx.description,
                categoryId: mappedCategoryId || fallbackCategoryId, // Fallback if AI misses one
                source: tx.source,
                userId: req.user.id
            };
        });

        // 6. Save everything to the database in one big batch query
        await Transaction.bulkCreate(finalTransactions);

        // 7. Lock the import feature for this user
        user.hasImportedBankData = true;
        await user.save();

        res.status(200).json({
            message: "Bank data imported and categorized successfully.",
            count: finalTransactions.length
        });

    } catch (error) {
        console.error("Error at importBankTransactions:", error);
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
};

/**
 * Endpoint called at login to generate missing transactions up to the current day,
 * BUT only if the user has already performed the initial bank data import.
 *
 * @async
 * @function syncDailyTransactions
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 */
const syncDailyTransactions = async (req, res) => {
    try {
        // 1. Check if the user has performed the initial bank data import
        const user = await User.findByPk(req.user.id);
        
        if (!user.hasImportedBankData) {
            // Return 200 OK to prevent login errors; simply inform that no sync is needed.
            return res.status(200).json({ 
                message: "Bank synchronization is not enabled for this account.", 
                count: 0 
            });
        }

        const currentDate = new Date();
        currentDate.setHours(23, 59, 59, 999);

        // 2. Find the user's most recent transaction
        const lastTransaction = await Transaction.findOne({
            where: { userId: req.user.id },
            order: [['date', 'DESC']]
        });

        // If the flag is true but there are no transactions, stop execution to prevent errors.
        if (!lastTransaction || !lastTransaction.date) {
            return res.status(200).json({ 
                message: "No transaction history found for synchronization.", 
                count: 0 
            });
        }

        // 3. Set the start date: the day after the last recorded transaction
        let startDate = new Date(lastTransaction.date);
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(0, 0, 0, 0);

        // If we are already up to date, stop execution
        if (startDate > currentDate) {
            return res.status(200).json({ 
                message: "The account is already up to date.", 
                count: 0 
            });
        }

        // 4. Generate raw mock transactions for the missing days
        const merchants = [
            'Lidl', 'Kaufland', 'Mega Image', 'Carrefour', 'Auchan', 'Profi', 'Penny', 'Freshful',
            'Uber', 'Bolt', 'OMV', 'Petrom', 'Rompetrol', 'MOL', 'CFR Călători', 'STB',
            'Netflix', 'Spotify', 'Cinema City', 'Steam', 'HBO Max', 'Disney+', 'PlayStation',
            'E.ON', 'Enel', 'Digi', 'Vodafone', 'Orange', 'Telekom', 'Engie', 'Hidroelectrica',
            'Zara', 'H&M', 'Nike', 'Emag', 'Altex', 'Flanco', 'PC Garage', 'Notino', 'Sephora',
            'KFC', 'McDonalds', 'Starbucks', 'Glovo', 'Tazz', 'Burger King', 'Pizza Hut',
            'Regina Maria', 'MedLife', 'Sanador', 'Farmacia Tei', 'Catena', 'Dr. Max', 'Help Net',
            'World Class', 'Stay Fit', 'Decathlon', 'ESX',
            'Dedeman', 'IKEA', 'Leroy Merlin', 'Jysk', 'Brico Depot',
            'Booking.com', 'Airbnb', 'Wizz Air', 'Ryanair', 'Tarom'
        ];

        const incomeSources = [
            'IT Corp LLC Salary', 
            'Upwork Freelancing', 
            'Fiverr Contract', 
            'Stock Market Dividends', 
            'Tax Refund'
        ];

        const rawTransactions = [];
        
        // Tracking the month to know when to inject incomes during sync
        let currentMonthTracker = startDate.getMonth() - 1; 

        for (let d = new Date(startDate); d <= currentDate; d.setDate(d.getDate() + 1)) {
            
            // 4a. Incomes generation
            if (d.getMonth() !== currentMonthTracker) {
                currentMonthTracker = d.getMonth(); 
                
                const incomesThisMonth = Math.floor(Math.random() * 2) + 1; 
                
                for(let j = 0; j < incomesThisMonth; j++) {
                    const source = incomeSources[Math.floor(Math.random() * incomeSources.length)];
                    const amount = (Math.random() * (9000 - 3000) + 3000).toFixed(2); 
                    
                    const txDate = new Date(d);
                    txDate.setHours(9, 30); 
    
                    rawTransactions.push({
                        title: source,
                        description: 'Monthly income deposit',
                        amount: parseFloat(amount),
                        date: txDate,
                        source: 'bank'
                    });
                }
            }

            // 4b. Expenses generation (Updated to 2-5 per day)
            const expensesToday = Math.floor(Math.random() * 4) + 2; 

            for (let i = 0; i < expensesToday; i++) {
                const merchant = merchants[Math.floor(Math.random() * merchants.length)];
                const amount = (Math.random() * (250 - 15) + 15).toFixed(2); 
                
                const txDate = new Date(d);
                txDate.setHours(Math.floor(Math.random() * 20) + 6, Math.floor(Math.random() * 60));

                rawTransactions.push({
                    title: merchant,
                    description: `POS Transaction - ${merchant}`,
                    amount: parseFloat(amount),
                    date: txDate,
                    source: 'bank'
                });
            }
        }

        if (rawTransactions.length === 0) {
            return res.status(200).json({ 
                message: "No new transactions to generate.", 
                count: 0 
            });
        }

        // 5. Categorize transactions using Google Gemini AI
        const uniqueMerchants = [...new Set(rawTransactions.map(tx => tx.title))];
        const categories = await Category.findAll({
            where: { [Op.or]: [{ userId: req.user.id }, { userId: null }] }
        });

        const categoryMap = categories.map(cat => ({ id: cat.id, name: cat.name, type: cat.type }));
        const fallbackCategoryId = categories.length > 0 ? categories[0].id : null;

        if (!fallbackCategoryId) {
             return res.status(400).json({ errorCode: 'NO_CATEGORIES_FOUND' });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `
        You are a financial API categorization tool.
        I will provide a list of merchant names and a list of available categories with their IDs.
        Your task is to match each merchant to the single most appropriate category ID.
        
        Merchants: ${JSON.stringify(uniqueMerchants)}
        Categories: ${JSON.stringify(categoryMap)}
        
        Rules:
        - Return ONLY a raw JSON object.
        - The keys must be the exact merchant names.
        - The values must be the integer category ID.
        - Do NOT include markdown code blocks (\`\`\`json) or any conversational text.
        `;

        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        let responseText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const merchantCategoryMapping = JSON.parse(responseText);

        // 6. Map the AI results and save transactions to the database
        const finalTransactions = rawTransactions.map(tx => ({
            amount: tx.amount,
            date: tx.date,
            title: tx.title,
            description: tx.description,
            categoryId: merchantCategoryMapping[tx.title] || fallbackCategoryId,
            source: tx.source,
            userId: req.user.id
        }));

        await Transaction.bulkCreate(finalTransactions);

        res.status(200).json({
            message: `Daily sync complete. Added ${finalTransactions.length} transactions.`,
            count: finalTransactions.length
        });

    } catch (error) {
        console.error("Error at syncDailyTransactions:", error);
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
};

const getGlobalAvailableBalance = async (req, res) => {
    try {
        const transactions = await Transaction.findAll({
            where: { userId: req.user.id },
            include: [{ model: Category, attributes: ['type'] }]
        });

        let totalIncome = 0;
        let totalExpense = 0;

        transactions.forEach(transaction => {
            const amount = parseFloat(transaction.amount);
            if(transaction.Category.type === 'income') {
                totalIncome += amount;
            } else if(transaction.Category.type === 'expense') {
                totalExpense += amount;
            }
        });

        const savings = await SavingsGoal.findAll({
            where: { userId: req.user.id }
        });

        const totalSaved = savings.reduce((acc, goal) => acc + parseFloat(goal.currentAmount), 0);

        const availableBalance = totalIncome - totalExpense - totalSaved;

        res.status(200).json({
            totalIncome,
            totalExpense,
            totalSaved,
            availableBalance
        });
    } catch (error) {
        res.status(500).json({ errorCode: 'SERVER_ERROR', error: error.message });
    }
}


export default { 
    getTransactions, 
    addTransaction, 
    deleteTransaction, 
    getMonthlyTotals,
    getExpenseBreakdown,
    getSevenMonthsTrend,
    getMonthOverMonthComparison,
    getTopExpenses,
    getRecentTransactions,
    getDailyAverage,
    importBankTransactions,
    syncDailyTransactions,
    getGlobalAvailableBalance
 };