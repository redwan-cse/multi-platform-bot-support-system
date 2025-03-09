import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { 
  Bot, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Activity 
} from 'lucide-react';

interface BotStatus {
  id: string;
  name: string;
  platform: string;
  status: 'online' | 'offline' | 'error';
  lastActive: string | null;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  source: string;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalBots: 0,
    activeBots: 0,
    totalUsers: 0,
    errors: 0,
    uptime: '0d 0h 0m'
  });
  
  const [botStatus, setBotStatus] = useState<BotStatus[]>([]);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch data
  useEffect(() => {
    const fetchDashboardData = async () => {
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

        // Fetch bots - this will give us total bots and active bots
        const botsResponse = await axios.get('/api/bots', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const bots = botsResponse.data.bots || [];
        const activeBots = bots.filter((bot: any) => bot.status === 'online');
        
        // Fetch users (admin only)
        let totalUsers = 0;
        try {
          const usersResponse = await axios.get('/api/users', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          totalUsers = (usersResponse.data.users || []).length;
        } catch (err) {
          // User might not have admin permissions
          console.log('Could not fetch users, might not have admin permissions');
          totalUsers = 0;
        }

        // Calculate errors (bots with error status)
        const errorBots = bots.filter((bot: any) => bot.status === 'error').length;
        
        // Update stats
        setStats({
          totalBots: bots.length,
          activeBots: activeBots.length,
          totalUsers,
          errors: errorBots,
          uptime: '15d 7h 22m' // This would come from the server in a real app
        });
        
        // Set bot status for display (limit to 5)
        setBotStatus(bots.slice(0, 5).map((bot: any) => ({
          id: bot.id,
          name: bot.name,
          platform: bot.platform,
          status: bot.status,
          lastActive: bot.lastActive
        })));
        
        // Set some placeholder logs
        // In a real app, this would come from a logs endpoint
        setRecentLogs([
          { id: '1', timestamp: new Date().toISOString(), level: 'error', message: 'Failed to connect to API', source: bots.find((bot: any) => bot.status === 'error')?.name || 'System' },
          { id: '2', timestamp: new Date().toISOString(), level: 'warning', message: 'Rate limit approaching', source: activeBots[0]?.name || 'System' },
          { id: '3', timestamp: new Date().toISOString(), level: 'info', message: 'Bot started successfully', source: activeBots[0]?.name || 'System' },
          { id: '4', timestamp: new Date().toISOString(), level: 'info', message: 'User reputation updated', source: activeBots[1]?.name || 'System' },
          { id: '5', timestamp: new Date().toISOString(), level: 'info', message: 'Database connection established', source: 'System' },
        ]);
        
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'offline':
        return <XCircle className="h-5 w-5 text-gray-500" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };
  
  const getLogLevelBadge = (level: string) => {
    switch (level) {
      case 'info':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Info</span>;
      case 'warning':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Warning</span>;
      case 'error':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Error</span>;
      default:
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Unknown</span>;
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
  
  const formatLogTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  return (
    <Layout title="Dashboard">
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
          <span className="text-gray-600">Loading dashboard...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Stats cards */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                    <Bot className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Bots</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">{stats.totalBots}</div>
                        <div className="ml-2 text-sm text-green-600">
                          <span className="font-medium text-green-500">{stats.activeBots} active</span>
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">{stats.totalUsers}</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-red-500 rounded-md p-3">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Errors (24h)</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">{stats.errors}</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                    <Activity className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">System Uptime</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">{stats.uptime}</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Bot Status */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Bot Status</h3>
                <a href="/bot-management" className="text-sm text-blue-600 hover:text-blue-500">View all</a>
              </div>
              <div className="border-t border-gray-200">
                {botStatus.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {botStatus.map((bot) => (
                      <li key={bot.id} className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="mr-4">
                              {getStatusIcon(bot.status)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{bot.name}</p>
                              <p className="text-sm text-gray-500">{bot.platform}</p>
                            </div>
                          </div>
                          <div className="text-sm text-gray-500">
                            Last active: {formatLastActive(bot.lastActive)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-6 sm:px-6 text-center text-gray-500">
                    <Bot className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No bots available.</p>
                    <a href="/bot-management" className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-500">
                      Create your first bot
                    </a>
                  </div>
                )}
              </div>
            </div>
            
            {/* Recent Logs */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Activity</h3>
                <a href="/monitoring-reporting" className="text-sm text-blue-600 hover:text-blue-500">View all</a>
              </div>
              <div className="border-t border-gray-200">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flow-root">
                    <ul className="-mb-8">
                      {recentLogs.map((log, index) => (
                        <li key={log.id}>
                          <div className="relative pb-8">
                            {index < recentLogs.length - 1 ? (
                              <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                            ) : null}
                            <div className="relative flex items-start space-x-3">
                              <div className="relative">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                  log.level === 'error' ? 'bg-red-100' :
                                  log.level === 'warning' ? 'bg-yellow-100' :
                                  'bg-blue-100'
                                }`}>
                                  {log.level === 'error' ? (
                                    <AlertTriangle className="h-5 w-5 text-red-500" />
                                  ) : log.level === 'warning' ? (
                                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                  ) : (
                                    <CheckCircle className="h-5 w-5 text-blue-500" />
                                  )}
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-900">
                                  <span>{log.source}</span>
                                  <span className="ml-2">{getLogLevelBadge(log.level)}</span>
                                </div>
                                <p className="mt-0.5 text-sm text-gray-500">
                                  {log.message}
                                </p>
                                <p className="mt-0.5 text-xs text-gray-400">
                                  {formatLogTime(log.timestamp)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
};

export default Dashboard;