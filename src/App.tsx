import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/shared/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { DashboardPage } from './pages/DashboardPage'
import { FinancePage } from './pages/FinancePage'
import { InvoicesPage } from './pages/InvoicesPage'
import { InvoicesNewPage } from './pages/InvoicesNewPage'
import { CustomersPage } from './pages/CustomersPage'
import { CustomerDetail } from './pages/CustomerDetail'
import { Statement } from './pages/Statement'
import { AccountsPage } from './pages/AccountsPage'
import { ProductsPage } from './pages/ProductsPage'
import { DealsPage } from './pages/DealsPage'
import { QuotesPage } from './pages/QuotesPage'
import { SettingsPage } from './pages/SettingsPage'
import { Activities } from './pages/Activities'
import { ForgotPassword } from './pages/ForgotPassword'
import { UpdatePassword } from './pages/UpdatePassword'
import { PublicQuote } from './pages/public/PublicQuote'
import { PublicInvoice } from './pages/public/PublicInvoice'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/update-password" element={<UpdatePassword />} />
            <Route path="/p/quote/:token" element={<PublicQuote />} />
            <Route path="/p/invoice/:token" element={<PublicInvoice />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finans"
              element={
                <ProtectedRoute>
                  <FinancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/faturalar"
              element={
                <ProtectedRoute>
                  <InvoicesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices/new"
              element={
                <ProtectedRoute>
                  <InvoicesNewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/firsatlar"
              element={
                <ProtectedRoute>
                  <DealsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/aktiviteler"
              element={
                <ProtectedRoute>
                  <Activities />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teklifler"
              element={
                <ProtectedRoute>
                  <QuotesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/urun-hizmet"
              element={
                <ProtectedRoute>
                  <ProductsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/musteriler"
              element={
                <ProtectedRoute>
                  <CustomersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:id"
              element={
                <ProtectedRoute>
                  <CustomerDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:id/statement"
              element={
                <ProtectedRoute>
                  <Statement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kasa-banka"
              element={
                <ProtectedRoute>
                  <AccountsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ayarlar"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
