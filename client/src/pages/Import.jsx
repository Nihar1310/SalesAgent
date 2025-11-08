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
      <div className="mt-4 bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Materials Results */}
          <div>
            <h4 className="text-md font-medium text-gray-700 mb-2">Materials</h4>
            <div className="space-y-2">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-sm">Imported: {result.materials.imported}</span>
              </div>
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                <span className="text-sm">Skipped: {result.materials.skipped}</span>
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
          <div>
            <h4 className="text-md font-medium text-gray-700 mb-2">Clients</h4>
            <div className="space-y-2">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-sm">Imported: {result.clients.imported}</span>
              </div>
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                <span className="text-sm">Skipped: {result.clients.skipped}</span>
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
            <h4 className="text-md font-medium text-gray-700 mb-2">Error Details</h4>
            <div className="bg-red-50 border border-red-200 rounded p-3 max-h-40 overflow-y-auto">
              <pre className="text-xs text-red-700">
                {JSON.stringify([...result.materials.errors, ...result.clients.errors], null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Data</h1>
        <p className="mt-1 text-sm text-gray-500">
          Import materials and clients from Excel files
        </p>
      </div>

      {/* Memory.xlsx Import */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Import Master Data (Memory.xlsx)
          </h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>Import your complete materials and clients list from the Memory.xlsx file.</p>
          </div>
          
          <div className="mt-5 flex space-x-3">
            <button
              onClick={importMasterData}
              disabled={importState.loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {importState.loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Master Data
                </>
              )}
            </button>
            
            <button
              onClick={analyzeMemoryFile}
              disabled={importState.loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <FileText className="h-4 w-4 mr-2" />
              Analyze Structure
            </button>
          </div>

          {/* Memory Analysis Results */}
          {importState.memoryAnalysis && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded p-4">
              <h4 className="text-md font-medium text-gray-700 mb-2">File Structure</h4>
              <div className="text-sm text-gray-600">
                <p><strong>Sheets:</strong> {importState.memoryAnalysis.sheetNames.join(', ')}</p>
                {Object.entries(importState.memoryAnalysis.sheets).map(([sheetName, info]) => (
                  <div key={sheetName} className="mt-2">
                    <p><strong>{sheetName}:</strong> {info.rowCount} rows</p>
                    <p className="text-xs text-gray-500">
                      Headers: {info.headers.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {importState.error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <XCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Import Error</h3>
                  <div className="mt-2 text-sm text-red-700">{importState.error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Import Results */}
          <ImportResult result={importState.result} title="Import Results" />
        </div>
      </div>

      {/* File Upload */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Upload Excel File
          </h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>Upload additional Excel files with materials and clients data.</p>
          </div>
          
          <div className="mt-5">
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
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
          </div>

          {fileUpload.loading && (
            <div className="mt-4 flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
              <span className="text-sm text-gray-600">Uploading and processing...</span>
            </div>
          )}

          {/* File Upload Error */}
          {fileUpload.error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <XCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Upload Error</h3>
                  <div className="mt-2 text-sm text-red-700">{fileUpload.error}</div>
                </div>
              </div>
            </div>
          )}

          {/* File Upload Results */}
          <ImportResult result={fileUpload.result} title="Upload Results" />
        </div>
      </div>
    </div>
  );
}
