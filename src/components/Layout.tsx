import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Home, 
  Bot, 
  Users, 
  BarChart2, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Bell
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <Home className="w-5 h-5" /> },
    { name: 'Bot Management', path: '/bots', icon: <Bot className="w-5 h-5" /> },
    { name: 'User Management', path: '/users', icon: <Users className="w-5 h-5" /> },
    { name: 'Monitoring', path: '/monitoring', icon: <BarChart2 className="w-5 h-5" /> },
    { name: 'Settings', path: '/settings', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar for mobile */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)}></div>
        <div className="fixed inset-y-0 left-0 flex flex-col w-64 max-w-xs bg-gray-800 text-white">
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
            <h1 className="text-xl font-bold">Bot Dashboard</h1>
            <button onClick={() => setSidebarOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <nav className="px-2 py-4 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center px-4 py-2 text-sm rounded-md hover:bg-gray-700"
                  onClick={() => setSidebarOpen(false)}
                >
                  {item.icon}
                  <span className="ml-3">{item.name}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Sidebar for desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64 bg-gray-800 text-white">
          <div className="flex items-center h-16 px-4 border-b border-gray-700">
            <h1 className="text-xl font-bold">Bot Dashboard</h1>
          </div>
          <div className="flex-1 overflow-y-auto">
            <nav className="px-2 py-4 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center px-4 py-2 text-sm rounded-md hover:bg-gray-700"
                >
                  {item.icon}
                  <span className="ml-3">{item.name}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top navigation */}
        <div className="flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200">
          <div className="flex items-center">
            <button
              className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="ml-2 text-xl font-semibold text-gray-800">{title}</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-1 text-gray-500 hover:text-gray-900">
              <Bell className="w-6 h-6" />
            </button>
            <div className="relative">
              <div className="flex items-center space-x-3">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium text-gray-900">{user?.username}</span>
                  <span className="text-xs text-gray-500">{user?.role}</span>
                </div>
                <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-800">
                    {user?.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1 text-gray-500 hover:text-gray-900"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;