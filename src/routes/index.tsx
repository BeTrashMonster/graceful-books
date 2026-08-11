import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { AdminRoute } from './AdminRoute'
import { SmartRedirect } from './SmartRedirect'
import { PageLoader } from '../components/loading/PageLoader'
import { MainLayout } from '../components/layouts/MainLayout'
import { CPGLayout } from '../components/layouts/CPGLayout'
import { AccountLayout } from '../components/layouts/AccountLayout'

// Lazy load page components
// Note: These components appear "unused" to ESLint but are consumed by React Router.
// Do NOT prefix these variables with underscore - it breaks the import paths.
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
const Billing = lazy(() => import('../pages/Billing'))
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
const AdminCharityDashboard = lazy(() => import('../pages/admin/AdminCharityDashboard'))
const AdminLogin = lazy(() => import('../pages/admin/AdminLogin'))
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'))
const WorkshopsPage = lazy(() => import('../pages/admin/WorkshopsPage'))
const WorkshopEnrollmentsPage = lazy(() => import('../pages/admin/WorkshopEnrollmentsPage'))
const WorkshopFormPage = lazy(() => import('../pages/admin/WorkshopFormPage'))
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
const ProductSetupTest = lazy(() => import('../pages/ProductSetupTest'))
const LoadingOverlayDemo = lazy(() => import('../pages/LoadingOverlayDemo'))
const CharitySelectorTest = lazy(() => import('../pages/CharitySelectorTest'))

// Workshop Pages
const WorkshopSignupPage = lazy(() => import('../pages/workshops/WorkshopSignupPage'))
const WorkshopThankYouPage = lazy(() => import('../pages/workshops/WorkshopThankYouPage'))
const WorkshopWorksheetPage = lazy(() => import('../pages/workshops/WorkshopWorksheetPage'))
const WorkshopCountdownPage = lazy(() => import('../pages/workshops/WorkshopCountdownPage'))

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

        {/* Workshop routes - Public signup flow */}
        <Route path="/workshops/:slug" element={<WorkshopSignupPage />} />
        <Route path="/workshops/:slug/thank-you" element={<WorkshopThankYouPage />} />

        {/* Workshop routes - Temporarily public for debugging */}
        <Route path="/workshops/worksheet" element={<WorkshopWorksheetPage />} />
        <Route path="/workshops/countdown" element={<WorkshopCountdownPage />} />

        {/* Admin routes (no layout) */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/charities" element={<AdminCharityDashboard />} />
        <Route path="/admin/workshops" element={<WorkshopsPage />} />
        <Route path="/admin/workshops/new" element={<WorkshopFormPage />} />
        <Route path="/admin/workshops/:id" element={<WorkshopFormPage />} />
        <Route path="/admin/workshops/:id/enrollments" element={<WorkshopEnrollmentsPage />} />

        {/* Developer tools - accessible without full layout */}
        <Route path="/dev-tools" element={<DevTools />} />
        <Route path="/developer-tools" element={<DevTools />} />
        <Route path="/loader-test" element={<LoaderTest />} />
        <Route path="/product-setup-test" element={<ProductSetupTest />} />
        <Route path="/loading-overlay-demo" element={<LoadingOverlayDemo />} />
        <Route path="/charity-selector-test" element={<CharitySelectorTest />} />

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
        </Route>

        {/* Redirect old bookkeeping routes to shared account pages */}
        <Route path="/billing" element={<Navigate to="/account/billing" replace />} />
        <Route path="/settings" element={<Navigate to="/account/settings" replace />} />

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
          <Route path="/cpg/reports/profit-loss" element={<CPGProfitLoss />} />
          <Route path="/cpg/reports/distribution-cost" element={<DistributionCostReport />} />
          <Route path="/cpg/reports/gross-margin" element={<GrossMarginReport />} />
          <Route path="/cpg/reports/trade-spend" element={<TradeSpendReport />} />
        </Route>

        {/* Shared Account Pages - Accessible to any authenticated user */}
        {/* These are shared between CPG and Bookkeeping - single source of truth */}
        <Route element={<ProtectedRoute><AccountLayout /></ProtectedRoute>}>
          <Route path="/account/company-profile" element={<CompanyProfile />} />
          <Route path="/account/billing" element={<Billing />} />
          <Route path="/account/settings" element={<Settings />} />
        </Route>

        {/* Legacy redirects for old routes */}
        <Route path="/cpg/company-profile" element={<Navigate to="/account/company-profile" replace />} />
        <Route path="/cpg/billing" element={<Navigate to="/account/billing" replace />} />
        <Route path="/cpg/settings" element={<Navigate to="/account/settings" replace />} />
        <Route path="/company-profile" element={<Navigate to="/account/company-profile" replace />} />

        {/* /account alone redirects to company profile */}
        <Route path="/account" element={<Navigate to="/account/company-profile" replace />} />

        {/* Customer portal - public with token auth */}
        <Route path="/portal/:token" element={<CustomerPortal />} />

        {/* Admin-only routes with layout - commented out, using standalone charity dashboard */}
        {/* <Route element={<AdminRoute><ProtectedRoute><MainLayout /></ProtectedRoute></AdminRoute>}>
          <Route path="/admin/charities" element={<AdminCharities />} />
        </Route> */}

        {/* Root redirect - smart redirect based on user's products */}
        <Route path="/" element={<SmartRedirect />} />

        {/* Error pages */}
        <Route path="/forbidden" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
