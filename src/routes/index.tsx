import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { AdminRoute } from './AdminRoute'
import { PageLoader } from '../components/loading/PageLoader'
import { MainLayout } from '../components/layouts/MainLayout'
import { CPGLayout } from '../components/layouts/CPGLayout'

// Lazy load page components
const Dashboard = lazy(() => import('../pages/Dashboard'))
const Transactions = lazy(() => import('../pages/Transactions'))
const Reports = lazy(() => import('../pages/Reports'))
const ProfitLoss = lazy(() => import('../pages/reports/ProfitLoss'))
const BalanceSheet = lazy(() => import('../pages/BalanceSheet'))
const CashFlow = lazy(() => import('../pages/reports/CashFlow'))
const Customers = lazy(() => import('../pages/Customers'))
const Vendors = lazy(() => import('../pages/Vendors'))
const Invoices = lazy(() => import('../pages/Invoices'))
const Receipts = lazy(() => import('../pages/Receipts'))
const ChartOfAccounts = lazy(() => import('../pages/ChartOfAccounts'))
const Checklist = lazy(() => import('../pages/Checklist'))
const CustomerPortal = lazy(() => import('../pages/CustomerPortal'))
const Settings = lazy(() => import('../pages/Settings'))
const Login = lazy(() => import('../pages/auth/Login'))
const Signup = lazy(() => import('../pages/auth/Signup'))
const Onboarding = lazy(() => import('../pages/onboarding/Onboarding'))
const Assessment = lazy(() => import('../pages/onboarding/Assessment'))
const Setup = lazy(() => import('../pages/onboarding/Setup'))
const Reconciliation = lazy(() => import('../pages/Reconciliation'))
const AccountRegisterPage = lazy(() => import('../pages/AccountRegisterPage'))
const NotFound = lazy(() => import('../pages/NotFound'))
const Forbidden = lazy(() => import('../pages/Forbidden'))
const AdminCharities = lazy(() => import('../pages/admin/AdminCharities'))
const DevTools = lazy(() => import('../pages/DevTools'))

// CPG Module Pages
const CPGDashboard = lazy(() => import('../pages/cpg/CPGDashboard'))
const FinishedProducts = lazy(() => import('../pages/cpg/FinishedProducts'))
const CPUTracker = lazy(() => import('../pages/cpg/CPUTracker'))
const DistributionCostAnalyzer = lazy(() => import('../pages/cpg/DistributionCostAnalyzer'))
const SalesPromoDecisionTool = lazy(() => import('../pages/cpg/SalesPromoDecisionTool'))
const FinancialStatementEntry = lazy(() => import('../pages/cpg/FinancialStatementEntry'))
const HistoricalAnalytics = lazy(() => import('../pages/cpg/HistoricalAnalytics'))
const ScenarioPlanning = lazy(() => import('../pages/cpg/ScenarioPlanning'))
const CPGSettings = lazy(() => import('../pages/cpg/CPGSettings'))

// CPG Reports
const CPGProfitLoss = lazy(() => import('../pages/cpg/reports/CPGProfitLoss'))
const DistributionCostReport = lazy(() => import('../pages/cpg/reports/DistributionCostReport'))
const GrossMarginReport = lazy(() => import('../pages/cpg/reports/GrossMarginReport'))
const TradeSpendReport = lazy(() => import('../pages/cpg/reports/TradeSpendReport'))

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Developer tools - accessible without full layout */}
        <Route path="/dev-tools" element={<DevTools />} />
        <Route path="/developer-tools" element={<DevTools />} />

        {/* Onboarding routes */}
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/onboarding/assessment" element={<Assessment />} />
        <Route path="/onboarding/setup" element={<Setup />} />

        {/* Protected routes with layout */}
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/accounts" element={<ChartOfAccounts />} />
          <Route path="/accounts/:accountId/register" element={<AccountRegisterPage />} />
          <Route path="/chart-of-accounts" element={<ChartOfAccounts />} />
          <Route path="/reconciliation" element={<Reconciliation />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/receipts" element={<Receipts />} />
          <Route path="/checklist" element={<Checklist />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/profit-loss" element={<ProfitLoss />} />
          <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
          <Route path="/reports/cash-flow" element={<CashFlow />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* CPG Module - Protected routes with CPG-specific layout */}
        <Route element={<ProtectedRoute><CPGLayout /></ProtectedRoute>}>
          <Route path="/cpg" element={<CPGDashboard />} />
          <Route path="/cpg/dashboard" element={<CPGDashboard />} />
          <Route path="/cpg/products" element={<FinishedProducts />} />
          <Route path="/cpg/cpu-tracker" element={<CPUTracker />} />
          <Route path="/cpg/distribution-cost" element={<DistributionCostAnalyzer />} />
          <Route path="/cpg/promo-decision" element={<SalesPromoDecisionTool />} />
          <Route path="/cpg/analytics" element={<HistoricalAnalytics />} />
          <Route path="/cpg/financial-entry" element={<FinancialStatementEntry />} />
          <Route path="/cpg/scenario-planning" element={<ScenarioPlanning />} />
          <Route path="/cpg/settings" element={<CPGSettings />} />
          <Route path="/cpg/reports/profit-loss" element={<CPGProfitLoss />} />
          <Route path="/cpg/reports/distribution-cost" element={<DistributionCostReport />} />
          <Route path="/cpg/reports/gross-margin" element={<GrossMarginReport />} />
          <Route path="/cpg/reports/trade-spend" element={<TradeSpendReport />} />
        </Route>

        {/* Customer portal - public with token auth */}
        <Route path="/portal/:token" element={<CustomerPortal />} />

        {/* Admin-only routes with layout */}
        <Route element={<AdminRoute><ProtectedRoute><MainLayout /></ProtectedRoute></AdminRoute>}>
          <Route path="/admin/charities" element={<AdminCharities />} />
        </Route>

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Error pages */}
        <Route path="/forbidden" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
