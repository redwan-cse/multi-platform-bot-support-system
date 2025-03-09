import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Pause, 
  RefreshCw,
  Bot,
  MessageSquare,
  Shield,
  Send
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

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

// Handle response errors globally
apiClient.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    if (error.response?.status === 401) {
      // Handle auth errors (redirect to login)
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

type BotPlatform = 'Discord' | 'Telegram' | 'WhatsApp' | 'Messenger' | 'Instagram';

interface Bot {
  id: string;
  name: string;
  platform: BotPlatform;
  type: string;
  status: 'online' | 'offline' | 'error';
  createdAt: string;
  lastActive: string | null;
  config: any;
}

const BotManagement: React.FC = () => {
  const [bots, setBots] = useState<Bot[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBot, setNewBot] = useState({
    name: '',
    platform: 'Discord' as BotPlatform,
    type: 'Standard',
    credentials: {
      token: '',
      guildId: '',
      apiKey: ''
    }
  });

  // Fetch bots from API
  useEffect(() => {
    const fetchBots = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Get token from localStorage
        const token = localStorage.getItem('accessToken');
        
        if (!token) {
          setError('Authentication token not found. Please log in again.');
          setIsLoading(false);
          return;
        }
        
        // Fetch bots from API
        const response = await apiClient.get('/bots');
        
        if (response.data && Array.isArray(response.data.bots)) {
          setBots(response.data.bots);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err: any) {
        console.error('Error fetching bots:', err);
        setError('Failed to load bots. ' + (err.response?.data?.error || err.message));
        
        // Show fallback data for development only if we're in development mode
        if (import.meta.env.DEV) {
          setBots([
            {
              id: 'bot-1',
              name: 'Support Bot',
              platform: 'Discord',
              type: 'Standard',
              status: 'online',
              createdAt: '2025-05-01T10:30:00Z',
              lastActive: '2025-05-07T15:45:00Z',
              config: {
                token: '***********',
                guildId: '12345678901234567',
                notifications: true,
                loggingEnabled: true
              }
            },
            {
              id: 'bot-2',
              name: 'Moderation Bot',
              platform: 'Discord',
              type: 'Moderation',
              status: 'offline',
              createdAt: '2025-05-03T14:20:00Z',
              lastActive: null,
              config: {
                token: '***********',
                guildId: '12345678901234567',
                notifications: true,
                loggingEnabled: true
              }
            }
          ]);
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBots();
  }, []);

  const handleCreateBot = async () => {
    try {
      // Get token from localStorage
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        return;
      }
      
      // Prepare config object based on platform
      const config: any = {};
      
      // Add appropriate credentials based on platform
      if (newBot.platform === 'Discord') {
        config.token = newBot.credentials.token;
        config.guildId = newBot.credentials.guildId;
      } else if (newBot.platform === 'Telegram') {
        config.apiKey = newBot.credentials.apiKey;
      } else {
        config.apiKey = newBot.credentials.token;
      }
      
      // Add platform-specific settings
      config.notifications = true;
      config.loggingEnabled = true;
      
      // Create bot via API
      const response = await apiClient.post('/bots', {
        name: newBot.name,
        platform: newBot.platform,
        type: newBot.type,
        config: config
      });
      
      // Add new bot to state
      if (response.data && response.data.bot) {
        setBots([...bots, response.data.bot]);
        toast.success('Bot created successfully');
      } else {
        throw new Error('Invalid response format');
      }
      
      // Close modal and reset form
      setShowCreateModal(false);
      setNewBot({
        name: '',
        platform: 'Discord',
        type: 'Standard',
        credentials: {
          token: '',
          guildId: '',
          apiKey: ''
        }
      });
      
    } catch (err: any) {
      console.error('Error creating bot:', err);
      if (err.response?.data?.errors) {
        setError(`Failed to create bot: ${err.response.data.errors[0].msg}`);
      } else {
        setError('Failed to create bot. ' + (err.response?.data?.error || err.message));
      }
      toast.error('Failed to create bot');
    }
  };
  
  const handleStartBot = async (id: string) => {
    try {
      // Get token from localStorage
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        return;
      }
      
      // Start bot via API
      const response = await apiClient.post(`/bots/${id}/start`);
      
      // Update bot status in state
      if (response.data && response.data.bot) {
        setBots(bots.map(bot => 
          bot.id === id ? response.data.bot : bot
        ));
        toast.success('Bot started successfully');
      } else {
        throw new Error('Invalid response format');
      }
      
    } catch (err: any) {
      console.error('Error starting bot:', err);
      setError('Failed to start bot. ' + (err.response?.data?.error || err.message));
      toast.error('Failed to start bot');
    }
  };
  
  const handleStopBot = async (id: string) => {
    try {
      // Get token from localStorage
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        return;
      }
      
      // Stop bot via API
      const response = await apiClient.post(`/bots/${id}/stop`);
      
      // Update bot status in state
      if (response.data && response.data.bot) {
        setBots(bots.map(bot => 
          bot.id === id ? response.data.bot : bot
        ));
        toast.success('Bot stopped successfully');
      } else {
        throw new Error('Invalid response format');
      }
      
    } catch (err: any) {
      console.error('Error stopping bot:', err);
      setError('Failed to stop bot. ' + (err.response?.data?.error || err.message));
      toast.error('Failed to stop bot');
    }
  };
  
  const handleDeleteBot = async (id: string) => {
    try {
      // Confirm deletion
      if (!window.confirm('Are you sure you want to delete this bot?')) {
        return;
      }
      
      // Delete bot via API
      const response = await apiClient.delete(`/bots/${id}`);
      
      if (response.data && response.data.success) {
        // Remove bot from state
        setBots(bots.filter(bot => bot.id !== id));
        toast.success('Bot deleted successfully');
      } else {
        throw new Error('Invalid response format');
      }
      
    } catch (err: any) {
      console.error('Error deleting bot:', err);
      setError('Failed to delete bot. ' + (err.response?.data?.error || err.message));
      toast.error('Failed to delete bot');
    }
  };
  
  const formatLastActive = (lastActive: string | null) => {
    if (!lastActive) return 'Never';
    
    const date = new Date(lastActive);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    
    return date.toLocaleDateString();
  };
  
  const getPlatformIcon = (platform: BotPlatform) => {
    switch (platform) {
      case 'Discord':
        return <MessageSquare className="h-5 w-5 text-indigo-500" />;
      case 'Telegram':
        return <Send className="h-5 w-5 text-blue-500" />;
      case 'WhatsApp':
        return <MessageSquare className="h-5 w-5 text-green-500" />;
      case 'Messenger':
        return <MessageSquare className="h-5 w-5 text-blue-600" />;
      case 'Instagram':
        return <MessageSquare className="h-5 w-5 text-pink-500" />;
      default:
        return <Bot className="h-5 w-5 text-gray-500" />;
    }
  };
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Moderation':
        return <Shield className="h-5 w-5 text-red-500" />;
      case 'Standard':
      default:
        return <Bot className="h-5 w-5 text-blue-500" />;
    }
  };
  
  // Helper function to determine the credential input value and handler
  const getCredentialValue = () => {
    const platform = newBot.platform;
    if (platform === 'Telegram') {
      return newBot.credentials.apiKey;
    }
    return newBot.credentials.token;
  };

  const handleCredentialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const platform = newBot.platform;
    
    setNewBot({
      ...newBot,
      credentials: {
        ...newBot.credentials,
        ...(platform === 'Telegram' ? { apiKey: value } : { token: value })
      }
    });
  };
  
  return (
    <Layout title="Bot Management">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Manage Your Bots</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create New Bot
        </button>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center py-12">
          <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-600">Loading bots...</span>
        </div>
      ) : bots.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <Bot className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">No bots created yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating your first bot.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create New Bot
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {bots.map((bot) => (
              <li key={bot.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                        bot.status === 'online' ? 'bg-green-100' : bot.status === 'error' ? 'bg-red-100' : 'bg-gray-100'
                      }`}>
                        {getPlatformIcon(bot.platform)}
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <h3 className="text-sm font-medium text-gray-900">{bot.name}</h3>
                          <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            bot.status === 'online' ? 'bg-green-100 text-green-800' : 
                            bot.status === 'error' ? 'bg-red-100 text-red-800' : 
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {bot.status}
                          </span>
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <div className="flex items-center mr-4">
                            {getPlatformIcon(bot.platform)}
                            <span className="ml-1">{bot.platform}</span>
                          </div>
                          <div className="flex items-center">
                            {getTypeIcon(bot.type)}
                            <span className="ml-1">{bot.type}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">Last active: {formatLastActive(bot.lastActive)}</span>
                      <div className="flex space-x-1">
                        {bot.status === 'online' ? (
                          <button
                            onClick={() => handleStopBot(bot.id)}
                            className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            title="Stop Bot"
                          >
                            <Pause className="h-5 w-5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartBot(bot.id)}
                            className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            title="Start Bot"
                          >
                            <Play className="h-5 w-5" />
                          </button>
                        )}
                        <button
                          className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                          title="Restart Bot"
                          onClick={() => {
                            handleStopBot(bot.id).then(() => {
                              setTimeout(() => handleStartBot(bot.id), 1000);
                            });
                          }}
                        >
                          <RefreshCw className="h-5 w-5" />
                        </button>
                        <button
                          className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                          title="Edit Bot"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteBot(bot.id)}
                          className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-red-600"
                          title="Delete Bot"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Create Bot Modal */}
      {showCreateModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                  <Bot className="h-6 w-6 text-blue-600" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Create New Bot</h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Fill in the details below to create and deploy a new bot.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-5 sm:mt-6">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="bot-name" className="block text-sm font-medium text-gray-700">
                      Bot Name
                    </label>
                    <input
                      type="text"
                      id="bot-name"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter bot name"
                      value={newBot.name}
                      onChange={(e) => setNewBot({ ...newBot, name: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="platform" className="block text-sm font-medium text-gray-700">
                      Platform
                    </label>
                    <select
                      id="platform"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={newBot.platform}
                      onChange={(e) => setNewBot({ ...newBot, platform: e.target.value as BotPlatform })}
                    >
                      <option value="Discord">Discord</option>
                      <option value="Telegram">Telegram</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Messenger">Messenger</option>
                      <option value="Instagram">Instagram</option>
                    </select>
                  </div>
                  
                  {newBot.platform === 'Discord' && (
                    <div>
                      <label htmlFor="bot-type" className="block text-sm font-medium text-gray-700">
                        Bot Type
                      </label>
                      <select
                        id="bot-type"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={newBot.type}
                        onChange={(e) => setNewBot({ ...newBot, type: e.target.value })}
                      >
                        <option value="Standard">Standard</option>
                        <option value="Moderation">Moderation</option>
                      </select>
                    </div>
                  )}
                  
                  <div>
                    <label htmlFor="bot-token" className="block text-sm font-medium text-gray-700">
                      {newBot.platform === 'Discord' ? 'Bot Token' : 
                       newBot.platform === 'Telegram' ? 'Bot API Key' : 
                       'API Credentials'}
                    </label>
                    <input
                      type="password"
                      id="bot-token"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder={`Enter ${newBot.platform} bot credentials`}
                      value={getCredentialValue()}
                      onChange={handleCredentialChange}
                    />
                  </div>
                  
                  {newBot.platform === 'Discord' && (
                    <div>
                      <label htmlFor="guild-id" className="block text-sm font-medium text-gray-700">
                        Guild ID (Server ID)
                      </label>
                      <input
                        type="text"
                        id="guild-id"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Enter Discord server ID"
                        value={newBot.credentials.guildId}
                        onChange={(e) => setNewBot({ 
                          ...newBot, 
                          credentials: { ...newBot.credentials, guildId: e.target.value } 
                        })}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm"
                  onClick={handleCreateBot}
                >
                  Create & Deploy
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default BotManagement;