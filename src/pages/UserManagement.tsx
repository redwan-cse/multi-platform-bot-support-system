import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import Layout from '../components/Layout';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Lock, 
  Unlock, 
  User,
  Shield,
  UserCheck,
  UserX
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

interface User {
  id: string;
  username: string;
  email: string;
  role: 'Administrator' | 'Manager' | 'Normal User';
  status: 'active' | 'suspended';
  createdAt: string;
  lastLogin: string | null;
  twoFactorEnabled: boolean;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Normal User' as const
  });
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Fetch users from API
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const token = localStorage.getItem('accessToken');
        if (!token) {
          setError('Authentication token not found. Please log in again.');
          setLoading(false);
          return;
        }
        
        const response = await apiClient.get('/users');
        
        if (response.data && Array.isArray(response.data.users)) {
          setUsers(response.data.users);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err: any) {
        console.error('Error fetching users:', err);
        setError('Failed to load users. ' + (err.response?.data?.error || err.message));
        // Show fallback data for development only if we're in development mode
        if (import.meta.env.DEV) {
          setUsers([
            {
              id: '1',
              username: 'admin',
              email: 'admin@redwan.work',
              role: 'Administrator',
              status: 'active',
              createdAt: '2025-05-01',
              lastLogin: '2 hours ago',
              twoFactorEnabled: true
            },
            {
              id: '2',
              username: 'manager1',
              email: 'manager@example.com',
              role: 'Manager',
              status: 'active',
              createdAt: '2025-05-10',
              lastLogin: '1 day ago',
              twoFactorEnabled: false
            },
            {
              id: '3',
              username: 'user1',
              email: 'user1@example.com',
              role: 'Normal User',
              status: 'suspended',
              createdAt: '2025-05-15',
              lastLogin: '5 days ago',
              twoFactorEnabled: false
            }
          ]);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, []);
  
  // Form validation
  const validateForm = () => {
    if (!newUser.username || newUser.username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return false;
    }
    
    if (!newUser.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email)) {
      toast.error('Please enter a valid email address');
      return false;
    }
    
    if (!newUser.password || newUser.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return false;
    }
    
    if (newUser.password !== newUser.confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }
    
    return true;
  };
  
  const handleCreateUser = async () => {
    if (!validateForm()) return;
    
    try {
      const response = await apiClient.post('/users', {
        username: newUser.username,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role
      });
      
      if (response.data && response.data.user) {
        setUsers([...users, response.data.user]);
        toast.success('User created successfully');
        setShowCreateModal(false);
        setNewUser({
          username: '',
          email: '',
          password: '',
          confirmPassword: '',
          role: 'Normal User'
        });
      } else {
        toast.error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('Error creating user:', err);
      toast.error(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleEditUser = (user: User) => {
    setCurrentUser(user);
    setShowEditModal(true);
  };
  
  const handleSaveEditedUser = async () => {
    if (!currentUser) return;
    
    try {
      const response = await apiClient.put(`/users/${currentUser.id}`, {
        username: currentUser.username,
        email: currentUser.email,
        role: currentUser.role
      });
      
      if (response.data && response.data.user) {
        setUsers(users.map(user => 
          user.id === currentUser.id ? response.data.user : user
        ));
        toast.success('User updated successfully');
        setShowEditModal(false);
      } else {
        toast.error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('Error updating user:', err);
      toast.error(err.response?.data?.error || 'Failed to update user');
    }
  };
  
  const handleToggleStatus = async (id: string) => {
    try {
      const user = users.find(u => u.id === id);
      if (!user) return;
      
      const newStatus = user.status === 'active' ? 'suspended' : 'active';
      
      const response = await apiClient.patch(`/users/${id}/status`, { 
        status: newStatus 
      });
      
      if (response.data && response.data.success) {
        setUsers(users.map(user => 
          user.id === id ? { 
            ...user, 
            status: newStatus
          } : user
        ));
        
        toast.success(`User ${newStatus === 'active' ? 'activated' : 'suspended'} successfully`);
      } else {
        toast.error('Failed to update user status');
      }
    } catch (err: any) {
      console.error('Error updating user status:', err);
      toast.error(err.response?.data?.error || 'Failed to update user status');
    }
  };
  
  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }
    
    try {
      const response = await apiClient.delete(`/users/${id}`);
      
      if (response.data && response.data.success) {
        setUsers(users.filter(user => user.id !== id));
        toast.success('User deleted successfully');
      } else {
        toast.error('Failed to delete user');
      }
    } catch (err: any) {
      console.error('Error deleting user:', err);
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
  };
  
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Administrator':
        return <Shield className="h-5 w-5 text-red-500" />;
      case 'Manager':
        return <UserCheck className="h-5 w-5 text-blue-500" />;
      case 'Normal User':
      default:
        return <User className="h-5 w-5 text-gray-500" />;
    }
  };
  
  return (
    <Layout title="User Management">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Manage Users</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create User
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading users...</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {users.map((user) => (
              <li key={user.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                        user.status === 'active' ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        {getRoleIcon(user.role)}
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <h3 className="text-sm font-medium text-gray-900">{user.username}</h3>
                          <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {user.status}
                          </span>
                          {user.twoFactorEnabled && (
                            <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              2FA Enabled
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          <span>{user.email}</span>
                          <span className="mx-2">•</span>
                          <span>{user.role}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">Last login: {user.lastLogin || 'Never'}</span>
                      <div className="flex space-x-1">
                        {user.status === 'active' ? (
                          <button
                            onClick={() => handleToggleStatus(user.id)}
                            className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            title="Suspend User"
                          >
                            <Lock className="h-5 w-5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(user.id)}
                            className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            title="Activate User"
                          >
                            <Unlock className="h-5 w-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEditUser(user)}
                          className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                          title="Edit User"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                          title="Delete User"
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
      
      {/* Create User Modal */}
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
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Create New User</h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Fill in the details below to create a new user account.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-5 sm:mt-6">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                      Username
                    </label>
                    <input
                      type="text"
                      id="username"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter username"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter email address"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                      Password
                    </label>
                    <input
                      type="password"
                      id="password"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      id="confirm-password"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Confirm password"
                      value={newUser.confirmPassword}
                      onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                      Role
                    </label>
                    <select
                      id="role"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                    >
                      <option value="Administrator">Administrator</option>
                      <option value="Manager">Manager</option>
                      <option value="Normal User">Normal User</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm"
                  onClick={handleCreateUser}
                >
                  Create User
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

      {/* Edit User Modal */}
      {showEditModal && currentUser && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                  <Edit className="h-6 w-6 text-blue-600" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Edit User</h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Update user details
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-5 sm:mt-6">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="edit-username" className="block text-sm font-medium text-gray-700">
                      Username
                    </label>
                    <input
                      type="text"
                      id="edit-username"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={currentUser.username}
                      onChange={(e) => setCurrentUser({ ...currentUser, username: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      type="email"
                      id="edit-email"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={currentUser.email}
                      onChange={(e) => setCurrentUser({ ...currentUser, email: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="edit-role" className="block text-sm font-medium text-gray-700">
                      Role
                    </label>
                    <select
                      id="edit-role"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={currentUser.role}
                      onChange={(e) => setCurrentUser({ ...currentUser, role: e.target.value as any })}
                    >
                      <option value="Administrator">Administrator</option>
                      <option value="Manager">Manager</option>
                      <option value="Normal User">Normal User</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm"
                  onClick={handleSaveEditedUser}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                  onClick={() => setShowEditModal(false)}
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

export default UserManagement;