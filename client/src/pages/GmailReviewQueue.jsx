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
  Save
} from 'lucide-react';

const GmailReviewQueue = () => {
  const [reviewItems, setReviewItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [processing, setProcessing] = useState(false);
  const [corrections, setCorrections] = useState({});

  useEffect(() => {
    fetchReviewItems();
  }, [filter]);

  const fetchReviewItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/gmail/review-queue?status=${filter}&search=${searchTerm}`);
      const data = await response.json();
      setReviewItems(data.items || []);
    } catch (error) {
      console.error('Error fetching review items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (itemId) => {
    try {
      setProcessing(true);
      const response = await fetch(`/api/gmail/review-queue/${itemId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        await fetchReviewItems();
        if (selectedItem?.id === itemId) {
          setSelectedItem(null);
        }
      }
    } catch (error) {
      console.error('Error approving item:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (itemId) => {
    try {
      setProcessing(true);
      const response = await fetch(`/api/gmail/review-queue/${itemId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        await fetchReviewItems();
        if (selectedItem?.id === itemId) {
          setSelectedItem(null);
        }
      }
    } catch (error) {
      console.error('Error rejecting item:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleCorrect = async (itemId) => {
    try {
      setProcessing(true);
      const response = await fetch(`/api/gmail/review-queue/${itemId}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corrections: corrections[itemId] || {} })
      });
      
      if (response.ok) {
        await fetchReviewItems();
        if (selectedItem?.id === itemId) {
          setSelectedItem(null);
        }
        setCorrections(prev => ({ ...prev, [itemId]: {} }));
      }
    } catch (error) {
      console.error('Error correcting item:', error);
    } finally {
      setProcessing(false);
    }
  };

  const updateCorrection = (itemId, field, value) => {
    setCorrections(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
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
      return JSON.parse(dataString);
    } catch {
      return { items: [], client: {}, confidence: 0 };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gmail Review Queue</h1>
          <p className="text-gray-600">Review and approve low-confidence email extractions</p>
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
                    return (
                      <div className="space-y-6">
                        {/* Client Information */}
                        {extractedData.client && (
                          <div>
                            <h4 className="font-medium text-gray-700 mb-2">Client Information</h4>
                            <div className="bg-gray-50 rounded-md p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <label className="font-medium text-gray-600">Name:</label>
                                  <p className="text-gray-900">{extractedData.client.name || 'N/A'}</p>
                                </div>
                                <div>
                                  <label className="font-medium text-gray-600">Email:</label>
                                  <p className="text-gray-900">{extractedData.client.email || 'N/A'}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Quotation Items */}
                        {extractedData.items && extractedData.items.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-700 mb-2">
                              Quotation Items ({extractedData.items.length})
                            </h4>
                            <div className="space-y-3">
                              {extractedData.items.map((item, index) => (
                                <div key={index} className="bg-gray-50 rounded-md p-4">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div className="md:col-span-2">
                                      <label className="font-medium text-gray-600">Material:</label>
                                      <p className="text-gray-900 font-medium">{item.material || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <label className="font-medium text-gray-600">HSN Code:</label>
                                      <p className="text-gray-900">{item.hsnCode || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <label className="font-medium text-gray-600">Quantity:</label>
                                      <p className="text-gray-900">{item.quantity || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <label className="font-medium text-gray-600">Unit:</label>
                                      <p className="text-gray-900">{item.unit || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <label className="font-medium text-gray-600">Rate per Unit:</label>
                                      <p className="text-gray-900 font-semibold">
                                        ₹{item.ratePerUnit ? item.ratePerUnit.toFixed(2) : 'N/A'}
                                      </p>
                                    </div>
                                    {item.exWorks && (
                                      <div>
                                        <label className="font-medium text-gray-600">Ex Works:</label>
                                        <p className="text-gray-900">{item.exWorks}</p>
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


