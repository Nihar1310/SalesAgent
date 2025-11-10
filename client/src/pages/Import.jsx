import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { importAPI } from '../services/api';

export default function Import() {
  const [importState, setImportState] = useState({
    loading: false,
    result: null,
    error: null,
    memoryAnalysis: null
  });

  const [fileUpload, setFileUpload] = useState({
    loading: false,
    result: null,
    error: null,
    selectedFile: null
  });

  const importMasterData = async () => {
    try {
      setImportState({ loading: true, result: null, error: null });
      const response = await importAPI.importMasterData();
      setImportState({ 
        loading: false, 
        result: response.data.result, 
        error: null 
      });
    } catch (error) {
      console.error('Import error:', error);
      setImportState({ 
        loading: false, 
        result: null, 
        error: error.response?.data?.error || 'Import failed' 
      });
    }
  };

  const analyzeMemoryFile = async () => {
    try {
      setImportState(prev => ({ ...prev, loading: true }));
      const response = await importAPI.analyzeMemory();
      setImportState(prev => ({ 
        ...prev, 
        loading: false, 
        memoryAnalysis: response.data 
      }));
    } catch (error) {
      console.error('Analysis error:', error);
      setImportState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error.response?.data?.error || 'Analysis failed' 
      }));
    }
  };

  const handleFileUpload = async (file) => {
    try {
      setFileUpload({ loading: true, result: null, error: null, selectedFile: file });
      const response = await importAPI.uploadFile(file);
      setFileUpload({ 
        loading: false, 
        result: response.data.result, 
        error: null, 
        selectedFile: null 
      });
    } catch (error) {
      console.error('File upload error:', error);
      setFileUpload({ 
        loading: false, 
        result: null, 
        error: error.response?.data?.error || 'Upload failed',
        selectedFile: null 
      });
    }
  };

  const ImportResult = ({ result, title }) => {
    if (!result) return null;

    return (
      <div className="mt-6 glass-card p-6 animate-slide-down">
        <h3 className="text-lg font-bold text-gray-900 mb-6 font-display flex items-center">
          <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
          {title}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Materials Results */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/30 rounded-xl">
            <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
              <Package className="h-5 w-5 text-blue-600 mr-2" />
              Materials
            </h4>
            <div className="space-y-2">
              <div className="flex items-center p-2 bg-white/50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                <span className="text-sm font-medium">Imported: {result.materials.imported}</span>
              </div>
              <div className="flex items-center p-2 bg-white/50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0" />
                <span className="text-sm font-medium">Skipped: {result.materials.skipped}</span>
              </div>
              {result.materials.errors.length > 0 && (
                <div className="flex items-center">
                  <XCircle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-sm">Errors: {result.materials.errors.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Clients Results */}
          <div className="p-4 bg-gradient-to-br from-green-50 to-green-100/30 rounded-xl">
            <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
              <Users className="h-5 w-5 text-green-600 mr-2" />
              Clients
            </h4>
            <div className="space-y-2">
              <div className="flex items-center p-2 bg-white/50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                <span className="text-sm font-medium">Imported: {result.clients.imported}</span>
              </div>
              <div className="flex items-center p-2 bg-white/50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0" />
                <span className="text-sm font-medium">Skipped: {result.clients.skipped}</span>
              </div>
              {result.clients.errors.length > 0 && (
                <div className="flex items-center">
                  <XCircle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-sm">Errors: {result.clients.errors.length}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Details */}
        {(result.materials.errors.length > 0 || result.clients.errors.length > 0) && (
          <div className="mt-6">
            <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
              <XCircle className="h-5 w-5 text-red-500 mr-2" />
              Error Details
            </h4>
            <div className="glass-card border-l-4 border-red-500 p-4 max-h-40 overflow-y-auto">
              <pre className="text-xs text-red-700 font-mono">
                {JSON.stringify([...result.materials.errors, ...result.clients.errors], null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="glass-card p-6 animate-slide-up">
        <h1 className="text-3xl font-bold gradient-text font-display">Import Data</h1>
        <p className="mt-2 text-gray-600 flex items-center">
          <Upload className="h-4 w-4 mr-2 text-blue-500" />
          Import materials and clients from Excel files
        </p>
      </div>

      {/* Memory.xlsx Import */}
      <div className="glass-card p-6 lg:p-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-start space-x-4 mb-6">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 font-display">
              Import Master Data (Memory.xlsx)
            </h3>
            <p className="mt-1 text-gray-600">
              Import your complete materials and clients list from the Memory.xlsx file.
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={importMasterData}
            disabled={importState.loading}
            className="btn-gradient inline-flex items-center justify-center ripple"
          >
            {importState.loading ? (
              <>
                <div className="spinner h-5 w-5 mr-2 border-2"></div>
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 mr-2" />
                Import Master Data
              </>
            )}
          </button>
          
          <button
            onClick={analyzeMemoryFile}
            disabled={importState.loading}
            className="glass-card px-6 py-3 rounded-xl font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50/50 transition-all duration-300 inline-flex items-center justify-center"
          >
            <FileText className="h-5 w-5 mr-2" />
            Analyze Structure
          </button>
        </div>

        {/* Memory Analysis Results */}
        {importState.memoryAnalysis && (
          <div className="mt-6 glass-card p-4 border-l-4 border-blue-500 animate-slide-down">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
              <CheckCircle className="h-5 w-5 text-blue-500 mr-2" />
              File Structure
            </h4>
            <div className="text-sm text-gray-700 space-y-2">
              <p><strong>Sheets:</strong> {importState.memoryAnalysis.sheetNames.join(', ')}</p>
              {Object.entries(importState.memoryAnalysis.sheets).map(([sheetName, info]) => (
                <div key={sheetName} className="pl-4 border-l-2 border-gray-200">
                  <p className="font-medium">{sheetName}: {info.rowCount} rows</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Headers: {info.headers.join(', ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {importState.error && (
          <div className="mt-6 glass-card border-l-4 border-red-500 p-4 animate-slide-down">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-semibold text-red-800 mb-1">Import Error</h3>
                <div className="text-sm text-red-700">{importState.error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Import Results */}
        <ImportResult result={importState.result} title="Import Results" />
      </div>

      {/* File Upload */}
      <div className="glass-card p-6 lg:p-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-start space-x-4 mb-6">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
            <Upload className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 font-display">
              Upload Excel File
            </h3>
            <p className="mt-1 text-gray-600">
              Upload additional Excel files with materials and clients data.
            </p>
          </div>
        </div>
        
        <div className="relative">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) {
                handleFileUpload(file);
              }
            }}
            disabled={fileUpload.loading}
            className="block w-full text-sm text-gray-700 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-blue-500 file:to-blue-600 file:text-white hover:file:from-blue-600 hover:file:to-blue-700 file:transition-all file:duration-300 file:cursor-pointer cursor-pointer"
          />
        </div>

        {fileUpload.loading && (
          <div className="mt-6 flex items-center justify-center p-4 glass-card rounded-xl">
            <div className="spinner mr-3"></div>
            <span className="text-gray-700 font-medium">Uploading and processing...</span>
          </div>
        )}

        {/* File Upload Error */}
        {fileUpload.error && (
          <div className="mt-6 glass-card border-l-4 border-red-500 p-4 animate-slide-down">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-semibold text-red-800 mb-1">Upload Error</h3>
                <div className="text-sm text-red-700">{fileUpload.error}</div>
              </div>
            </div>
          </div>
        )}

        {/* File Upload Results */}
        <ImportResult result={fileUpload.result} title="Upload Results" />
      </div>
    </div>
  );
}
