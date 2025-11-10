import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package, GitMerge, X, CheckCircle } from 'lucide-react';
import { materialsAPI } from '../services/api';

export default function Materials() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [keepMaterialId, setKeepMaterialId] = useState(null);
  const [merging, setMerging] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    hsnCode: ''
  });

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await materialsAPI.getAll(true);
      setMaterials(response.data);
    } catch (error) {
      console.error('Error loading materials:', error);
      setError('Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMaterial) {
        await materialsAPI.update(editingMaterial.id, formData);
      } else {
        await materialsAPI.create(formData);
      }
      
      setFormData({ name: '', description: '', hsnCode: '' });
      setShowAddForm(false);
      setEditingMaterial(null);
      loadMaterials();
    } catch (error) {
      console.error('Error saving material:', error);
      setError(error.response?.data?.error || 'Failed to save material');
    }
  };

  const handleEdit = (material) => {
    setEditingMaterial(material);
    setFormData({
      name: material.name,
      description: material.description || '',
      hsnCode: material.hsn_code || ''
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this material?')) return;
    
    try {
      await materialsAPI.delete(id);
      loadMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
      setError('Failed to delete material');
    }
  };

  const toggleMergeMode = () => {
    setMergeMode(!mergeMode);
    setSelectedMaterials([]);
    setError(null);
  };

  const toggleMaterialSelection = (materialId) => {
    setSelectedMaterials(prev => 
      prev.includes(materialId)
        ? prev.filter(id => id !== materialId)
        : [...prev, materialId]
    );
  };

  const handleMergeClick = () => {
    if (selectedMaterials.length < 2) {
      setError('Please select at least 2 materials to merge');
      return;
    }
    setKeepMaterialId(selectedMaterials[0]);
    setShowMergeModal(true);
  };

  const handleMergeConfirm = async () => {
    if (!keepMaterialId) {
      setError('Please select which material to keep');
      return;
    }

    const mergeMaterialIds = selectedMaterials.filter(id => id !== keepMaterialId);

    try {
      setMerging(true);
      setError(null);
      await materialsAPI.merge(keepMaterialId, mergeMaterialIds);
      
      setShowMergeModal(false);
      setMergeMode(false);
      setSelectedMaterials([]);
      setKeepMaterialId(null);
      
      loadMaterials();
    } catch (error) {
      console.error('Error merging materials:', error);
      setError(error.response?.data?.error || 'Failed to merge materials');
    } finally {
      setMerging(false);
    }
  };

  const filteredMaterials = materials.filter(material =>
    material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (material.description && material.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const MaterialForm = () => (
    <div className="glass-card p-6 lg:p-8">
      <h3 className="text-2xl font-bold gradient-text mb-6 font-display">
        {editingMaterial ? 'Edit Material' : 'Add New Material'}
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
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            placeholder=" "
            className="input-animated peer resize-none"
          />
          <label className="floating-label peer-focus:-top-2 peer-focus:left-3 peer-focus:text-xs peer-focus:bg-white peer-focus:px-2 peer-focus:text-blue-600">
            Description
          </label>
        </div>
        <div className="relative">
          <input
            type="text"
            value={formData.hsnCode}
            onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
            placeholder=" "
            className="input-animated peer"
          />
          <label className="floating-label peer-focus:-top-2 peer-focus:left-3 peer-focus:text-xs peer-focus:bg-white peer-focus:px-2 peer-focus:text-blue-600">
            HSN Code
          </label>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            className="btn-gradient flex-1 sm:flex-initial"
          >
            {editingMaterial ? 'Update' : 'Add'} Material
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddForm(false);
              setEditingMaterial(null);
              setFormData({ name: '', description: '', hsnCode: '' });
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
          <h1 className="text-3xl font-bold gradient-text font-display">Materials</h1>
          <p className="mt-2 text-gray-600 flex items-center">
            <Package className="h-4 w-4 mr-2 text-blue-500" />
            Manage your materials catalog
          </p>
        </div>
        <div className="flex gap-2">
          {!mergeMode ? (
            <>
              <button
                onClick={toggleMergeMode}
                className="glass-card px-4 py-2 rounded-xl font-medium text-purple-600 hover:bg-purple-50/50 transition-all duration-300 inline-flex items-center"
              >
                <GitMerge className="h-5 w-5 mr-2" />
                Merge Duplicates
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="btn-gradient inline-flex items-center group"
              >
                <Plus className="h-5 w-5 mr-2 group-hover:rotate-90 transition-transform" />
                Add Material
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleMergeClick}
                disabled={selectedMaterials.length < 2}
                className="btn-gradient inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <GitMerge className="h-5 w-5 mr-2" />
                Merge Selected ({selectedMaterials.length})
              </button>
              <button
                onClick={toggleMergeMode}
                className="glass-card px-4 py-2 rounded-xl font-medium text-red-600 hover:bg-red-50/50 transition-all duration-300 inline-flex items-center"
              >
                <X className="h-5 w-5 mr-2" />
                Cancel
              </button>
            </>
          )}
        </div>
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
          <MaterialForm />
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
            placeholder="Search materials by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-animated pl-12"
          />
        </div>
      </div>

      {/* Materials List */}
      <div className="glass-card animate-slide-up" style={{ animationDelay: '0.2s' }}>
        {loading ? (
          <div className="p-12 text-center">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading materials...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mb-4">
              <Package className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No materials found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm ? 'No materials match your search.' : 'Get started by adding your first material.'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="btn-gradient inline-flex items-center"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Material
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
                    {mergeMode && (
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Select
                      </th>
                    )}
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      HSN Code
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Source
                    </th>
                    {!mergeMode && (
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-gray-200">
                  {filteredMaterials.map((material, index) => (
                    <tr 
                      key={material.id} 
                      className={`table-row animate-fade-in ${mergeMode ? 'cursor-pointer hover:bg-purple-50/30' : ''} ${selectedMaterials.includes(material.id) ? 'bg-purple-50/50' : ''}`}
                      style={{ animationDelay: `${index * 0.05}s` }}
                      onClick={() => mergeMode && toggleMaterialSelection(material.id)}
                    >
                      {mergeMode && (
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedMaterials.includes(material.id)}
                            onChange={() => toggleMaterialSelection(material.id)}
                            className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">
                          {material.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 max-w-xs">
                          {material.description || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 font-mono">
                          {material.hsn_code || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          material.source === 'master' 
                            ? 'bg-blue-100 text-blue-800'
                            : material.source === 'gmail'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {material.source}
                        </span>
                      </td>
                      {!mergeMode && (
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(material);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(material.id);
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-gray-200">
              {filteredMaterials.map((material, index) => (
                <div 
                  key={material.id}
                  className="p-4 hover:bg-blue-50/30 transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        {material.name}
                      </h3>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {material.description || 'No description'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      <button
                        onClick={() => handleEdit(material)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(material.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <span className="text-gray-500">
                        HSN: <span className="font-mono text-gray-700">{material.hsn_code || 'N/A'}</span>
                      </span>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      material.source === 'master' 
                        ? 'bg-blue-100 text-blue-800'
                        : material.source === 'gmail'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {material.source}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Merge Confirmation Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-card max-w-2xl w-full p-6 animate-scale-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold gradient-text flex items-center">
                <GitMerge className="h-6 w-6 mr-2" />
                Merge Materials
              </h3>
              <button
                onClick={() => setShowMergeModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={merging}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                Select which material to keep. All price history from the other materials will be merged into this one, 
                and the duplicate materials will be deleted.
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> This action cannot be undone. {selectedMaterials.length - 1} material(s) will be deleted.
                </p>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {selectedMaterials.map(materialId => {
                  const material = materials.find(m => m.id === materialId);
                  if (!material) return null;
                  
                  return (
                    <label
                      key={materialId}
                      className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        keepMaterialId === materialId
                          ? 'border-purple-500 bg-purple-50/50'
                          : 'border-gray-200 hover:border-purple-300 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="keepMaterial"
                        value={materialId}
                        checked={keepMaterialId === materialId}
                        onChange={() => setKeepMaterialId(materialId)}
                        className="mt-1 h-5 w-5 text-purple-600 focus:ring-purple-500"
                        disabled={merging}
                      />
                      <div className="ml-3 flex-1">
                        <div className="font-semibold text-gray-900 flex items-center">
                          {material.name}
                          {keepMaterialId === materialId && (
                            <CheckCircle className="h-5 w-5 ml-2 text-purple-600" />
                          )}
                        </div>
                        {material.description && (
                          <p className="text-sm text-gray-600 mt-1">{material.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {material.hsn_code && (
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                              HSN: {material.hsn_code}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-1 rounded ${
                            material.source === 'master' 
                              ? 'bg-blue-100 text-blue-800'
                              : material.source === 'gmail'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {material.source}
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleMergeConfirm}
                disabled={!keepMaterialId || merging}
                className="btn-gradient flex-1 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
              >
                {merging ? (
                  <>
                    <div className="spinner h-5 w-5 mr-2 border-white"></div>
                    Merging...
                  </>
                ) : (
                  <>
                    <GitMerge className="h-5 w-5 mr-2" />
                    Merge Materials
                  </>
                )}
              </button>
              <button
                onClick={() => setShowMergeModal(false)}
                disabled={merging}
                className="glass-card px-6 py-3 rounded-xl font-medium text-gray-700 hover:text-red-600 hover:bg-red-50/50 transition-all duration-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
