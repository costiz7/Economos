import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Home from "./Home/Home.jsx"
import ProtectedRoute from "./ProtectedRoute.jsx";
import MainLayout from "./MainLayout/MainLayout.jsx";
import DashboardContent from "./DashboardContent/DashboardContent.jsx";
import TransactionsContent from "./TransactionsContent/TransactionsContent.jsx";
import StatisticsContent from "./StatisticsContent/StatisticsContent.jsx";
import SettingsContent from "./SettingsContent/SettingsContent.jsx";
import BudgetsContent from "./BudgetsContent/BudgetsContent.jsx";
import SavingsContent from "./SavingsContent/SavingsContent.jsx";

function App() {

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={ < Home/> } />

          <Route element={ <ProtectedRoute/> }>
            <Route element={ <MainLayout /> }>
              <Route path="/dashboard" element={ <DashboardContent /> }/>
              <Route path="/transactions" element={ <TransactionsContent /> }/>
              <Route path="/statistics" element={ <StatisticsContent /> }/>
              <Route path="/savings" element={ <SavingsContent /> }/>
              <Route path="/budgets" element={ <BudgetsContent /> } />
              <Route path="/myprofile" element=""/>
              <Route path="/settings" element={ <SettingsContent /> }/>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
