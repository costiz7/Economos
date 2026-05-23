import { Router } from "express";
import tokenCheck from "../middleware/tokenCheck.js";
import usersController from "./controllers/usersController.js";
import categoriesController from "./controllers/categoriesController.js";
import transactionsController from "./controllers/transactionsController.js";
import budgetsController from "./controllers/budgetsController.js";
import savingsController from "./controllers/savingsController.js";

//Check the README for a in-depth guide to these endpoints

//This router 'routes' all the api requests
const router = Router();

//Before fulfilling requests, we check who the user is and if it is authorized (by case)
router.use(tokenCheck);

//User routes
router.get('/user', usersController.getProfile);
router.patch('/user', usersController.updateProfile);

//Categories routes
router.get('/categories', categoriesController.getAllCategories);
router.post('/categories', categoriesController.createCategory);
router.patch('/categories/:id', categoriesController.updateCategory);
router.delete('/categories/:id', categoriesController.deleteCategory);

//Transactions routes
router.get('/transactions', transactionsController.getTransactions);
router.post('/transactions', transactionsController.addTransaction);
router.get('/transactions/totals', transactionsController.getMonthlyTotals);
router.get('/transactions/breakdown', transactionsController.getExpenseBreakdown);
router.get('/transactions/trend', transactionsController.getSevenMonthsTrend);
router.get('/transactions/mom', transactionsController.getMonthOverMonthComparison);
router.get('/transactions/top', transactionsController.getTopExpenses);
router.get('/transactions/recent', transactionsController.getRecentTransactions);
router.get('/transactions/average', transactionsController.getDailyAverage);
router.delete('/transactions/:id', transactionsController.deleteTransaction);
router.post('/transactions/import-bank', transactionsController.importBankTransactions);
router.post('/transactions/dailysync', transactionsController.syncDailyTransactions);
router.get('/transactions/global-balance', transactionsController.getGlobalAvailableBalance);

//Budget Routes
router.post('/budgets', budgetsController.createBudget);
router.get('/budgets', budgetsController.getMyBudgets);
router.get('/budgets/status', budgetsController.checkBudgetStatus);
router.patch('/budgets/:id', budgetsController.modifyBudget);
router.delete('/budgets/:id', budgetsController.deleteBudget);

//Saving Goals Routes
router.post('/savings', savingsController.createGoal);
router.get('/savings', savingsController.getGoals);
router.patch('/savings/:id/add', savingsController.addFunds);
router.patch('/savings/:id/withdraw', savingsController.withdrawFunds);
router.delete('/savings/:id', savingsController.deleteGoal);

export default router;