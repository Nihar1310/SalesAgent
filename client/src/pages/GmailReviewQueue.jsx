import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Edit3, 
  Mail, 
  Clock, 
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Save,
  Inbox
} from 'lucide-react';
import { gmailAPI } from '../services/api';

const GmailReviewQueue = () => {
  const [reviewItems, setReviewItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [processing, setProcessing] = useState(false);
  const [corrections, setCorrections] = useState({});
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState(null);

  useEffect(() => {
    fetchReviewItems();
  }, [filter]);

  useEffect(() => {
    if (!selectedItem) return;

    let parsed;
    try {
      parsed = JSON.parse(selectedItem.extracted_data || '{}');
    } catch (error) {
      parsed = {};
    }

    const normalized = {
      client: parsed.client ? { ...parsed.client } : {},
      items: Array.isArray(parsed.items) ? parsed.items.map(item => ({ ...item })) : [],
      terms: parsed.terms ? { ...parsed.terms } : {},
      metadata: parsed.metadata ? { ...parsed.metadata } : {},
    };

    setCorrections((prev) => {
      if (prev[selectedItem.id]) {
        return prev;
      }
      return {
        ...prev,
        [selectedItem.id]: normalized,
      };
    });
  }, [selectedItem]);

  const fetchReviewItems = async () => {
    try {
      setLoading(true);
      const response = await gmailAPI.getReviewQueue(filter, searchTerm);
      setReviewItems(response.data.items || []);
    } catch (error) {
      console.error('Error fetching review items:', error);
      // If auth error, user might need to log in again
      if (error.response?.status === 401) {
        console.error('Authentication failed. Please log in again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleIngest = async () => {
    try {
      setIngesting(true);
      setIngestResult(null);
      const response = await gmailAPI.triggerIngestion();
      setIngestResult(response.data);
      
      // Refresh review items after ingestion
      setTimeout(() => {
        fetchReviewItems();
      }, 1000);
    } catch (error) {
      console.error('Error ingesting emails:', error);
      setIngestResult({ 
        success: false, 
        error: error.response?.data?.error || 'Failed to ingest emails' 
      });
    } finally {
      setIngesting(false);
    }
  };

  const handleApprove = async (itemId) => {
    try {
      setProcessing(true);
      await gmailAPI.approveReview(itemId);
      await fetchReviewItems();
      if (selectedItem?.id === itemId) {
        setSelectedItem(null);
      }
      setCorrections((prev) => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
    } catch (error) {
      console.error('Error approving item:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (itemId) => {
    try {
      setProcessing(true);
      await gmailAPI.rejectReview(itemId);
      await fetchReviewItems();
      if (selectedItem?.id === itemId) {
        setSelectedItem(null);
      }
      setCorrections((prev) => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
    } catch (error) {
      console.error('Error rejecting item:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleCorrect = async (itemId) => {
    try {
      setProcessing(true);
      const payload = corrections[itemId] ? prepareCorrectionsPayload(corrections[itemId]) : {};
      await gmailAPI.correctReview(itemId, payload);
      await fetchReviewItems();
      if (selectedItem?.id === itemId) {
        setSelectedItem(null);
      }
      setCorrections(prev => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
    } catch (error) {
      console.error('Error correcting item:', error);
    } finally {
      setProcessing(false);
    }
  };

  const updateCorrectionField = (itemId, path, value) => {
    setCorrections(prev => {
      const current = prev[itemId] ? JSON.parse(JSON.stringify(prev[itemId])) : {};
      let cursor = current;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (cursor[key] === undefined) {
          cursor[key] = typeof path[i + 1] === 'number' ? [] : {};
        }
        cursor = cursor[key];
      }
      cursor[path[path.length - 1]] = value;

      return {
        ...prev,
        [itemId]: current
      };
    });
  };

  const prepareCorrectionsPayload = (data) => {
    const clone = JSON.parse(JSON.stringify(data));

    if (Array.isArray(clone.items)) {
      clone.items = clone.items.map((item) => ({
        ...item,
        quantity: item.quantity === '' || item.quantity === undefined || item.quantity === null
          ? null
          : Number(item.quantity),
        ratePerUnit: item.ratePerUnit === '' || item.ratePerUnit === undefined || item.ratePerUnit === null
          ? null
          : Number(item.ratePerUnit),
      }));
    }

    return clone;
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-100';
    if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'approved': return 'text-green-600 bg-green-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      case 'corrected': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const parseExtractedData = (dataString) => {
    try {
      const parsed = JSON.parse(dataString);
      return {
        client: parsed.client ? { ...parsed.client } : {},
        items: Array.isArray(parsed.items) ? parsed.items.map((item) => ({ ...item })) : [],
        terms: parsed.terms ? { ...parsed.terms } : {},
        metadata: parsed.metadata ? { ...parsed.metadata } : {},
        confidence: parsed.confidence || 0,
      };
    } catch {
      return {
        client: {},
        items: [],
        terms: {},
        metadata: {},
        confidence: 0,
      };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Gmail Review Queue</h1>
              <p className="text-gray-600">Review and approve low-confidence email extractions</p>
            </div>
            <button
              onClick={handleIngest}
              disabled={ingesting}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg transition-all"
            >
              <Inbox className={`h-5 w-5 ${ingesting ? 'animate-pulse' : ''}`} />
              {ingesting ? 'Ingesting...' : 'Ingest Emails'}
            </button>
          </div>

          {/* Ingest Result */}
          {ingestResult && (
            <div className={`mt-4 p-4 rounded-lg border ${ingestResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-3">
                {ingestResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3 className={`font-semibold ${ingestResult.success ? 'text-green-900' : 'text-red-900'}`}>
                    {ingestResult.success ? 'Ingestion Complete!' : 'Ingestion Failed'}
                  </h3>
                  {ingestResult.success ? (
                    <div className="mt-2 text-sm text-green-800 space-y-1">
                      <p>✓ Processed <strong>{ingestResult.processedEmails}</strong> emails</p>
                      <p>✓ New materials: <strong>{ingestResult.newMaterials}</strong> | New clients: <strong>{ingestResult.newClients}</strong> | New prices: <strong>{ingestResult.newPriceEntries}</strong></p>
                      {ingestResult.errors && ingestResult.errors.length > 0 && (
                        <p className="text-yellow-700">⚠️ {ingestResult.errors.length} errors occurred</p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-red-700">{ingestResult.error}</p>
                  )}
                </div>
                <button
                  onClick={() => setIngestResult(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search emails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="corrected">Corrected</option>
                <option value="all">All Items</option>
              </select>
            </div>

            <button
              onClick={fetchReviewItems}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Review Items List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Review Items ({reviewItems.length})
                </h2>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500">Loading...</p>
                  </div>
                ) : reviewItems.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle className="h-8 w-8 mx-auto text-green-400 mb-2" />
                    <p className="text-gray-500">No items to review</p>
                  </div>
                ) : (
                  reviewItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                        selectedItem?.id === item.id ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {item.subject || 'No Subject'}
                          </span>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                        <span className="truncate">{item.sender_email}</span>
                        <span className={`px-2 py-1 rounded-full ${getConfidenceColor(item.confidence)}`}>
                          {Math.round(item.confidence * 100)}%
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(item.created_at)}</span>
                        <span className="ml-auto">{item.method}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Email Preview and Correction Interface */}
          <div className="lg:col-span-2">
            {selectedItem ? (
              <div className="space-y-6">
                {/* Email Details */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Email Details</h3>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${getConfidenceColor(selectedItem.confidence)}`}>
                        Confidence: {Math.round(selectedItem.confidence * 100)}%
                      </span>
                      <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-700">
                        {selectedItem.method}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="font-medium text-gray-700">Subject:</label>
                      <p className="text-gray-900 mt-1">{selectedItem.subject || 'No Subject'}</p>
                    </div>
                    <div>
                      <label className="font-medium text-gray-700">From:</label>
                      <p className="text-gray-900 mt-1">{selectedItem.sender_email}</p>
                    </div>
                    <div>
                      <label className="font-medium text-gray-700">Date:</label>
                      <p className="text-gray-900 mt-1">{formatDate(selectedItem.created_at)}</p>
                    </div>
                    <div>
                      <label className="font-medium text-gray-700">Thread ID:</label>
                      <p className="text-gray-900 mt-1 font-mono text-xs">{selectedItem.thread_id}</p>
                    </div>
                  </div>
                </div>

                {/* Extracted Data */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Extracted Data</h3>
                  
                  {(() => {
                    const extractedData = parseExtractedData(selectedItem.extracted_data);
                    const editableData = corrections[selectedItem.id] || extractedData;
                    return (
                      <div className="space-y-6">
                        {/* Client Information */}
                        {editableData.client && (
                          <div>
                            <h4 className="font-medium text-gray-700 mb-2">Client Information</h4>
                            <div className="bg-gray-50 rounded-md p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <label className="font-medium text-gray-600">Name:</label>
                                  <input
                                    type="text"
                                    value={editableData.client.name || ''}
                                    onChange={(e) =>
                                      updateCorrectionField(selectedItem.id, ['client', 'name'], e.target.value)
                                    }
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                  />
                                </div>
                                <div>
                                  <label className="font-medium text-gray-600">Email:</label>
                                  <input
                                    type="email"
                                    value={editableData.client.email || ''}
                                    onChange={(e) =>
                                      updateCorrectionField(selectedItem.id, ['client', 'email'], e.target.value)
                                    }
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="font-medium text-gray-600">Contact Person:</label>
                                  <input
                                    type="text"
                                    value={editableData.client.contactPerson || ''}
                                    onChange={(e) =>
                                      updateCorrectionField(
                                        selectedItem.id,
                                        ['client', 'contactPerson'],
                                        e.target.value
                                      )
                                    }
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Quotation Items */}
                        {editableData.items && editableData.items.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-700 mb-2">
                              Quotation Items ({editableData.items.length})
                            </h4>
                            <div className="space-y-3">
                              {editableData.items.map((item, index) => (
                                <div key={index} className="bg-gray-50 rounded-md p-4 space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div className="md:col-span-2">
                                      <label className="font-medium text-gray-600">Material:</label>
                                      <input
                                        type="text"
                                        value={item.material || ''}
                                        onChange={(e) =>
                                          updateCorrectionField(
                                            selectedItem.id,
                                            ['items', index, 'material'],
                                            e.target.value
                                          )
                                        }
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="font-medium text-gray-600">HSN Code:</label>
                                      <input
                                        type="text"
                                        value={item.hsnCode || ''}
                                        onChange={(e) =>
                                          updateCorrectionField(
                                            selectedItem.id,
                                            ['items', index, 'hsnCode'],
                                            e.target.value
                                          )
                                        }
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="font-medium text-gray-600">Quantity:</label>
                                      <input
                                        type="number"
                                        value={item.quantity ?? ''}
                                        onChange={(e) =>
                                          updateCorrectionField(
                                            selectedItem.id,
                                            ['items', index, 'quantity'],
                                            e.target.value
                                          )
                                        }
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="font-medium text-gray-600">Unit:</label>
                                      <input
                                        type="text"
                                        value={item.unit || ''}
                                        onChange={(e) =>
                                          updateCorrectionField(
                                            selectedItem.id,
                                            ['items', index, 'unit'],
                                            e.target.value
                                          )
                                        }
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="font-medium text-gray-600">Rate per Unit:</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={item.ratePerUnit ?? ''}
                                      onChange={(e) =>
                                          updateCorrectionField(
                                            selectedItem.id,
                                            ['items', index, 'ratePerUnit'],
                                            e.target.value
                                          )
                                        }
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                      />
                                    </div>
                                    {item.exWorks && (
                                      <div>
                                        <label className="font-medium text-gray-600">Ex Works:</label>
                                        <input
                                          type="text"
                                          value={item.exWorks || ''}
                                          onChange={(e) =>
                                            updateCorrectionField(
                                              selectedItem.id,
                                              ['items', index, 'exWorks'],
                                              e.target.value
                                            )
                                          }
                                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                        />
                                      </div>
                                    )}
                                    <div>
                                      <label className="font-medium text-gray-600">Confidence:</label>
                                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getConfidenceColor(item.confidence || 0)}`}>
                                        {Math.round((item.confidence || 0) * 100)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Terms */}
                        {editableData.terms && Object.keys(editableData.terms).length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-700 mb-2">Terms</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {Object.entries(editableData.terms).map(([key, value]) => (
                                <div key={key}>
                                  <label className="font-medium text-gray-600 capitalize">{key}:</label>
                                  <input
                                    type="text"
                                    value={value || ''}
                                    onChange={(e) =>
                                      updateCorrectionField(selectedItem.id, ['terms', key], e.target.value)
                                    }
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Metadata */}
                        {editableData.metadata && Object.keys(editableData.metadata).length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-700 mb-2">Metadata</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {Object.entries(editableData.metadata).map(([key, value]) => (
                                <div key={key}>
                                  <label className="font-medium text-gray-600 capitalize">{key}:</label>
                                  <input
                                    type="text"
                                    value={value || ''}
                                    onChange={(e) =>
                                      updateCorrectionField(selectedItem.id, ['metadata', key], e.target.value)
                                    }
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Action Buttons */}
                {selectedItem.status === 'pending' && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Actions</h3>
                    
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleApprove(selectedItem.id)}
                        disabled={processing}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                      >
                        <ThumbsUp className="h-4 w-4" />
                        Approve
                      </button>
                      
                      <button
                        onClick={() => handleReject(selectedItem.id)}
                        disabled={processing}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                      >
                        <ThumbsDown className="h-4 w-4" />
                        Reject
                      </button>
                      
                      <button
                        onClick={() => handleCorrect(selectedItem.id)}
                        disabled={processing}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Edit3 className="h-4 w-4" />
                        Correct & Save
                      </button>
                    </div>
                    
                    {processing && (
                      <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Processing...
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <Eye className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select an item to review</h3>
                <p className="text-gray-500">Choose an email from the list to view details and take action</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GmailReviewQueue;


