import React, { useState } from 'react';
import Layout from '../components/Layout';
import { 
  Download, 
  Filter, 
  RefreshCw, 
  AlertTriangle, 
  Info, 
  AlertCircle,
  Calendar,
  BarChart2
} from 'lucide-react';

interface Log {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  source: string;
  details?: string;
}

const MonitoringReporting: React.FC = () => {
  const [logs, setLogs] = useState<Log[]>([
    { id: '1', timestamp: '2025-06-15 14:32:45', level: 'error', message: 'Failed to connect to Instagram API', source: 'Instagram Helper', details: 'Connection timeout after 30s' },
    { id: '2', timestamp: '2025-06-15 14:30:12', level: 'warning', message: 'Rate limit approaching for WhatsApp API', source: 'Sales Assistant', details: '80% of daily limit reached' },
    { id: '3', timestamp: '2025-06-15 14:28:55', level: 'info', message: 'New ticket created #1234', source: 'Support Bot', details: 'User: @john_doe' },
    { id: '4', timestamp: '2025-06-15 14:25:33', level: 'info', message: 'User reputation updated for @user123', source: 'Moderation Bot', details: '+10 points added by admin' },
    { id: '5', timestamp: '2025-06-15 14:22:17', level: 'error', message: 'Database connection timeout', source: 'System', details: 'Connection to PostgreSQL failed' },
    { id: '6', timestamp: '2025-06-15 14:20:05', level: 'info', message: 'Bot restarted successfully', source: 'Discord Bot', details: 'Uptime: 0h 0m 5s' },
    { id: '7', timestamp: '2025-06-15 14:18:30', level: 'warning', message: 'High CPU usage detected', source: 'System Monitor', details: '85% CPU utilization for 5 minutes' },
    { id: '8', timestamp: '2025-06-15 14:15:22', level: 'info', message: 'User logged in', source: 'Auth System', details: 'Username: admin' },
    { id: '9', timestamp: '2025-06-15 14:10:18', level: 'error', message: 'Failed to send message', source: 'Telegram Bot', details: 'User has blocked the bot' },
    { id: '10', timestamp: '2025-06-15 14:05:44', level: 'info', message: 'Configuration updated', source: 'System', details: 'Updated by: admin' },
  ]);
  
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: '2025-06-15',
    end: '2025-06-15'
  });
  
  const filteredLogs = logs.filter(log => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (filterSource !== 'all' && log.source !== filterSource) return false;
    return true;
  });
  
  const uniqueSources = Array.from(new Set(logs.map(log => log.source)));
  
  const handleExportCSV = () => {
    // This would be an API call in a real application
    alert('Exporting logs to CSV...');
  };
  
  const handleExportLeads = () => {
    // This would be an API call in a real application
    alert('Exporting leads to CSV...');
  };
  
  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };
  
  return (
    <Layout title="Monitoring & Reporting">
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">System Metrics</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-base font-medium text-gray-900 mb-2">CPU Usage</h4>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '45%' }}></div>
              </div>
              <p className="mt-2 text-sm text-gray-500">45% utilization</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-base font-medium text-gray-900 mb-2">Memory Usage</h4>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-green-600 h-2.5 rounded-full" style={{ width: '62%' }}></div>
              </div>
              <p className="mt-2 text-sm text-gray-500">62% utilization (3.1/5 GB)</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-base font-medium text-gray-900 mb-2">Disk Usage</h4>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: '28%' }}></div>
              </div>
              <p className="mt-2 text-sm text-gray-500">28% utilization (14/50 GB)</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-base font-medium text-gray-900 mb-2">Network I/O</h4>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-yellow-600 h-2.5 rounded-full" style={{ width: '15%' }}></div>
              </div>
              <p className="mt-2 text-sm text-gray-500">15% of bandwidth (1.5 MB/s)</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Bot Activity</h2>
          <div className="relative h-64">
            <div className="absolute inset-0 flex items-center justify-center">
              <BarChart2 className="h-32 w-32 text-gray-200" />
              <p className="absolute text-gray-500">Activity chart will appear here</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mb-6 bg-white shadow rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">System Logs</h2>
          <div className="mt-3 sm:mt-0 flex flex-col sm:flex-row sm:space-x-3">
            <div className="flex items-center space-x-2 mb-2 sm:mb-0">
              <Calendar className="h-5 w-5 text-gray-400" />
              <input
                type="date"
                className="border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
              <span>to</span>
              <input
                type="date"
                className="border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
            <div className="flex space-x-2">
              <button
                className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => setLogs([...logs])}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </button>
              <button
                className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={handleExportCSV}
              >
                <Download className="h-4 w-4 mr-1" />
                Export Logs
              </button>
            </div>
          </div>
        </div>
        
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="flex items-center">
            <Filter className="h-5 w-5 text-gray-400 mr-2" />
            <span className="text-sm text-gray-500 mr-2">Filter by:</span>
          </div>
          <div className="flex items-center space-x-2">
            <label htmlFor="level-filter" className="text-sm text-gray-500">Level:</label>
            <select
              id="level-filter"
              className="border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <label htmlFor="source-filter" className="text-sm text-gray-500">Source:</label>
            <select
              id="source-filter"
              className="border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
            >
              <option value="all">All Sources</option>
              {uniqueSources.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Level
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getLogLevelIcon(log.level)}
                        <span className="ml-1 text-sm text-gray-900 capitalize">{log.level}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.timestamp}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.source}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {log.message}
                    </td>
                  </tr>
                  {expandedLogId === log.id && log.details && (
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="px-6 py-4">
                        <div className="text-sm text-gray-500">
                          <span className="font-medium">Details:</span> {log.details}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mb-6 bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Lead Management</h2>
          <button
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            onClick={handleExportLeads}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Leads
          </button>
        </div>
        
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Lead data will be displayed here. Connect your bots to start collecting leads.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MonitoringReporting;