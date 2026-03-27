import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { useHardwareBack } from './hooks/useBackButton';
import Splash from './pages/Splash';
import { Login, Register } from './pages/Auth';
import LocationPermission from './pages/LocationPermission';
import Home from './pages/Home';
import SearchResults from './pages/SearchResults';
import BusTracking from './pages/BusTracking';
import DriverDashboard from './pages/DriverDashboard';
import RouteDetail from './pages/RouteDetail';

// Routes where back button should exit app
const EXIT_ROUTES = ['/', '/splash', '/home', '/driver'];

function BackHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useApp();

  useHardwareBack(() => {
    const currentPath = location.pathname;
    
    // Check if we're on an exit route
    if (EXIT_ROUTES.includes(currentPath)) {
      // Let the default handler exit the app
      return false;
    }

    // For auth pages, go back to home or splash
    if (currentPath === '/login' || currentPath === '/register') {
      if (user) {
        navigate(user.role === 'driver' ? '/driver' : '/home');
      } else {
        navigate('/');
      }
      return true; // Prevented default
    }

    // For other pages, let history handle it
    return false;
  });

  return null;
}

function ProtectedRoute({ children, driverOnly = false }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  if (driverOnly && user.role !== 'driver') return <Navigate to="/home" replace />;
  if (!driverOnly && user.role === 'driver') return <Navigate to="/driver" replace />;
  return children;
}

function AppRoutes() {
  return (
    <>
      <BackHandler />
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/splash" element={<Splash />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/location-permission" element={<LocationPermission />} />
        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><SearchResults /></ProtectedRoute>} />
        <Route path="/bus/:id" element={<ProtectedRoute><BusTracking /></ProtectedRoute>} />
        <Route path="/route/:id" element={<ProtectedRoute><RouteDetail /></ProtectedRoute>} />
        <Route path="/driver" element={<ProtectedRoute driverOnly><DriverDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
