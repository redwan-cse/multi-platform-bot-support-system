import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

// Configure axios with base URL and default options
const apiClient = axios.create({
  baseURL: import.meta.env.PROD ? '/api' : 'http://localhost:3000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

interface User {
  id: string;
  username: string;
  email: string;
  role: 'Administrator' | 'Manager' | 'Normal User';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{success: boolean, requiresTwoFactor?: boolean, userId?: string}>;
  verifyTwoFactor: (userId: string, code: string) => Promise<boolean>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  setupTwoFactor: () => Promise<{success: boolean, secretKey?: string, qrCodeUrl?: string}>;
  enableTwoFactor: (code: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Track if token refresh is in progress to prevent multiple simultaneous refresh attempts
let isRefreshingToken = false;
let refreshSubscribers: ((token: string) => void)[] = [];

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Function to handle token refresh
  const refreshTokenFn = async (): Promise<boolean> => {
    try {
      if (!localStorage.getItem('accessToken')) {
        return false;
      }
      
      const response = await apiClient.post('/auth/refresh-token');
      
      // Update the token in localStorage
      localStorage.setItem('accessToken', response.data.accessToken);
      
      setUser(response.data.user);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      localStorage.removeItem('accessToken');
      setUser(null);
      return false;
    }
  };
  
  // Intercept all requests to add auth header
  useEffect(() => {
    const requestInterceptor = apiClient.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Handle token expiration
    const responseInterceptor = apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // If the error is 401 (Unauthorized) or 403 (Forbidden) and we haven't tried refreshing yet
        if ((error.response?.status === 401 || error.response?.status === 403) && 
            !originalRequest._retry) {
          
          if (isRefreshingToken) {
            // If refresh is already in progress, wait for it to complete
            try {
              const newToken = await new Promise<string>((resolve) => {
                refreshSubscribers.push((token: string) => {
                  resolve(token);
                });
              });
              
              // Retry the original request with the new token
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return apiClient(originalRequest);
            } catch (err) {
              return Promise.reject(err);
            }
          }
          
          // Mark that we're attempting to refresh
          originalRequest._retry = true;
          isRefreshingToken = true;
          
          try {
            // Attempt to refresh the token
            const refreshed = await refreshTokenFn();
            
            if (!refreshed) {
              // If refresh fails, clear all subscribers and reject
              refreshSubscribers = [];
              isRefreshingToken = false;
              logout();
              return Promise.reject(new Error('Authentication failed'));
            }
            
            // Get the new token
            const newToken = localStorage.getItem('accessToken') || '';
            
            // Notify all subscribers about the new token
            refreshSubscribers.forEach(callback => callback(newToken));
            refreshSubscribers = [];
            isRefreshingToken = false;
            
            // Retry the original request with the new token
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return apiClient(originalRequest);
          } catch (refreshError) {
            // If refresh fails, clear all subscribers and reject
            refreshSubscribers = [];
            isRefreshingToken = false;
            logout();
            return Promise.reject(refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );
    
    return () => {
      apiClient.interceptors.request.eject(requestInterceptor);
      apiClient.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Check if user is logged in on initial load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First check if we have a token in localStorage
        const token = localStorage.getItem('accessToken');
        
        if (!token) {
          setUser(null);
          setLoading(false);
          return;
        }
        
        const response = await apiClient.get('/auth/me');
        setUser(response.data.user);
      } catch (error) {
        localStorage.removeItem('accessToken');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Set up token refresh interval
  useEffect(() => {
    if (user) {
      const refreshInterval = setInterval(() => {
        refreshTokenFn();
      }, 14 * 60 * 1000); // Refresh token every 14 minutes (token expires in 15)
      
      return () => clearInterval(refreshInterval);
    }
  }, [user]);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const response = await apiClient.post('/auth/login', { email, password });
      
      // Check if 2FA is required
      if (response.data.requiresTwoFactor) {
        return { 
          success: false, 
          requiresTwoFactor: true, 
          userId: response.data.userId 
        };
      }
      
      // Store the token in localStorage
      localStorage.setItem('accessToken', response.data.accessToken);
      
      setUser(response.data.user);
      toast.success('Login successful');
      
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      toast.error(errorMessage);
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const verifyTwoFactor = async (userId: string, code: string) => {
    try {
      setLoading(true);
      const response = await apiClient.post('/auth/verify-2fa', { userId, code });
      
      // Store the token in localStorage
      localStorage.setItem('accessToken', response.data.accessToken);
      
      setUser(response.data.user);
      toast.success('Two-factor verification successful');
      
      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Verification failed';
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always remove the token and user regardless of API response
      localStorage.removeItem('accessToken');
      setUser(null);
      toast.success('Logged out successfully');
    }
  };

  const refreshToken = refreshTokenFn;

  const setupTwoFactor = async () => {
    try {
      const response = await apiClient.post('/auth/setup-2fa');
      
      return {
        success: true,
        secretKey: response.data.secretKey,
        qrCodeUrl: response.data.qrCodeUrl
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to set up two-factor authentication';
      toast.error(errorMessage);
      return { success: false };
    }
  };

  const enableTwoFactor = async (code: string) => {
    try {
      await apiClient.post('/auth/enable-2fa', { code });
      
      // Update user object to reflect 2FA status
      const userResponse = await apiClient.get('/auth/me');
      setUser(userResponse.data.user);
      
      toast.success('Two-factor authentication enabled');
      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to enable two-factor authentication';
      toast.error(errorMessage);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user, 
      loading, 
      login, 
      verifyTwoFactor,
      logout,
      refreshToken,
      setupTwoFactor,
      enableTwoFactor
    }}>
      {children}
    </AuthContext.Provider>
  );
};