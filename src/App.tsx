import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';
import InstallPrompt from './components/InstallPrompt';

// Lazy load components
const Login = React.lazy(() => import('./pages/Login'));
const ClientSelection = React.lazy(() => import('./pages/ClientSelection'));
const ProductCatalog = React.lazy(() => import('./pages/ProductCatalog'));
const AdminPanel = React.lazy(() => import('./pages/AdminPanel'));
const ImportPanel = React.lazy(() => import('./pages/ImportPanel'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FDF6F0]">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return profile ? <>{children}</> : <Navigate to="/login" />;
}

function ClientSelectionWrapper() {
  const { profile } = useAuth();
  if (profile?.role === 'cliente') {
    return <Navigate to="/catalog" replace />;
  }
  return <ClientSelection />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <React.Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-[#FDF6F0]">
              <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
            </div>
          }>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <PrivateRoute>
                  <ClientSelectionWrapper />
                </PrivateRoute>
              } />
              <Route path="/catalog" element={
                <PrivateRoute>
                  <ProductCatalog />
                </PrivateRoute>
              } />
              <Route path="/admin" element={
                <PrivateRoute>
                  <AdminPanel />
                </PrivateRoute>
              } />
              <Route path="/import" element={
                <PrivateRoute>
                  <ImportPanel />
                </PrivateRoute>
              } />
              <Route path="/dashboard" element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </React.Suspense>
          <InstallPrompt />
        </Router>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </ErrorBoundary>
  );
}
