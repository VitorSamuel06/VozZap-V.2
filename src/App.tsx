import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'

// Pages
import LoginPage from '@/pages/LoginPage'
import SignupPage from '@/pages/SignupPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import FeedPage from '@/pages/FeedPage'
import ProfilePage from '@/pages/ProfilePage'
import SearchPage from '@/pages/SearchPage'
import MessagesPage from '@/pages/MessagesPage'
import NotificationsPage from '@/pages/NotificationsPage'
import EditProfilePage from '@/pages/EditProfilePage'
import PublishPage from '@/pages/PublishPage'
import NotFoundPage from '@/pages/NotFoundPage'

// Layout
import Layout from '@/components/layout/Layout'

// Loading component
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#ECE5DD] dark:bg-[#0D1117] flex flex-col items-center justify-center gap-4">
      <div className="w-20 h-20 bg-[#25D366] rounded-3xl flex items-center justify-center shadow-xl animate-pulse">
        <span className="text-4xl">🎙️</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold text-[#111827] dark:text-[#E6E6E6]">VozZap</h1>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 bg-[#25D366] rounded-full animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />

  return <Layout>{children}</Layout>
}

// Public Route (redirects authenticated users)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()

  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/feed" replace />

  return <>{children}</>
}

export default function App() {
  const { setLoading } = useAuthStore()
  // Initialize theme
  useThemeStore()

  useEffect(() => {
    // Simulate auth check
    const timer = setTimeout(() => {
      setLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [setLoading])

  return (
    <BrowserRouter>
      <div className="theme-transition">
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <SignupPage />
              </PublicRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPasswordPage />
              </PublicRoute>
            }
          />

          {/* Protected Routes - profile/edit MUST come before profile/:username */}
          <Route
            path="/profile/edit"
            element={
              <ProtectedRoute>
                <EditProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/feed"
            element={
              <ProtectedRoute>
                <FeedPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/:username"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <MessagesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/publish"
            element={
              <ProtectedRoute>
                <PublishPage />
              </ProtectedRoute>
            }
          />

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/feed" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
