import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bot, Shield } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('admin@redwan.work');  // Pre-fill with known email
  const [password, setPassword] = useState('Password123');  // Pre-fill with known password
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLoginDetails, setShowLoginDetails] = useState(true);
  
  const { login, verifyTwoFactor, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const result = await login(email, password);
      
      if (result.requiresTwoFactor && result.userId) {
        setShowTwoFactor(true);
        setUserId(result.userId);
      } else if (result.success) {
        navigate('/');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };
  
  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const success = await verifyTwoFactor(userId, twoFactorCode);
      
      if (success) {
        navigate('/');
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (err: any) {
      console.error('2FA verification error:', err);
      setError('An unexpected error occurred during verification. Please try again.');
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-md">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
            <Bot className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Bot Support Dashboard
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account to manage your bots
          </p>
        </div>
        
        {showLoginDetails && (
          <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-md">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-blue-700 font-medium">Login Details</p>
                <p className="text-sm text-blue-700">Email: admin@redwan.work</p>
                <p className="text-sm text-blue-700">Password: Password123</p>
                <button 
                  onClick={() => setShowLoginDetails(false)}
                  className="text-xs text-blue-500 hover:text-blue-700 mt-1"
                >
                  Hide
                </button>
              </div>
            </div>
          </div>
        )}
        
        {!showTwoFactor ? (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-red-700 font-medium">Login Error</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email-address" className="sr-only">Email address</label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isLoading ? (
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <div className="h-5 w-5 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                  </span>
                ) : null}
                Sign in
              </button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleTwoFactorSubmit}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <label htmlFor="two-factor-code" className="block text-sm font-medium text-gray-700">
                Two-factor authentication code
              </label>
              <input
                id="two-factor-code"
                name="twoFactorCode"
                type="text"
                required
                className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter your 6-digit code"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
              />
            </div>
            
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isLoading ? (
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <div className="h-5 w-5 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                  </span>
                ) : null}
                Verify
              </button>
            </div>
            
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-500"
                onClick={() => setShowTwoFactor(false)}
              >
                Back to login
              </button>
            </div>
          </form>
        )}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            <Shield size={16} className="inline mr-1" />
            Secure login with JWT and bcrypt
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;