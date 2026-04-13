import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import { logger } from './lib/logger'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import { AppShell } from './components/layout/AppShell'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { Button } from './components/ui/Button'
import { lazy, Suspense } from 'react'
import { LoadingSpinner } from './components/ui/LoadingSpinner'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const QueuePage = lazy(() => import('./pages/queue/QueuePage'))
const RunsListPage = lazy(() => import('./pages/runs/RunsListPage'))
const RunDetailPage = lazy(() => import('./pages/runs/RunDetailPage'))
const ActiveRunPage = lazy(() => import('./pages/runs/ActiveRunPage'))
const IngredientsListPage = lazy(() => import('./pages/admin/ingredients/IngredientsListPage'))
const IngredientFormPage = lazy(() => import('./pages/admin/ingredients/IngredientFormPage'))
const FormulasListPage = lazy(() => import('./pages/admin/formulas/FormulasListPage'))
const FormulaDetailPage = lazy(() => import('./pages/admin/formulas/FormulaDetailPage'))
const FormulaEditorPage = lazy(() => import('./pages/admin/formulas/FormulaEditorPage'))
const UsersListPage = lazy(() => import('./pages/admin/users/UsersListPage'))
const UserFormPage = lazy(() => import('./pages/admin/users/UserFormPage'))
const UserEditPage = lazy(() => import('./pages/admin/users/UserEditPage'))
const FieldTemplatesPage = lazy(() => import('./pages/admin/field-templates/FieldTemplatesPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
    mutations: {
      onError: (error) => logger.error('mutation', error.message, error),
    },
  },
})

function PageLoading() {
  return <LoadingSpinner text="Loading page..." />
}

function ErrorFallback({ error, resetErrorBoundary }: { error: unknown; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-sm text-gray-500 mb-4">{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
        <Button onClick={resetErrorBoundary}>Try Again</Button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <Suspense fallback={<PageLoading />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />

                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppShell />}>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/queue" element={<QueuePage />} />
                      <Route path="/runs" element={<RunsListPage />} />
                      <Route path="/runs/:id" element={<RunDetailPage />} />
                      <Route path="/runs/:id/execute" element={<ActiveRunPage />} />

                      {/* Admin routes */}
                      <Route element={<ProtectedRoute requiredRole="admin" />}>
                        <Route path="/admin/ingredients" element={<IngredientsListPage />} />
                        <Route path="/admin/ingredients/new" element={<IngredientFormPage />} />
                        <Route path="/admin/ingredients/:id" element={<IngredientFormPage />} />
                        <Route path="/admin/formulas" element={<FormulasListPage />} />
                        <Route path="/admin/formulas/new" element={<FormulaEditorPage />} />
                        <Route path="/admin/formulas/:id" element={<FormulaDetailPage />} />
                        <Route path="/admin/formulas/:id/edit" element={<FormulaEditorPage />} />
                        <Route path="/admin/users" element={<UsersListPage />} />
                        <Route path="/admin/users/new" element={<UserFormPage />} />
                        <Route path="/admin/users/:id" element={<UserEditPage />} />
                        <Route path="/admin/field-templates" element={<FieldTemplatesPage />} />
                      </Route>
                    </Route>
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
