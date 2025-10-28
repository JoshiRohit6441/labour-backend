import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import LandingPage from './pages/LandingPage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import VerifyOTP from './pages/auth/VerifyOTP';

import UserDashboard from './pages/user/Dashboard';
import CreateJob from './pages/user/CreateJob';
import JobDetails from './pages/user/JobDetails';
import UserJobs from './pages/user/Jobs';
import UserProfile from './pages/user/Profile';
import UserPayments from './pages/user/Payments';

import ContractorDashboard from './pages/contractor/Dashboard';
import ContractorJobs from './pages/contractor/Jobs';
import ContractorWorkers from './pages/contractor/Workers';
import ContractorProfile from './pages/contractor/Profile';
import ContractorEarnings from './pages/contractor/Earnings';
import NearbyJobs from './pages/contractor/NearbyJobs';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner" style={{ borderTopColor: '#2563eb' }}></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />

          <Route
            path="/user/dashboard"
            element={
              <ProtectedRoute allowedRoles={['USER']}>
                <UserDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/jobs"
            element={
              <ProtectedRoute allowedRoles={['USER']}>
                <UserJobs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/jobs/create"
            element={
              <ProtectedRoute allowedRoles={['USER']}>
                <CreateJob />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/jobs/:jobId"
            element={
              <ProtectedRoute allowedRoles={['USER']}>
                <JobDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/profile"
            element={
              <ProtectedRoute allowedRoles={['USER']}>
                <UserProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/payments"
            element={
              <ProtectedRoute allowedRoles={['USER']}>
                <UserPayments />
              </ProtectedRoute>
            }
          />

          <Route
            path="/contractor/dashboard"
            element={
              <ProtectedRoute allowedRoles={['CONTRACTOR']}>
                <ContractorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contractor/jobs"
            element={
              <ProtectedRoute allowedRoles={['CONTRACTOR']}>
                <ContractorJobs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contractor/nearby-jobs"
            element={
              <ProtectedRoute allowedRoles={['CONTRACTOR']}>
                <NearbyJobs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contractor/workers"
            element={
              <ProtectedRoute allowedRoles={['CONTRACTOR']}>
                <ContractorWorkers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contractor/profile"
            element={
              <ProtectedRoute allowedRoles={['CONTRACTOR']}>
                <ContractorProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contractor/earnings"
            element={
              <ProtectedRoute allowedRoles={['CONTRACTOR']}>
                <ContractorEarnings />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
