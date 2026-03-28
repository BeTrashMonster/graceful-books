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
const BetaSignup = lazy(() => import('../pages/auth/BetaSignup'))
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('../pages/auth/ResetPassword'))
const CheckoutSuccess = lazy(() => import('../pages/checkout/CheckoutSuccess'))
const CheckoutCancel = lazy(() => import('../pages/checkout/CheckoutCancel'))
const Onboarding = lazy(() => import('../pages/onboarding/Onboarding'))
const Assessment = lazy(() => import('../pages/onboarding/Assessment'))
const Setup = lazy(() => import('../pages/onboarding/Setup'))
const Reconciliation = lazy(() => import('../pages/Reconciliation'))
const AccountRegisterPage = lazy(() => import('../pages/AccountRegisterPage'))
const NotFound = lazy(() => import('../pages/NotFound'))
const Forbidden = lazy(() => import('../pages/Forbidden'))
const AdminCharities = lazy(() => import('../pages/admin/AdminCharities'))
const AdminLogin = lazy(() => import('../pages/admin/AdminLogin'))
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'))
const DevTools = lazy(() => import('../pages/DevTools'))

// CPG Module Pages
const CPGDashboard = lazy(() => import('../pages/cpg/CPGDashboard'))
const FinishedProducts = lazy(() => import('../pages/cpg/FinishedProducts'))
const CPUTracker = lazy(() => import('../pages/cpg/CPUTracker'))
const Distribution = lazy(() => import('../pages/cpg/Distribution'))
const SalesPromoDecisionTool = lazy(() => import('../pages/cpg/SalesPromoDecisionTool'))
const EventsAnalysis = lazy(() => import('../pages/cpg/EventsAnalysis'))
const FinancialStatementEntry = lazy(() => import('../pages/cpg/FinancialStatementEntry'))
const ScenarioPlanning = lazy(() => import('../pages/cpg/ScenarioPlanning'))
const LaborRoles = lazy(() => import('../pages/cpg/LaborRoles'))
const CPGSettings = lazy(() => import('../pages/cpg/CPGSettings'))
const CompanyProfile = lazy(() => import('../pages/cpg/CompanyProfile'))

// CPG Reports
const CPGProfitLoss = lazy(() => import('../pages/cpg/reports/CPGProfitLoss'))
const DistributionCostReport = lazy(() => import('../pages/cpg/reports/DistributionCostReport'))
const GrossMarginReport = lazy(() => import('../pages/cpg/reports/GrossMarginReport'))
const TradeSpendReport = lazy(() => import('../pages/cpg/reports/TradeSpendReport'))

// Test Pages
const LoaderTest = lazy(() => import('../pages/LoaderTest'))

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/beta-signup" element={<BetaSignup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout/cancel" element={<CheckoutCancel />} />

        {/* Admin routes (no layout) */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />

        {/* Developer tools - accessible without full layout */}
        <Route path="/dev-tools" element={<DevTools />} />
        <Route path="/developer-tools" element={<DevTools />} />
        <Route path="/loader-test" element={<LoaderTest />} />

        {/* Onboarding routes */}
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/onboarding/assessment" element={<Assessment />} />
        <Route path="/onboarding/setup" element={<Setup />} />

        {/* Protected routes with layout - Bookkeeping Suite only */}
        <Route element={<ProtectedRoute requireProduct="bookkeeping-suite"><MainLayout /></ProtectedRoute>}>
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

        {/* CPG Module - Protected routes with CPG-specific layout - CPG Tool only */}
        <Route element={<ProtectedRoute requireProduct="cpu-cpg-calculator"><CPGLayout /></ProtectedRoute>}>
          <Route path="/cpg" element={<CPGDashboard />} />
          <Route path="/cpg/dashboard" element={<CPGDashboard />} />
          <Route path="/cpg/products" element={<FinishedProducts />} />
          <Route path="/cpg/cpu-tracker" element={<CPUTracker />} />
          <Route path="/cpg/distribution-cost" element={<Distribution />} />
          <Route path="/cpg/promo-decision" element={<SalesPromoDecisionTool />} />
          <Route path="/cpg/events-analysis" element={<EventsAnalysis />} />
          <Route path="/cpg/financial-entry" element={<FinancialStatementEntry />} />
          <Route path="/cpg/strategy-planning" element={<ScenarioPlanning />} />
          <Route path="/cpg/labor-roles" element={<LaborRoles />} />
          <Route path="/cpg/company-profile" element={<CompanyProfile />} />
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
