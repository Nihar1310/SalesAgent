import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, XCircle, Shield, Clock, Trash2, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(null);
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadUsers();
  }, [isAdmin, navigate]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error loading users:', error);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      setProcessing(userId);
      setError(null);
      await api.put(`/users/${userId}/approve`, { role: 'staff' });
      await loadUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      setError(error.response?.data?.error || 'Failed to approve user');
    } finally {
      setProcessing(null);
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      setProcessing(userId);
      setError(null);
      await api.put(`/users/${userId}/role`, { role: newRole });
      await loadUsers();
    } catch (error) {
      console.error('Error changing role:', error);
      setError(error.response?.data?.error || 'Failed to change role');
    } finally {
      setProcessing(null);
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    try {
      setProcessing(userId);
      setError(null);
      await api.put(`/users/${userId}/status`, { status: newStatus });
      await loadUsers();
    } catch (error) {
      console.error('Error toggling status:', error);
      setError(error.response?.data?.error || 'Failed to update status');
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }
    
    try {
      setProcessing(userId);
      setError(null);
      await api.delete(`/users/${userId}`);
      await loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      setError(error.response?.data?.error || 'Failed to delete user');
    } finally {
      setProcessing(null);
    }
  };

  const pendingUsers = users.filter(u => u.status === 'pending_approval');
  const activeUsers = users.filter(u => u.status === 'active');
  const inactiveUsers = users.filter(u => u.status === 'inactive');

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'staff':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="glass-card p-6 animate-slide-up">
        <div>
          <h1 className="text-3xl font-bold gradient-text font-display">User Management</h1>
          <p className="mt-2 text-gray-600 flex items-center">
            <Users className="h-4 w-4 mr-2 text-blue-500" />
            Manage user accounts and permissions
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="glass-card border-l-4 border-red-500 p-4 animate-slide-down">
          <div className="flex items-start">
            <XCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Pending Approvals */}
      {pendingUsers.length > 0 && (
        <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center mb-4">
            <Clock className="h-5 w-5 text-yellow-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">Pending Approvals ({pendingUsers.length})</h2>
          </div>
          
          <div className="space-y-3">
            {pendingUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{user.phone_number}</p>
                  <p className="text-sm text-gray-600">Registered: {new Date(user.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(user.id)}
                    disabled={processing === user.id}
                    className="btn-gradient inline-flex items-center px-4 py-2 disabled:opacity-50"
                  >
                    {processing === user.id ? (
                      <div className="spinner h-4 w-4 border-white"></div>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve as Staff
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    disabled={processing === user.id}
                    className="glass-card px-4 py-2 rounded-xl font-medium text-red-600 hover:bg-red-50/50 transition-all disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Users */}
      <div className="glass-card animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <UserCheck className="h-5 w-5 mr-2 text-green-600" />
            Active Users ({activeUsers.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading users...</p>
          </div>
        ) : activeUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No active users</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-blue-50/30">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Phone Number
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Display Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/50 divide-y divide-gray-200">
                {activeUsers.map((user, index) => (
                  <tr 
                    key={user.id} 
                    className="table-row animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{user.phone_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{user.display_name || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.role}
                        onChange={(e) => handleChangeRole(user.id, e.target.value)}
                        disabled={processing === user.id || user.role === 'super_admin'}
                        className={`text-xs px-3 py-1 rounded-full border font-semibold ${getRoleBadgeColor(user.role)} disabled:opacity-50 cursor-pointer`}
                      >
                        <option value="super_admin">Super Admin</option>
                        <option value="staff">Staff</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeColor(user.status)}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleToggleStatus(user.id, user.status)}
                          disabled={processing === user.id || user.role === 'super_admin'}
                          className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                            user.status === 'active' 
                              ? 'text-red-600 hover:bg-red-50' 
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={user.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          {user.status === 'active' ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={processing === user.id || user.role === 'super_admin'}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inactive Users */}
      {inactiveUsers.length > 0 && (
        <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Inactive Users ({inactiveUsers.length})</h2>
          <div className="space-y-2">
            {inactiveUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-semibold text-gray-900">{user.phone_number}</p>
                  <p className="text-sm text-gray-600">{user.display_name}</p>
                </div>
                <button
                  onClick={() => handleToggleStatus(user.id, user.status)}
                  disabled={processing === user.id}
                  className="glass-card px-4 py-2 rounded-xl font-medium text-green-600 hover:bg-green-50/50 transition-all disabled:opacity-50"
                >
                  {processing === user.id ? (
                    <div className="spinner h-4 w-4"></div>
                  ) : (
                    <>Reactivate</>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

