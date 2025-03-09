import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { 
  Save, 
  RefreshCw, 
  Key, 
  Database, 
  HardDrive, 
  Server,
  Download,
  Upload,
  User,
  Shield,
  Loader
} from 'lucide-react';

// Configure axios with base URL
const apiClient = axios.create({
  baseURL: import.meta.env.PROD ? '/api' : 'http://localhost:3000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Intercept requests to add authentication header
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const Settings: React.FC = () => {
  const { user, refreshToken } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // User profile form state
  const [profile, setProfile] = useState({
    username: '',
    email: '',
  });
  
  // Password change form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // Settings state
  const [settings, setSettings] = useState({
    database: {
      engine: 'SQLITE',
      host: 'localhost',
      port: '5432',
      name: 'botdashboard',
      user: 'postgres',
      password: '********',
      url: '',
      ssl: false
    },
    security: {
      sessionTimeout: 15,
      maxLoginAttempts: 5,
      rateLimitRequests: 100,
      rateLimitWindow: 15,
      enforceHttps: true,
      csrfProtection: true
    },
    system: {
      logLevel: 'info',
      logRetention: 14,
      backupEnabled: true,
      backupFrequency: 'daily',
      notificationsEnabled: false,
      notificationEmail: ''
    }
  });

  // System info state
  const [systemInfo, setSystemInfo] = useState({
    version: 'v1.0.0',
    nodeVersion: 'v22.14.0',
    databaseVersion: 'SQLite v3.36.0'
  });
  
  // Load user data when component mounts
  useEffect(() => {
    if (user) {
      setProfile({
        username: user.username,
        email: user.email,
      });
    }
  }, [user]);

  // Fetch settings from the API when the component mounts
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setInitialLoading(true);
        // Fetch settings
        const response = await apiClient.get('/settings');
        
        if (response.data && response.data.settings) {
          // Ensure we have all required sections by providing defaults
          const fetchedSettings = {
            database: {
              engine: 'SQLITE',
              host: 'localhost',
              port: '5432',
              name: 'botdashboard',
              user: 'postgres',
              password: '********',
              url: '',
              ssl: false,
              ...(response.data.settings.database || {})
            },
            security: {
              sessionTimeout: 15,
              maxLoginAttempts: 5,
              rateLimitRequests: 100,
              rateLimitWindow: 15,
              enforceHttps: true,
              csrfProtection: true,
              ...(response.data.settings.security || {})
            },
            system: {
              logLevel: 'info',
              logRetention: 14,
              backupEnabled: true,
              backupFrequency: 'daily',
              notificationsEnabled: false,
              notificationEmail: '',
              ...(response.data.settings.system || {})
            }
          };

          // Update settings state with data from the server
          setSettings(fetchedSettings);
          
          // If system info is included in the response
          if (response.data.systemInfo) {
            setSystemInfo(response.data.systemInfo);
          }
        }
      } catch (error: any) {
        console.error('Error fetching settings:', error);
        toast.error('Failed to load settings. Using defaults.');
      } finally {
        setInitialLoading(false);
      }
    };

    fetchSettings();
  }, []);
  
  // Handle profile form changes
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle password form changes
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Update profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await apiClient.put('/profile', {
        username: profile.username,
        email: profile.email
      });
      
      toast.success('Profile updated successfully');
      // Refresh the token to update user data in context
      await refreshToken();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };
  
  // Change password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords match
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    
    // Validate password length
    if (passwordForm.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    
    setLoading(true);
    
    try {
      await apiClient.put('/profile', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      
      toast.success('Password changed successfully');
      
      // Reset form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDatabaseChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setSettings(prev => ({
      ...prev,
      database: {
        ...prev.database,
        [name]: type === 'checkbox' ? checked : value
      }
    }));
  };
  
  const handleSecurityChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setSettings(prev => ({
      ...prev,
      security: {
        ...prev.security,
        [name]: type === 'checkbox' ? checked : value
      }
    }));
  };
  
  const handleSystemChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setSettings(prev => ({
      ...prev,
      system: {
        ...prev.system,
        [name]: type === 'checkbox' ? checked : value
      }
    }));
  };
  
  // Save settings to the database
  const handleSaveSettings = async (section?: string) => {
    setLoading(true);
    
    try {
      // Prepare the data to update based on the section
      let dataToUpdate;
      
      if (section === 'database') {
        dataToUpdate = { database: settings.database };
      } else if (section === 'security') {
        dataToUpdate = { security: settings.security };
      } else if (section === 'system') {
        dataToUpdate = { system: settings.system };
      } else {
        // If no section is specified, update all settings
        dataToUpdate = settings;
      }
      
      // Make API call to save settings
      await apiClient.put('/settings', dataToUpdate);
      
      toast.success(`${section ? section.charAt(0).toUpperCase() + section.slice(1) : 'All'} settings saved successfully!`);
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };
  
  // Test database connection
  const handleTestDatabaseConnection = async () => {
    setLoading(true);
    
    try {
      const response = await apiClient.post('/settings/test-database', {
        database: settings.database
      });
      
      if (response.data.success) {
        toast.success('Database connection successful!');
      } else {
        toast.error('Database connection failed: ' + response.data.message);
      }
    } catch (error: any) {
      console.error('Error testing database connection:', error);
      toast.error(error.response?.data?.message || 'Failed to test database connection');
    } finally {
      setLoading(false);
    }
  };
  
  // Regenerate security keys
  const handleRegenerateKeys = async () => {
    setLoading(true);
    
    try {
      await apiClient.post('/settings/regenerate-keys');
      toast.success('Security keys regenerated successfully!');
    } catch (error: any) {
      console.error('Error regenerating security keys:', error);
      toast.error(error.response?.data?.message || 'Failed to regenerate security keys');
    } finally {
      setLoading(false);
    }
  };
  
  // Create and download a backup
  const handleBackupNow = async () => {
    setLoading(true);
    
    try {
      const response = await apiClient.post('/settings/backup', {}, {
        responseType: 'blob'
      });
      
      // Create a download link for the backup file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Get the filename from the response headers or use a default
      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition ? 
        contentDisposition.split('filename=')[1].replace(/"/g, '') :
        `backup-${new Date().toISOString().split('T')[0]}.zip`;
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Backup downloaded successfully!');
    } catch (error: any) {
      console.error('Error creating backup:', error);
      toast.error(error.response?.data?.message || 'Failed to create backup');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle restore backup
  const handleRestoreBackup = async () => {
    // Create a file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.zip,.sql,.dump';
    
    fileInput.onchange = async (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      
      const file = files[0];
      const formData = new FormData();
      formData.append('backup', file);
      
      setLoading(true);
      
      try {
        await apiClient.post('/settings/restore', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        toast.success('Backup restored successfully! The system will restart.');
        // Refresh the page after a short delay to reflect the restored data
        setTimeout(() => window.location.reload(), 3000);
      } catch (error: any) {
        console.error('Error restoring backup:', error);
        toast.error(error.response?.data?.message || 'Failed to restore backup');
      } finally {
        setLoading(false);
      }
    };
    
    fileInput.click();
  };
  
  // Loading indicator for initial data fetch
  if (initialLoading) {
    return (
      <Layout title="Settings">
        <div className="flex flex-col items-center justify-center h-64">
          <Loader className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout title="Settings">
      <div className="mb-6 bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              className={`py-4 px-6 border-b-2 font-medium text-sm ${
                activeTab === 'profile'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('profile')}
            >
              User Profile
            </button>
            <button
              className={`py-4 px-6 border-b-2 font-medium text-sm ${
                activeTab === 'database'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('database')}
            >
              Database
            </button>
            <button
              className={`py-4 px-6 border-b-2 font-medium text-sm ${
                activeTab === 'security'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('security')}
            >
              Security
            </button>
            <button
              className={`py-4 px-6 border-b-2 font-medium text-sm ${
                activeTab === 'system'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('system')}
            >
              System
            </button>
          </nav>
        </div>
        
        <div className="p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">User Profile</h3>
              
              <div className="flex items-center mb-6">
                <div className="flex-shrink-0 h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-10 w-10 text-blue-600" />
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-medium text-gray-900">{user?.username}</h4>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                  <p className="text-sm mt-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <Shield className="h-3 w-3 mr-1" />
                      {user?.role}
                    </span>
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <h4 className="text-base font-medium text-gray-900 mb-3">Update Profile</h4>
                  <form onSubmit={handleUpdateProfile}>
                    <div className="mb-4">
                      <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        id="username"
                        name="username"
                        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={profile.username}
                        onChange={handleProfileChange}
                        required
                        minLength={3}
                      />
                    </div>
                    
                    <div className="mb-4">
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={profile.email}
                        onChange={handleProfileChange}
                        required
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={loading}
                      className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                        loading ? 'opacity-70 cursor-not-allowed' : ''
                      }`}
                    >
                      {loading ? (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Update Profile
                    </button>
                  </form>
                </div>
                
                <div>
                  <h4 className="text-base font-medium text-gray-900 mb-3">Change Password</h4>
                  <form onSubmit={handleChangePassword}>
                    <div className="mb-4">
                      <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Current Password
                      </label>
                      <input
                        type="password"
                        id="currentPassword"
                        name="currentPassword"
                        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={passwordForm.currentPassword}
                        onChange={handlePasswordChange}
                        required
                      />
                    </div>
                    
                    <div className="mb-4">
                      <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        id="newPassword"
                        name="newPassword"
                        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={passwordForm.newPassword}
                        onChange={handlePasswordChange}
                        required
                        minLength={8}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Password must be at least 8 characters
                      </p>
                    </div>
                    
                    <div className="mb-4">
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={passwordForm.confirmPassword}
                        onChange={handlePasswordChange}
                        required
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={loading}
                      className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                        loading ? 'opacity-70 cursor-not-allowed' : ''
                      }`}
                    >
                      {loading ? (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <Key className="h-4 w-4 mr-2" />
                      )}
                      Change Password
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
          
          {/* Database Tab */}
          {activeTab === 'database' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Database Settings</h3>
              
              <div className="mb-4">
                <label htmlFor="engine" className="block text-sm font-medium text-gray-700 mb-1">
                  Database Engine
                </label>
                <select
                  id="engine"
                  name="engine"
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={settings.database.engine}
                  onChange={handleDatabaseChange}
                >
                  <option value="SQLITE">SQLite</option>
                  <option value="POSTGRESQL">PostgreSQL</option>
                  <option value="MONGODB">MongoDB</option>
                </select>
              </div>
              
              {settings.database.engine === 'MONGODB' && (
                <div className="mb-4">
                  <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
                    MongoDB Connection URL
                  </label>
                  <input
                    type="text"
                    id="url"
                    name="url"
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="mongodb://username:password@host:port/database"
                    value={settings.database.url}
                    onChange={handleDatabaseChange}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Leave empty to use individual connection parameters below.
                  </p>
                </div>
              )}
              
              {settings.database.engine !== 'SQLITE' && (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="host" className="block text-sm font-medium text-gray-700 mb-1">
                      Host
                    </label>
                    <input
                      type="text"
                      id="host"
                      name="host"
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={settings.database.host}
                      onChange={handleDatabaseChange}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="port" className="block text-sm font-medium text-gray-700 mb-1">
                      Port
                    </label>
                    <input
                      type="text"
                      id="port"
                      name="port"
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={settings.database.port}
                      onChange={handleDatabaseChange}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Database Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={settings.database.name}
                      onChange={handleDatabaseChange}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="user" className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      id="user"
                      name="user"
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={settings.database.user}
                      onChange={handleDatabaseChange}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={settings.database.password}
                      onChange={handleDatabaseChange}
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="ssl"
                      name="ssl"
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      checked={settings.database.ssl}
                      onChange={handleDatabaseChange}
                    />
                    <label htmlFor="ssl" className="ml-2 block text-sm text-gray-900">
                      Use SSL
                    </label>
                  </div>
                </div>
              )}
              
              <div className="mt-6">
                <button
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    loading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  onClick={() => handleSaveSettings('database')}
                  disabled={loading}
                >
                  {loading ? (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <Save className="h-5 w-5 mr-2" />
                  )}
                  Save Changes
                </button>
                <button
                  className={`ml-3 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    loading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  onClick={handleTestDatabaseConnection}
                  disabled={loading}
                >
                  <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Test Connection
                </button>
              </div>
            </div>
          )}
          
          {/* Security Tab */}
          {activeTab === 'security' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Security Settings</h3>
              
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="sessionTimeout" className="block text-sm font-medium text-gray-700 mb-1">
                    Session Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    id="sessionTimeout"
                    name="sessionTimeout"
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={settings.security.sessionTimeout}
                    onChange={handleSecurityChange}
                  />
                </div>
                
                <div>
                  <label htmlFor="maxLoginAttempts" className="block text-sm font-medium text-gray-700 mb-1">
                    Max Login Attempts
                  </label>
                  <input
                    type="number"
                    id="maxLoginAttempts"
                    name="maxLoginAttempts"
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={settings.security.maxLoginAttempts}
                    onChange={handleSecurityChange}
                  />
                </div>
                
                <div>
                  <label htmlFor="rateLimitRequests" className="block text-sm font-medium text-gray-700 mb-1">
                    Rate Limit (requests)
                  </label>
                  <input
                    type="number"
                    id="rateLimitRequests"
                    name="rateLimitRequests"
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={settings.security.rateLimitRequests}
                    onChange={handleSecurityChange}
                  />
                </div>
                
                <div>
                  <label htmlFor="rateLimitWindow" className="block text-sm font-medium text-gray-700 mb-1">
                    Rate Limit Window (minutes)
                  </label>
                  <input
                    type="number"
                    id="rateLimitWindow"
                    name="rateLimitWindow"
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={settings.security.rateLimitWindow}
                    onChange={handleSecurityChange}
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    id="enforceHttps"
                    name="enforceHttps"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={settings.security.enforceHttps}
                    onChange={handleSecurityChange}
                  />
                  <label htmlFor="enforceHttps" className="ml-2 block text-sm text-gray-900">
                    Enforce HTTPS
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    id="csrfProtection"
                    name="csrfProtection"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={settings.security.csrfProtection}
                    onChange={handleSecurityChange}
                  />
                  <label htmlFor="csrfProtection" className="ml-2 block text-sm text-gray-900">
                    CSRF Protection
                  </label>
                </div>
              </div>
              
              <div className="mt-6">
                <button
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    loading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  onClick={() => handleSaveSettings('security')}
                  disabled={loading}
                >
                  {loading ? (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <Save className="h-5 w-5 mr-2" />
                  )}
                  Save Changes
                </button>
                <button
                  className={`ml-3 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    loading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  onClick={handleRegenerateKeys}
                  disabled={loading}
                >
                  <Key className="h-5 w-5 mr-2" />
                  Regenerate Keys
                </button>
              </div>
            </div>
          )}
          
          {/* System Tab */}
          {activeTab === 'system' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">System Settings</h3>
              
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="logLevel" className="block text-sm font-medium text-gray-700 mb-1">
                    Log Level
                  </label>
                  <select
                    id="logLevel"
                    name="logLevel"
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={settings.system.logLevel}
                    onChange={handleSystemChange}
                  >
                    <option value="error">Error</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="logRetention" className="block text-sm font-medium text-gray-700 mb-1">
                    Log Retention (days)
                  </label>
                  <input
                    type="number"
                    id="logRetention"
                    name="logRetention"
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={settings.system.logRetention}
                    onChange={handleSystemChange}
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    id="backupEnabled"
                    name="backupEnabled"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={settings.system.backupEnabled}
                    onChange={handleSystemChange}
                  />
                  <label htmlFor="backupEnabled" className="ml-2 block text-sm text-gray-900">
                    Enable Automated Backups
                  </label>
                </div>
                
                {settings.system.backupEnabled && (
                  <div>
                    <label htmlFor="backupFrequency" className="block text-sm font-medium text-gray-700 mb-1">
                      Backup Frequency
                    </label>
                    <select
                      id="backupFrequency"
                      name="backupFrequency"
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={settings.system.backupFrequency}
                      onChange={handleSystemChange}
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                )}
                
                <div className="flex items-center">
                  <input
                    id="notificationsEnabled"
                    name="notificationsEnabled"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={settings.system.notificationsEnabled}
                    onChange={handleSystemChange}
                  />
                  <label htmlFor="notificationsEnabled" className="ml-2 block text-sm text-gray-900">
                    Enable Email Notifications
                  </label>
                </div>
                
                {settings.system.notificationsEnabled && (
                  <div>
                    <label htmlFor="notificationEmail" className="block text-sm font-medium text-gray-700 mb-1">
                      Notification Email
                    </label>
                    <input
                      type="email"
                      id="notificationEmail"
                      name="notificationEmail"
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={settings.system.notificationEmail}
                      onChange={handleSystemChange}
                    />
                  </div>
                )}
              </div>
              
              <div className="mt-6">
                <button
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    loading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  onClick={() => handleSaveSettings('system')}
                  disabled={loading}
                >
                  {loading ? (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <Save className="h-5 w-5 mr-2" />
                  )}
                  Save Changes
                </button>
                <button
                  className={`ml-3 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    loading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  onClick={handleBackupNow}
                  disabled={loading}
                >
                  <Download className="h-5 w-5 mr-2" />
                  Backup Now
                </button>
                <button
                  className={`ml-3 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    loading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  onClick={handleRestoreBackup}
                  disabled={loading}
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Restore Backup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-6 bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Information</h3>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center">
              <HardDrive className="h-5 w-5 text-gray-400 mr-2" />
              <h4 className="text-base font-medium text-gray-900">System Version</h4>
            </div>
            <p className="mt-2 text-sm text-gray-500">{systemInfo.version}</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Server className="h-5 w-5 text-gray-400 mr-2" />
              <h4 className="text-base font-medium text-gray-900">Node.js Version</h4>
            </div>
            <p className="mt-2 text-sm text-gray-500">{systemInfo.nodeVersion}</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Database className="h-5 w-5 text-gray-400 mr-2" />
              <h4 className="text-base font-medium text-gray-900">Database</h4>
            </div>
            <p className="mt-2 text-sm text-gray-500">{systemInfo.databaseVersion}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;