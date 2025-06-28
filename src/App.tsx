import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { MessageCircle, Settings, LogOut, Bot } from 'lucide-react';

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
  const { user, signOut } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Bot className="h-8 w-8 text-blue-400 mr-3" />
            <h1 className="text-xl font-bold text-white">AI Chat</h1>
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

// Protected Route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

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
  const { user, loading } = useAuth();

  console.log('App.tsx: Auth state - loading:', loading, 'user:', user?.email || 'none');

  // Show loading screen while authentication state is being determined
  if (loading) {
    console.log('App.tsx: Auth still loading, showing loading screen');
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Auth Routes */}
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

        {/* Protected Routes */}
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

        {/* Default redirect */}
        <Route path="/" element={<Navigate to={user ? "/chat" : "/login"} replace />} />
        <Route path="*" element={<Navigate to={user ? "/chat" : "/login"} replace />} />
      </Routes>
    </Suspense>
  );
}

export default App; 