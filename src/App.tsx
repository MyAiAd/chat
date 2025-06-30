import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useMultiTenantAuth } from './hooks/useMultiTenantAuth';
import { useAdminStatus } from './hooks/useAdminStatus';
import { MessageCircle, Settings, LogOut, Bot, Building2, ChevronDown } from 'lucide-react';

// Lazy load components
const Chat = lazy(() => import('./pages/Chat'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));

// Loading component
const LoadingScreen = () => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p className="text-gray-400">Loading...</p>
    </div>
  </div>
);

// Navigation component
const Navigation = () => {
  const { user, signOut, currentOrganization, userOrganizations, switchOrganization } = useMultiTenantAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/chat" className="flex items-center group hover:opacity-80 focus:outline-none">
              <Bot className="h-8 w-8 text-blue-400 mr-3 group-hover:text-blue-300 transition-colors" />
              <h1 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">AI Chat</h1>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-4">
            <Link
              to="/chat"
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/chat')
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Chat
            </Link>
            
            <Link
              to="/settings"
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/settings')
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Link>

            {/* Organization Selector */}
            {currentOrganization && userOrganizations.length > 1 && (
              <div className="relative group">
                <button className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition-colors">
                  <Building2 className="h-4 w-4 mr-2" />
                  {currentOrganization.name}
                  <ChevronDown className="h-3 w-3 ml-1" />
                </button>
                <div className="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-50">
                  {userOrganizations.map((org) => (
                    <button
                      key={org.organization_id}
                      onClick={() => switchOrganization(org.organization_id)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700 transition-colors ${
                        org.organization_id === currentOrganization?.id 
                          ? 'text-blue-400 bg-gray-700' 
                          : 'text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{org.organization.name}</span>
                        <span className="text-xs text-gray-500 capitalize">{org.role}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* User Menu */}
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-300">{user?.email}</span>
              <button
                onClick={signOut}
                className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

// Guest Navigation component for anonymous users
const GuestNavigation = () => {
  const location = useLocation();

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex items-center group">
              <Bot className="h-8 w-8 text-blue-400 mr-3" />
              <h1 className="text-xl font-bold text-white">AI Chat</h1>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white">
              <MessageCircle className="h-4 w-4 mr-2" />
              Chat
            </div>

            {/* User Status */}
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-400">Guest Mode</span>
              <Link
                to="/login"
                className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-blue-400 hover:text-blue-300 hover:bg-gray-700 transition-colors"
              >
                Admin Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

// Protected Route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useMultiTenantAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="h-[calc(100vh-4rem)]">
        {children}
      </main>
    </div>
  );
};

// Auth Layout component
const AuthLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center">
    <div className="max-w-md w-full">
      <div className="text-center mb-8">
        <Bot className="h-12 w-12 text-blue-400 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-white">AI Chat</h1>
        <p className="text-gray-400 mt-2">Secure AI conversations with multi-provider support</p>
      </div>
      {children}
    </div>
  </div>
);

function App() {
  const { user, loading: authLoading } = useMultiTenantAuth();
  const { adminExists, loading: adminLoading } = useAdminStatus();

  console.log('App.tsx: Auth state - authLoading:', authLoading, 'adminLoading:', adminLoading, 'user:', user?.email || 'none', 'adminExists:', adminExists);

  // Show loading screen while checking authentication and admin status
  if (authLoading || adminLoading) {
    console.log('App.tsx: Still loading, showing loading screen');
    return <LoadingScreen />;
  }

  // If no admin exists yet, require login for first-time setup
  if (!adminExists) {
    console.log('App.tsx: No admin exists, requiring login for first-time setup');
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route 
            path="/login" 
            element={
              !user ? (
                <AuthLayout>
                  <Login />
                </AuthLayout>
              ) : (
                <Navigate to="/chat" replace />
              )
            } 
          />
          <Route 
            path="/register" 
            element={
              !user ? (
                <AuthLayout>
                  <Register />
                </AuthLayout>
              ) : (
                <Navigate to="/chat" replace />
              )
            } 
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to={user ? "/chat" : "/login"} replace />} />
          <Route path="*" element={<Navigate to={user ? "/chat" : "/login"} replace />} />
        </Routes>
      </Suspense>
    );
  }

  // Admin exists - allow anonymous access to chat, require auth for settings
  console.log('App.tsx: Admin exists, allowing anonymous access to chat');
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Auth Routes - Only for admin access */}
        <Route 
          path="/login" 
          element={
            !user ? (
              <AuthLayout>
                <Login />
              </AuthLayout>
            ) : (
              <Navigate to="/chat" replace />
            )
          } 
        />
        <Route 
          path="/register" 
          element={
            !user ? (
              <AuthLayout>
                <Register />
              </AuthLayout>
            ) : (
              <Navigate to="/chat" replace />
            )
          } 
        />

        {/* Public Chat Route - No authentication required */}
        <Route
          path="/chat"
          element={
            <div className="min-h-screen bg-gray-900">
              <GuestNavigation />
              <main className="h-[calc(100vh-4rem)]">
                <Chat />
              </main>
            </div>
          }
        />

        {/* Protected Settings Route - Admin only */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App; 