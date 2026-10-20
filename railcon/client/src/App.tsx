import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DriverOBU } from './views/DriverOBU/DriverOBU';
import { DispatcherDashboard } from './views/DispatcherDashboard/DispatcherDashboard';
import { PassengerPIS } from './views/PassengerPIS/PassengerPIS';
import { Login } from './views/Login/Login';
import { useAuthStore } from './stores/authStore';

function PrivateRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/driver"
          element={
            <PrivateRoute allowedRoles={['DRIVER']}>
              <DriverOBU />
            </PrivateRoute>
          }
        />
        <Route
          path="/dispatcher"
          element={
            <PrivateRoute allowedRoles={['DISPATCHER', 'SYSADMIN']}>
              <DispatcherDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/pis"
          element={<PassengerPIS />}
        />
        <Route path="/" element={<Navigate to="/driver" replace />} />
        <Route path="*" element={<Navigate to="/driver" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
