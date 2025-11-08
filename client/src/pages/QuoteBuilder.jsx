import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, Download, TrendingUp, AlertCircle, CheckCircle, Save } from 'lucide-react';
import { materialsAPI, clientsAPI, priceHistoryAPI, searchAPI, quotesAPI } from '../services/api';

export default function QuoteBuilder() {
  const [materials, setMaterials] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [quoteItems, setQuoteItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatedQuote, setGeneratedQuote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [materialsRes, clientsRes] = await Promise.all([
        materialsAPI.getAll(),
        clientsAPI.getAll()
      ]);
      setMaterials(materialsRes.data);
      setClients(clientsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load materials and clients');
    } finally {
      setLoading(false);
    }
  };

  const addQuoteItem = () => {
    const newItem = {
      id: Date.now(),
      materialId: '',
      quantity: 1,
      unit: 'MT',
      ratePerUnit: 0,
      exWorks: 0,
      exWorksLocation: '',
      deliveryCost: 0,
      deliveryTerms: 'From Ready Stock',
      suggestedPrice: null,
      priceHistory: [],
      isLoadingPrice: false,
      priceError: null,
      lastQuotedDate: null,
      lastQuotedClient: null,
      priceSource: null,
      priceApplied: false,
      showPriceHistory: false
    };
    setQuoteItems([...quoteItems, newItem]);
  };

  const togglePriceHistory = (itemId) => {
    setQuoteItems(prevItems => {
      return prevItems.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            showPriceHistory: !item.showPriceHistory
          };
        }
        return item;
      });
    });
  };

  const applyHistoricalPrice = (itemId, price) => {
    setQuoteItems(prevItems => {
      return prevItems.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            ratePerUnit: price,
            priceApplied: true,
            showPriceHistory: false
          };
        }
        return item;
      });
    });
  };

  // Apply all suggested prices at once
  const applyAllSuggestedPrices = () => {
    const updatedItems = quoteItems.map(item => {
      if (item.suggestedPrice && !item.priceApplied) {
        return {
          ...item,
          ratePerUnit: item.suggestedPrice,
          priceApplied: true
        };
      }
      return item;
    });
    setQuoteItems(updatedItems);
  };

  const removeQuoteItem = (id) => {
    setQuoteItems(quoteItems.filter(item => item.id !== id));
  };

  const updateQuoteItem = (id, field, value) => {
    // Update state synchronously
    setQuoteItems(prevItems => {
      const updatedItems = prevItems.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          
          // If material changed, prepare for price loading
          if (field === 'materialId' && value) {
            updatedItem.isLoadingPrice = true;
            updatedItem.priceError = null;
          }
          
          return updatedItem;
        }
        return item;
      });
      
      // Fetch price suggestion after state update if material changed
      if (field === 'materialId' && value) {
        setTimeout(() => {
          fetchPriceSuggestion(id, value);
        }, 0);
      }
      
      return updatedItems;
    });
  };

  // Auto-refresh price suggestions when client changes
  const handleClientChange = (clientId) => {
    setSelectedClient(clientId);
    
    // Refresh price suggestions for all items that have materials selected
    quoteItems.forEach(item => {
      if (item.materialId) {
        updateQuoteItem(item.id, 'isLoadingPrice', true);
        fetchPriceSuggestion(item.id, item.materialId);
      }
    });
  };

  // Smart price application - applies suggested price with one click
  const applySuggestedPrice = (itemId) => {
    const updatedItems = quoteItems.map(item => {
      if (item.id === itemId && item.suggestedPrice) {
        return {
          ...item,
          ratePerUnit: item.suggestedPrice,
          priceApplied: true
        };
      }
      return item;
    });
    setQuoteItems(updatedItems);
  };

  const fetchPriceSuggestion = async (itemId, materialId) => {
    try {
      // Fetch all price history for this material (up to 20 records)
      const response = await priceHistoryAPI.getForMaterial(materialId, null, 20);
      const allPrices = response.data || [];
      
      // Also fetch the latest price for the selected client specifically
      let clientSpecificPrice = null;
      if (selectedClient) {
        try {
          const clientResponse = await priceHistoryAPI.getLatest(materialId, selectedClient);
          clientSpecificPrice = clientResponse.data;
        } catch (err) {
          console.log('No client-specific price found');
        }
      }
      
      // Determine the best suggested price
      const suggestedPrice = clientSpecificPrice?.rate_per_unit || 
                            (allPrices.length > 0 ? allPrices[0].rate_per_unit : null);
      
      // Use functional update to ensure we have the latest state
      setQuoteItems(prevItems => {
        return prevItems.map(item => {
          if (item.id === itemId) {
            return {
              ...item,
              suggestedPrice: suggestedPrice,
              priceHistory: allPrices, // Store all price history
              lastQuotedDate: clientSpecificPrice?.quoted_at || allPrices[0]?.quoted_at || null,
              lastQuotedClient: clientSpecificPrice?.client_name || allPrices[0]?.client_name || null,
              priceSource: clientSpecificPrice?.source || allPrices[0]?.source || null,
              isLoadingPrice: false,
              priceError: null,
              showPriceHistory: false // For toggling the history view
            };
          }
          return item;
        });
      });
    } catch (error) {
      console.error('Error fetching price suggestion:', error);
      
      // Use functional update for error state too
      setQuoteItems(prevItems => {
        return prevItems.map(item => {
          if (item.id === itemId) {
            return {
              ...item,
              isLoadingPrice: false,
              priceError: 'Failed to load price history',
              priceHistory: []
            };
          }
          return item;
        });
      });
    }
  };

  const calculateLineTotal = (item) => {
    const subtotal = item.quantity * item.ratePerUnit;
    return subtotal + (item.exWorks || 0);
  };

  const calculateGrandTotal = () => {
    return quoteItems.reduce((total, item) => total + calculateLineTotal(item), 0);
  };

  const generateMarkdownQuote = () => {
    if (!selectedClient || quoteItems.length === 0) {
      setError('Please select a client and add at least one item');
      return;
    }

    const client = clients.find(c => c.id == selectedClient);
    const date = new Date().toLocaleDateString();
    
    // Generate HTML table with beautiful styling (Gmail-compatible)
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto;">
        <h1 style="color: #1f2937; margin-bottom: 10px; font-size: 24px;">Quotation</h1>
        <div style="margin-bottom: 20px;">
          <p style="margin: 5px 0; color: #374151;"><strong>Client:</strong> ${client?.name || 'Unknown'}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Date:</strong> ${date}</p>
        </div>
        
        <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
          <thead>
            <tr style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);">
              <th style="padding: 12px 15px; text-align: left; color: white; font-weight: bold; border: 1px solid #2563eb;">No</th>
              <th style="padding: 12px 15px; text-align: left; color: white; font-weight: bold; border: 1px solid #2563eb;">Materials</th>
              <th style="padding: 12px 15px; text-align: center; color: white; font-weight: bold; border: 1px solid #2563eb;">QTY</th>
              <th style="padding: 12px 15px; text-align: center; color: white; font-weight: bold; border: 1px solid #2563eb;">Unit</th>
              <th style="padding: 12px 15px; text-align: right; color: white; font-weight: bold; border: 1px solid #2563eb;">Rate/Unit</th>
              <th style="padding: 12px 15px; text-align: left; color: white; font-weight: bold; border: 1px solid #2563eb;">Ex Works</th>
              <th style="padding: 12px 15px; text-align: left; color: white; font-weight: bold; border: 1px solid #2563eb;">Delivery</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    quoteItems.forEach((item, index) => {
      const material = materials.find(m => m.id == item.materialId);
      const exWorksDisplay = item.exWorksLocation || `₹${(item.exWorks || 0).toFixed(2)}`;
      const deliveryDisplay = item.deliveryTerms || 'From Ready Stock';
      const isEven = index % 2 === 0;
      
      html += `
            <tr style="background-color: ${isEven ? '#ffffff' : '#f9fafb'};">
              <td style="padding: 10px 15px; border: 1px solid #e5e7eb; color: #374151;">${index + 1}</td>
              <td style="padding: 10px 15px; border: 1px solid #e5e7eb; color: #1f2937; font-weight: 500;">${material?.name || 'Unknown'}</td>
              <td style="padding: 10px 15px; border: 1px solid #e5e7eb; text-align: center; color: #374151;">${item.quantity}</td>
              <td style="padding: 10px 15px; border: 1px solid #e5e7eb; text-align: center; color: #374151;">${item.unit}</td>
              <td style="padding: 10px 15px; border: 1px solid #e5e7eb; text-align: right; color: #374151;">₹${item.ratePerUnit.toFixed(2)}</td>
              <td style="padding: 10px 15px; border: 1px solid #e5e7eb; color: #374151;">${exWorksDisplay}</td>
              <td style="padding: 10px 15px; border: 1px solid #e5e7eb; color: #374151;">${deliveryDisplay}</td>
            </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
        
        <div style="margin-top: 20px; text-align: right; padding: 15px; background-color: #f3f4f6; border-radius: 6px;">
          <p style="margin: 0; font-size: 18px; color: #1f2937;">
            <strong>Total Amount: ₹${calculateGrandTotal().toFixed(2)}</strong>
          </p>
        </div>
      </div>
    `;
    
    setGeneratedQuote(html);
  };

  const copyToClipboard = async () => {
    try {
      // Create a temporary container with the HTML table
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.innerHTML = generatedQuote;
      document.body.appendChild(tempDiv);
      
      // Select all content
      const range = document.createRange();
      range.selectNodeContents(tempDiv);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Try modern Clipboard API first
      if (navigator.clipboard && window.ClipboardItem) {
        try {
          const htmlBlob = new Blob([generatedQuote], { type: 'text/html' });
          const textBlob = new Blob([generatePlainTextQuote()], { type: 'text/plain' });
          
          const clipboardItem = new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
          });
          
          await navigator.clipboard.write([clipboardItem]);
          document.body.removeChild(tempDiv);
          selection.removeAllRanges();
          alert('Quote copied! Paste into Gmail to see the formatted table.');
          return;
        } catch (clipboardError) {
          console.log('ClipboardItem failed, trying fallback:', clipboardError);
        }
      }
      
      // Fallback: Use execCommand which works better with Gmail
      const success = document.execCommand('copy');
      document.body.removeChild(tempDiv);
      selection.removeAllRanges();
      
      if (success) {
        alert('Quote copied! Paste into Gmail to see the formatted table.');
      } else {
        throw new Error('execCommand failed');
      }
    } catch (error) {
      console.error('Copy failed:', error);
      // Last resort: Copy HTML as text with instructions
      navigator.clipboard.writeText(generatedQuote).then(() => {
        alert('HTML copied to clipboard. For Gmail: Paste and then use "Paste without formatting" or insert the HTML directly.');
      }).catch(() => {
        alert('Copy failed. Please use the Download button to save the quote.');
      });
    }
  };

  const generatePlainTextQuote = () => {
    if (!selectedClient || quoteItems.length === 0) return '';
    
    const client = clients.find(c => c.id == selectedClient);
    const date = new Date().toLocaleDateString();
    
    let text = `Quotation\n\n`;
    text += `Client: ${client?.name || 'Unknown'}\n`;
    text += `Date: ${date}\n\n`;
    text += `No | Materials | QTY | Unit | Rate/Unit | Ex Works | Delivery\n`;
    text += `${'-'.repeat(80)}\n`;
    
    quoteItems.forEach((item, index) => {
      const material = materials.find(m => m.id == item.materialId);
      const exWorksDisplay = item.exWorksLocation || `₹${(item.exWorks || 0).toFixed(2)}`;
      const deliveryDisplay = item.deliveryTerms || 'From Ready Stock';
      text += `${index + 1} | ${material?.name || 'Unknown'} | ${item.quantity} | ${item.unit} | ₹${item.ratePerUnit.toFixed(2)} | ${exWorksDisplay} | ${deliveryDisplay}\n`;
    });
    
    text += `\nTotal Amount: ₹${calculateGrandTotal().toFixed(2)}\n`;
    
    return text;
  };

  const downloadQuote = () => {
    // Create a complete HTML document
    const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quotation</title>
</head>
<body>
    ${generatedQuote}
</body>
</html>`;
    
    const blob = new Blob([htmlDocument], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quote-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const saveQuote = async () => {
    if (!selectedClient || quoteItems.length === 0) {
      setError('Please select a client and add at least one item');
      return;
    }

    // Validate that all items have required fields
    const invalidItems = quoteItems.filter(item => 
      !item.materialId || item.quantity <= 0 || item.ratePerUnit <= 0
    );
    
    if (invalidItems.length > 0) {
      setError('Please fill in all required fields (Material, Quantity > 0, Rate > 0) for all items');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      const client = clients.find(c => c.id == selectedClient);
      
      // Prepare quote data
      const quoteData = {
        clientId: selectedClient,
        clientName: client?.name || '',
        date: new Date().toISOString(),
        totalAmount: calculateGrandTotal(),
        items: quoteItems.map(item => ({
          materialId: parseInt(item.materialId),
          quantity: parseFloat(item.quantity),
          unit: item.unit,
          ratePerUnit: parseFloat(item.ratePerUnit),
          exWorks: parseFloat(item.exWorks) || 0,
          exWorksLocation: item.exWorksLocation || null,
          deliveryCost: parseFloat(item.deliveryCost) || 0,
          deliveryTerms: item.deliveryTerms || 'From Ready Stock'
        }))
      };

      const response = await quotesAPI.create(quoteData);
      
      setSaving(false);
      setSaveSuccess(true);
      
      // Show success message
      alert(`Quote saved successfully! Quote ID: ${response.data.id}`);
      
      // Reset success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
      
      // Optionally clear the form or keep it for editing
      // Uncomment the lines below if you want to clear after saving
      // setSelectedClient('');
      // setQuoteItems([]);
      // setGeneratedQuote('');
      
    } catch (error) {
      console.error('Error saving quote:', error);
      setSaving(false);
      setError('Failed to save quote. Please try again.');
      alert('Failed to save quote: ' + (error.response?.data?.message || error.message));
    }
  };

  const PriceSuggestion = ({ item, itemId }) => {
    if (item.isLoadingPrice) {
      return (
        <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-gray-600 text-sm">Finding best price...</span>
          </div>
        </div>
      );
    }

    if (item.priceError) {
      return (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
            <span className="text-red-700 text-sm">{item.priceError}</span>
          </div>
        </div>
      );
    }

    if (!item.suggestedPrice) {
      return (
        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-yellow-600 mr-2" />
            <span className="text-yellow-800 text-sm">No price history found</span>
          </div>
          <div className="text-yellow-600 text-xs mt-1">
            This will be the first quote for this material
          </div>
        </div>
      );
    }

    const isClientSpecific = item.lastQuotedClient === clients.find(c => c.id == selectedClient)?.name;
    const quotedDate = new Date(item.lastQuotedDate);
    const daysAgo = Math.floor((new Date() - quotedDate) / (1000 * 60 * 60 * 24));
    
    return (
      <div className="mt-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <TrendingUp className="h-4 w-4 text-blue-600 mr-2" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-blue-800 font-semibold">
                  ₹{item.suggestedPrice.toFixed(2)}
                </span>
                {isClientSpecific && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                    Same Client
                  </span>
                )}
                {item.priceSource === 'gmail' && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                    Gmail
                  </span>
                )}
              </div>
              <div className="text-blue-600 text-xs mt-1">
                {isClientSpecific ? (
                  <>Last quoted to this client {daysAgo === 0 ? 'today' : `${daysAgo} days ago`}</>
                ) : (
                  <>Last quoted to {item.lastQuotedClient} {daysAgo === 0 ? 'today' : `${daysAgo} days ago`}</>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => applySuggestedPrice(itemId)}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Apply Price
          </button>
        </div>
        
        {item.priceApplied && (
          <div className="mt-2 flex items-center text-green-600 text-xs">
            <CheckCircle className="h-3 w-3 mr-1" />
            Price applied successfully
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quote Builder</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create quotations with intelligent price suggestions
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3 text-sm text-red-700">{error}</div>
          </div>
        </div>
      )}

      {/* Client Selection */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Select Client</h3>
        <select
          value={selectedClient}
          onChange={(e) => handleClientChange(e.target.value)}
          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">Choose a client...</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      {/* Quote Items */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Quote Items</h3>
              <p className="text-xs text-gray-500 mt-1">Compact table view • Headers & total stay visible while scrolling</p>
            </div>
            <div className="flex space-x-2">
              {quoteItems.some(item => item.suggestedPrice && !item.priceApplied) && (
                <button
                  onClick={applyAllSuggestedPrices}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Apply All Prices
                </button>
              )}
              <button
                onClick={addQuoteItem}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </button>
            </div>
          </div>
          
          {/* AI Insights */}
          {selectedClient && quoteItems.length > 0 && (
            <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-purple-900">AI Price Intelligence</h4>
                  <div className="text-sm text-purple-700">
                    {(() => {
                      const itemsWithPrices = quoteItems.filter(item => item.suggestedPrice);
                      const itemsFromGmail = quoteItems.filter(item => item.priceSource === 'gmail');
                      const clientSpecificItems = quoteItems.filter(item => 
                        item.lastQuotedClient === clients.find(c => c.id == selectedClient)?.name
                      );
                      
                      if (itemsWithPrices.length === 0) {
                        return "Add materials to see intelligent price suggestions";
                      }
                      
                      const insights = [];
                      if (clientSpecificItems.length > 0) {
                        insights.push(`${clientSpecificItems.length} items have client-specific pricing`);
                      }
                      if (itemsFromGmail.length > 0) {
                        insights.push(`${itemsFromGmail.length} prices sourced from Gmail`);
                      }
                      
                      return insights.length > 0 
                        ? insights.join(' • ') 
                        : `${itemsWithPrices.length} price suggestions available`;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {quoteItems.length === 0 ? (
            <div className="text-center py-8 px-6">
              <p className="text-gray-500">No items added yet. Click "Add Item" to get started.</p>
            </div>
          ) : (
            <div className="px-6 pb-6">
              {/* Compact Table View */}
              <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-[600px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12 bg-gray-50">#</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px] bg-gray-50">Material</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 bg-gray-50">QTY</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 bg-gray-50">Unit</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[160px] bg-gray-50">Rate/Unit (₹)</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px] bg-gray-50">Ex Works Location</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px] bg-gray-50">Delivery Terms</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32 bg-gray-50">Line Total</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16 bg-gray-50">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {quoteItems.map((item, index) => (
                      <tr key={item.id} className="hover:bg-blue-50 transition-colors">
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {index + 1}
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={item.materialId ? String(item.materialId) : ''}
                            onChange={(e) => updateQuoteItem(item.id, 'materialId', e.target.value)}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                          >
                            <option value="">Select material...</option>
                            {materials.map(material => (
                              <option key={material.id} value={String(material.id)}>
                                {material.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={item.quantity}
                            onChange={(e) => updateQuoteItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={item.unit}
                            onChange={(e) => updateQuoteItem(item.id, 'unit', e.target.value)}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                          >
                            <option value="MT">MT</option>
                            <option value="KG">KG</option>
                            <option value="Bag (25 kg)">Bag (25 kg)</option>
                            <option value="Nos">Nos</option>
                            <option value="PCS">PCS</option>
                            <option value="Sq.M (m²)">Sq.M (m²)</option>
                            <option value="mtr">mtr</option>
                            <option value="Roll">Roll</option>
                            <option value="Set">Set</option>
                            <option value="Box (Boxes)">Box (Boxes)</option>
                            <option value="Unit">Unit</option>
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.ratePerUnit}
                              onChange={(e) => updateQuoteItem(item.id, 'ratePerUnit', parseFloat(e.target.value) || 0)}
                              className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                            />
                            {item.isLoadingPrice && (
                              <div className="text-xs text-gray-500 flex items-center">
                                <div className="animate-spin rounded-full h-3 w-3 border-b border-primary-600 mr-1"></div>
                                Loading prices...
                              </div>
                            )}
                            
                            {!item.isLoadingPrice && item.priceHistory && item.priceHistory.length > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    onClick={() => togglePriceHistory(item.id)}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                  >
                                    <TrendingUp className="h-3 w-3" />
                                    {item.priceHistory.length} {item.priceHistory.length === 1 ? 'quote' : 'quotes'} found
                                  </button>
                                  {!item.priceApplied && item.suggestedPrice && (
                                    <button
                                      onClick={() => applySuggestedPrice(item.id)}
                                      className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                                      title="Apply suggested price"
                                    >
                                      Apply ₹{item.suggestedPrice.toFixed(2)}
                                    </button>
                                  )}
                                </div>
                                
                                {item.priceApplied && (
                                  <div className="text-xs text-green-600 flex items-center">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Price applied
                                  </div>
                                )}
                                
                                {/* Expandable Price History */}
                                {item.showPriceHistory && (
                                  <div className="absolute z-50 mt-1 w-[500px] bg-white border-2 border-blue-300 rounded-lg shadow-2xl p-4 max-h-[400px] overflow-y-auto">
                                    <div className="flex justify-between items-center mb-3 pb-2 border-b">
                                      <h4 className="font-semibold text-sm text-gray-900">
                                        Price History - {materials.find(m => m.id == item.materialId)?.name}
                                      </h4>
                                      <button
                                        onClick={() => togglePriceHistory(item.id)}
                                        className="text-gray-400 hover:text-gray-600"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      {item.priceHistory.map((historyItem, idx) => {
                                        const isCurrentClient = selectedClient && 
                                          historyItem.client_id == selectedClient;
                                        const quotedDate = new Date(historyItem.quoted_at);
                                        const daysAgo = Math.floor((new Date() - quotedDate) / (1000 * 60 * 60 * 24));
                                        
                                        return (
                                          <div
                                            key={idx}
                                            className={`p-3 rounded-lg border-2 transition-all ${
                                              isCurrentClient
                                                ? 'bg-green-50 border-green-300'
                                                : 'bg-gray-50 border-gray-200 hover:border-blue-300'
                                            }`}
                                          >
                                            <div className="flex justify-between items-start mb-2">
                                              <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                  <span className="font-semibold text-gray-900">
                                                    {historyItem.client_name}
                                                  </span>
                                                  {isCurrentClient && (
                                                    <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                                                      Current Client
                                                    </span>
                                                  )}
                                                  {historyItem.source === 'gmail' && (
                                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                                      📧 Gmail
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="text-xs text-gray-600">
                                                  {quotedDate.toLocaleDateString('en-IN', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                  })}
                                                  {' '}• {daysAgo === 0 ? 'Today' : `${daysAgo} days ago`}
                                                </div>
                                              </div>
                                              <button
                                                onClick={() => applyHistoricalPrice(item.id, historyItem.rate_per_unit)}
                                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                              >
                                                Use
                                              </button>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                              <div>
                                                <span className="text-gray-500">Rate/Unit:</span>
                                                <span className="ml-1 font-semibold text-gray-900">
                                                  ₹{historyItem.rate_per_unit.toFixed(2)}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Quantity:</span>
                                                <span className="ml-1 font-medium text-gray-700">
                                                  {historyItem.quantity || '-'} {historyItem.unit}
                                                </span>
                                              </div>
                                              {historyItem.ex_works_location && (
                                                <div className="col-span-2">
                                                  <span className="text-gray-500">Ex Works:</span>
                                                  <span className="ml-1 text-gray-700">
                                                    {historyItem.ex_works_location}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    
                                    <div className="mt-3 pt-3 border-t text-xs text-gray-500 text-center">
                                      Showing {item.priceHistory.length} most recent {item.priceHistory.length === 1 ? 'quote' : 'quotes'}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {!item.isLoadingPrice && item.materialId && (!item.priceHistory || item.priceHistory.length === 0) && (
                              <span className="text-xs text-gray-400">No price history</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={item.exWorksLocation || ''}
                            onChange={(e) => updateQuoteItem(item.id, 'exWorksLocation', e.target.value)}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                          >
                            <option value="">Select location...</option>
                            <option value="Wankaner (Gujarat)">Wankaner (Gujarat)</option>
                            <option value="Bhiwandi (Maharashtra)">Bhiwandi (Maharashtra)</option>
                            <option value="Butibori, Nagpur (Maharashtra)">Butibori, Nagpur (Maharashtra)</option>
                            <option value="Durgapur (West Bengal)">Durgapur (West Bengal)</option>
                            <option value="Katni (Madhya Pradesh)">Katni (Madhya Pradesh)</option>
                            <option value="Mumbai (Maharashtra)">Mumbai (Maharashtra)</option>
                            <option value="Bhiwandi, Mumbai (Maharashtra)">Bhiwandi, Mumbai (Maharashtra)</option>
                            <option value="Ahmedabad (Our Godown)">Ahmedabad (Our Godown)</option>
                            <option value="Bhiwandi, Ahmedabad (Our Godown)">Bhiwandi, Ahmedabad (Our Godown)</option>
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            <select
                              value={item.deliveryTerms === 'From Ready Stock' ? 'From Ready Stock' : 'custom'}
                              onChange={(e) => {
                                if (e.target.value === 'From Ready Stock') {
                                  updateQuoteItem(item.id, 'deliveryTerms', 'From Ready Stock');
                                } else {
                                  updateQuoteItem(item.id, 'deliveryTerms', '');
                                }
                              }}
                              className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                            >
                              <option value="From Ready Stock">From Ready Stock</option>
                              <option value="custom">Custom Timeline</option>
                            </select>
                            {item.deliveryTerms !== 'From Ready Stock' && (
                              <input
                                type="text"
                                placeholder="e.g., Within 2-3 weeks"
                                value={item.deliveryTerms || ''}
                                onChange={(e) => updateQuoteItem(item.id, 'deliveryTerms', e.target.value)}
                                className="block w-full text-xs border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                          ₹{calculateLineTotal(item).toFixed(2)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-center">
                          <button
                            onClick={() => removeQuoteItem(item.id)}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                            title="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 sticky bottom-0 z-10 shadow-lg border-t-2 border-gray-300">
                    <tr>
                      <td colSpan="7" className="px-3 py-4 text-right text-sm font-medium text-gray-700 bg-gray-50">
                        Grand Total:
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-right text-lg font-bold text-gray-900 bg-gray-50">
                        ₹{calculateGrandTotal().toFixed(2)}
                      </td>
                      <td className="bg-gray-50"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              {/* Quick Add Item button below table */}
              <div className="mt-4 text-center">
                <button
                  onClick={addQuoteItem}
                  className="inline-flex items-center px-4 py-2 border border-dashed border-primary-400 text-sm font-medium rounded-md text-primary-700 bg-primary-50 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Another Item
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save & Generate Quote */}
      {quoteItems.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Save & Generate Quote</h3>
            <div className="flex space-x-2">
              <button
                onClick={saveQuote}
                disabled={saving}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                  saving ? 'bg-gray-400 cursor-not-allowed' : 
                  saveSuccess ? 'bg-green-600 hover:bg-green-700' : 
                  'bg-green-600 hover:bg-green-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Quote
                  </>
                )}
              </button>
              <button
                onClick={generateMarkdownQuote}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Generate Quote
              </button>
            </div>
          </div>

          {generatedQuote && (
            <div>
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={copyToClipboard}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy HTML
                </button>
                <button
                  onClick={() => {
                    // Make table selectable and copy it
                    const tableDiv = document.getElementById('quote-table-preview');
                    if (tableDiv) {
                      const range = document.createRange();
                      range.selectNodeContents(tableDiv);
                      const selection = window.getSelection();
                      selection.removeAllRanges();
                      selection.addRange(range);
                      document.execCommand('copy');
                      selection.removeAllRanges();
                      alert('Table copied! Paste into Gmail to see the formatted table.');
                    }
                  }}
                  className="inline-flex items-center px-3 py-2 border border-primary-300 text-sm font-medium rounded-md text-primary-700 bg-primary-50 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy Table (Gmail)
                </button>
                <button
                  onClick={downloadQuote}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download HTML
                </button>
              </div>
              
              {/* Preview of the beautiful table */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 overflow-x-auto">
                <div 
                  id="quote-table-preview"
                  dangerouslySetInnerHTML={{ __html: generatedQuote }}
                  className="quote-preview select-all"
                  style={{ userSelect: 'all' }}
                />
              </div>
              
              {/* HTML Source Code (collapsible) */}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 mb-2">
                  View HTML Source Code
                </summary>
                <div className="bg-gray-50 border border-gray-200 rounded p-4 mt-2">
                  <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono overflow-x-auto">
                    {generatedQuote}
                  </pre>
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
