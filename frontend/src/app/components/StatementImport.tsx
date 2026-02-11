/**
 * Statement Import Component
 * Allows users to upload and import bank statements
 */

import React, { useState, useRef } from 'react';
import { Upload, FileText, Table, CheckCircle, XCircle, AlertCircle, Download, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { statementImportService, ImportResult, ParsedTransaction, StatementImportOptions } from '@/services/statementImportService';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

interface StatementImportProps {
  accountId: number;
  accountName: string;
  accountType: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const StatementImport: React.FC<StatementImportProps> = ({
  accountId,
  accountName,
  accountType,
  onSuccess,
  onCancel
}) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [importState, setImportState] = useState<'idle' | 'uploading' | 'processing' | 'preview' | 'importing' | 'success' | 'error'>('idle');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];

      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error('Please select a PDF, CSV, or Excel file');
        return;
      }

      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }

      setFile(selectedFile);
      setImportState('idle');
      setImportResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    setImportState('uploading');
    
    try {
      const options: StatementImportOptions = {
        accountId,
        userId: user.id,
        accountType
      };

      setImportState('processing');
      const result = await statementImportService.parseStatement(file, options);
      
      setImportResult(result);
      
      if (result.success && result.transactions.length > 0) {
        // Auto-select all transactions initially
        setSelectedTransactions(new Set(result.transactions.map((_, index) => index) || []));
        setImportState('preview');
        toast.success(`Found ${result.transactions.length} transactions in statement`);
      } else {
        setImportState('error');
        toast.error('No transactions found in the statement');
      }

    } catch (error) {
      setImportState('error');
      toast.error('Failed to process statement. Please try again.');
      console.error('Import error:', error);
    }
  };

  const handleImport = async () => {
    if (!importResult || !user) return;

    setImportState('importing');
    
    try {
      const options: StatementImportOptions = {
        accountId,
        userId: user.id,
        accountType
      };

      // Get selected transactions
      const transactionsToImport = Array.from(selectedTransactions).map(index => importResult.transactions[index]);
      
      await statementImportService.importTransactions(transactionsToImport, options);
      
      setImportState('success');
      toast.success(`Successfully imported ${transactionsToImport.length} transactions to ${accountName}`);
      
      setTimeout(() => {
        onSuccess?.();
      }, 2000);

    } catch (error) {
      setImportState('error');
      toast.error('Failed to import transactions. Please try again.');
      console.error('Import error:', error);
    }
  };

  const toggleTransactionSelection = (index: number) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTransactions(newSelected);
  };

  const toggleAllTransactions = () => {
    if (selectedTransactions.size === importResult?.transactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(importResult?.transactions.map((_, index) => index) || []));
    }
  };

  const getFileIcon = () => {
    if (!file) return <Upload size={24} />;
    
    if (file.type === 'application/pdf') return <FileText size={24} />;
    if (file.type === 'text/csv') return <Table size={24} />;
    return <FileText size={24} />;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(Math.abs(amount));
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'income': return 'text-green-600';
      case 'expense': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Import Statement</h2>
            <p className="text-sm text-gray-500 mt-1">Account: {accountName}</p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XCircle size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {importState === 'idle' && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                {getFileIcon()}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {file ? file.name : 'Select Statement File'}
              </h3>
              <p className="text-gray-500 mb-6">
                Supported formats: PDF, CSV, Excel (Max 10MB)
              </p>
              
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full bg-black text-white hover:bg-gray-900"
                >
                  <Upload size={16} className="mr-2" />
                  {file ? 'Change File' : 'Select File'}
                </Button>
                
                {file && (
                  <Button
                    onClick={handleUpload}
                    className="rounded-full bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Eye size={16} className="mr-2" />
                    Preview Transactions
                  </Button>
                )}
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {(importState === 'uploading' || importState === 'processing') && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {importState === 'uploading' ? 'Uploading Statement...' : 'Processing Transactions...'}
              </h3>
              <p className="text-gray-500">
                {importState === 'uploading' 
                  ? 'Please wait while we upload your file' 
                  : 'Analyzing and extracting transactions from your statement'
                }
              </p>
            </div>
          )}

          {importState === 'preview' && importResult && (
            <div className="space-y-6">
              {/* Summary */}
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Import Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Total Transactions</p>
                      <p className="text-xl font-bold text-gray-900">{importResult.summary.count}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Amount</p>
                      <p className="text-xl font-bold text-gray-900">
                        {formatCurrency(importResult.summary.total)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Credits</p>
                      <p className="text-xl font-bold text-green-600">
                        +{formatCurrency(importResult.summary.credits)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Debits</p>
                      <p className="text-xl font-bold text-red-600">
                        -{formatCurrency(importResult.summary.debits)}
                      </p>
                    </div>
                  </div>
                  
                  {importResult.errors.length > 0 && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-800">
                          {importResult.errors.length} warnings during processing
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Transaction Selection */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Select Transactions to Import</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAllTransactions}
                >
                  {selectedTransactions.size === importResult.transactions.length 
                    ? 'Deselect All' 
                    : 'Select All'
                  }
                </Button>
              </div>

              {/* Transaction List */}
              <Card className="max-h-80 overflow-y-auto">
                <div className="divide-y">
                  {importResult.transactions.map((transaction, index) => (
                    <div
                      key={index}
                      className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedTransactions.has(index) ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => toggleTransactionSelection(index)}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedTransactions.has(index)}
                          onChange={() => toggleTransactionSelection(index)}
                          className="rounded border-gray-300"
                        />
                        
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                          <div>
                            <p className="font-medium text-gray-900">
                              {transaction.transaction_date.toLocaleDateString()}
                            </p>
                            <p className="text-gray-500">
                              {transaction.payment_channel}
                            </p>
                          </div>
                          
                          <div className="md:col-span-2">
                            <p className="font-medium text-gray-900">
                              {transaction.cleaned_description}
                            </p>
                            {transaction.merchant_name && (
                              <p className="text-xs text-gray-500">
                                Merchant: {transaction.merchant_name}
                              </p>
                            )}
                          </div>
                          
                          <div className="text-right">
                            <p className={`font-bold ${getTransactionTypeColor(transaction.transaction_type)}`}>
                              {transaction.transaction_type === 'income' ? '+' : '-'}
                              {formatCurrency(transaction.amount)}
                            </p>
                            {transaction.category && (
                              <span className="inline-block mt-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                                {transaction.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Import Actions */}
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={onCancel}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={selectedTransactions.size === 0}
                  className="bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Download size={16} className="mr-2" />
                  Import {selectedTransactions.size} Transaction{selectedTransactions.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}

          {importState === 'importing' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Importing Transactions...</h3>
              <p className="text-gray-500">Adding transactions to your account</p>
            </div>
          )}

          {importState === 'success' && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Import Successful!</h3>
              <p className="text-gray-500">
                Transactions have been added to {accountName}
              </p>
            </div>
          )}

          {importState === 'error' && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <XCircle size={32} className="text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Import Failed</h3>
              <p className="text-gray-500 mb-6">
                There was an error processing your statement. Please check the file format and try again.
              </p>
              <Button
                onClick={() => setImportState('idle')}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
