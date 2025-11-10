import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Users } from 'lucide-react';
import { clientsAPI } from '../services/api';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    contact: ''
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await clientsAPI.getAll(true);
      setClients(response.data);
    } catch (error) {
      console.error('Error loading clients:', error);
      setError('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await clientsAPI.update(editingClient.id, formData);
      } else {
        await clientsAPI.create(formData);
      }
      
      setFormData({ name: '', email: '', contact: '' });
      setShowAddForm(false);
      setEditingClient(null);
      loadClients();
    } catch (error) {
      console.error('Error saving client:', error);
      setError(error.response?.data?.error || 'Failed to save client');
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email || '',
      contact: client.contact || ''
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    
    try {
      await clientsAPI.delete(id);
      loadClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      setError('Failed to delete client');
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (client.contact && client.contact.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const ClientForm = () => (
    <div className="glass-card p-6 lg:p-8">
      <h3 className="text-2xl font-bold gradient-text mb-6 font-display">
        {editingClient ? 'Edit Client' : 'Add New Client'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="relative">
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder=" "
            className="input-animated peer"
          />
          <label className="floating-label peer-focus:-top-2 peer-focus:left-3 peer-focus:text-xs peer-focus:bg-white peer-focus:px-2 peer-focus:text-blue-600">
            Name *
          </label>
        </div>
        <div className="relative">
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder=" "
            className="input-animated peer"
          />
          <label className="floating-label peer-focus:-top-2 peer-focus:left-3 peer-focus:text-xs peer-focus:bg-white peer-focus:px-2 peer-focus:text-blue-600">
            Email
          </label>
        </div>
        <div className="relative">
          <input
            type="text"
            value={formData.contact}
            onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
            placeholder=" "
            className="input-animated peer"
          />
          <label className="floating-label peer-focus:-top-2 peer-focus:left-3 peer-focus:text-xs peer-focus:bg-white peer-focus:px-2 peer-focus:text-blue-600">
            Contact
          </label>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            className="btn-gradient flex-1 sm:flex-initial"
          >
            {editingClient ? 'Update' : 'Add'} Client
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddForm(false);
              setEditingClient(null);
              setFormData({ name: '', email: '', contact: '' });
            }}
            className="glass-card px-6 py-3 rounded-xl font-medium text-gray-700 hover:text-red-600 hover:bg-red-50/50 transition-all duration-300"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glass-card p-6 animate-slide-up">
        <div>
          <h1 className="text-3xl font-bold gradient-text font-display">Clients</h1>
          <p className="mt-2 text-gray-600 flex items-center">
            <Users className="h-4 w-4 mr-2 text-blue-500" />
            Manage your client database
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-gradient inline-flex items-center group"
        >
          <Plus className="h-5 w-5 mr-2 group-hover:rotate-90 transition-transform" />
          Add Client
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="glass-card border-l-4 border-red-500 p-4 animate-slide-down">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-600 text-xl">⚠️</span>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-semibold text-red-800 mb-1">Error</h3>
              <div className="text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="animate-slide-down">
          <ClientForm />
        </div>
      )}

      {/* Search */}
      <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search clients by name, email, or contact..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-animated pl-12"
          />
        </div>
      </div>

      {/* Clients List */}
      <div className="glass-card animate-slide-up" style={{ animationDelay: '0.2s' }}>
        {loading ? (
          <div className="p-12 text-center">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading clients...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mb-4">
              <Users className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No clients found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm ? 'No clients match your search.' : 'Get started by adding your first client.'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="btn-gradient inline-flex items-center"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Client
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-blue-50/30">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-gray-200">
                  {filteredClients.map((client, index) => (
                    <tr 
                      key={client.id} 
                      className="table-row animate-fade-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">
                          {client.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600">
                          {client.email || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 font-mono">
                          {client.contact || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          client.source === 'master' 
                            ? 'bg-blue-100 text-blue-800'
                            : client.source === 'gmail'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {client.source}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(client)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(client.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
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

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-gray-200">
              {filteredClients.map((client, index) => (
                <div 
                  key={client.id}
                  className="p-4 hover:bg-blue-50/30 transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        {client.name}
                      </h3>
                      {client.email && (
                        <p className="text-xs text-gray-600 mb-1">
                          {client.email}
                        </p>
                      )}
                      {client.contact && (
                        <p className="text-xs text-gray-600 font-mono">
                          {client.contact}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      <button
                        onClick={() => handleEdit(client)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      client.source === 'master' 
                        ? 'bg-blue-100 text-blue-800'
                        : client.source === 'gmail'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {client.source}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
