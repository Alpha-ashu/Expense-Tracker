import React from 'react';
import { AlertTriangle, Loader } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  itemName?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  title = 'Delete Confirmation',
  message,
  itemName,
  isLoading = false,
  onConfirm,
  onCancel,
  isDangerous = true,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
        <div className={`p-6 border-l-4 ${isDangerous ? 'border-red-500' : 'border-yellow-500'}`}>
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 ${isDangerous ? 'text-red-500' : 'text-yellow-500'}`}>
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-bold ${isDangerous ? 'text-red-900' : 'text-yellow-900'}`}>
                {title}
              </h3>
              <p className="text-gray-700 mt-2 text-sm">
                {message}
              </p>
              {itemName && (
                <p className="text-gray-900 mt-1 font-medium text-sm break-words">
                  "{itemName}"
                </p>
              )}
              {isDangerous && (
                <p className="text-red-600 mt-3 text-xs font-medium">
                  ⚠️ This action cannot be undone.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 disabled:bg-gray-200 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              isDangerous
                ? 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400'
                : 'bg-yellow-600 text-white hover:bg-yellow-700 disabled:bg-yellow-400'
            }`}
          >
            {isLoading ? (
              <>
                <Loader size={16} className="animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
