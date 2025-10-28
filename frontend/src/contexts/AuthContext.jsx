import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (credentials) => {
    try {
      const response = await api.post('/api/user/auth/login', credentials);

      if (response.data.requiresOTP) {
        localStorage.setItem('tempPhone', credentials.phone);
        navigate('/verify-otp');
        return { requiresOTP: true };
      }

      const { token, user: userData } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      setUser(userData);
      toast.success('Login successful!');

      if (userData.role === 'USER') {
        navigate('/user/dashboard');
      } else if (userData.role === 'CONTRACTOR') {
        navigate('/contractor/dashboard');
      }

      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post('/api/user/auth/register', userData);

      if (response.data.requiresOTP) {
        localStorage.setItem('tempPhone', userData.phone);
        navigate('/verify-otp');
        return { requiresOTP: true };
      }

      toast.success('Registration successful! Please verify OTP.');
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      throw error;
    }
  };

  const verifyOTP = async (phone, otp) => {
    try {
      const response = await api.post('/api/user/auth/verify-otp', { phone, otp });
      const { token, user: userData } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.removeItem('tempPhone');
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      setUser(userData);
      toast.success('OTP verified successfully!');

      if (userData.role === 'USER') {
        navigate('/user/dashboard');
      } else if (userData.role === 'CONTRACTOR') {
        navigate('/contractor/dashboard');
      }

      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'OTP verification failed';
      toast.error(message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/user/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
      navigate('/login');
      toast.success('Logged out successfully');
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    verifyOTP,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
