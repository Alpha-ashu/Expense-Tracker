import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { getCategoryCartoonIcon, getCategoryColor } from './CartoonCategoryIcons';
import { cn } from '@/lib/utils';

interface CategoryDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
}

export const CategoryDropdown: React.FC<CategoryDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select a category',
  label,
  required = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const selectedOption = options.find(opt => opt === value);

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          {label} {required && '*'}
        </label>
      )}
      
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl',
          'hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'transition-all duration-200',
          isOpen && 'ring-2 ring-blue-500 border-transparent'
        )}
      >
        {selectedOption ? (
          <>
            <div className="flex-shrink-0">
              {getCategoryCartoonIcon(selectedOption, 36)}
            </div>
            <span className="flex-1 text-left font-medium text-gray-900">{selectedOption}</span>
          </>
        ) : (
          <span className="flex-1 text-left text-gray-500">{placeholder}</span>
        )}
        <ChevronDown 
          className={cn(
            'w-5 h-5 text-gray-400 transition-transform duration-200',
            isOpen && 'transform rotate-180'
          )} 
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
            style={{ maxHeight: '320px', overflowY: 'auto' }}
          >
            <div className="py-2">
              {options.map((option, index) => {
                const isSelected = option === value;
                const bgColor = getCategoryColor(option);
                
                return (
                  <motion.button
                    key={option}
                    type="button"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => {
                      onChange(option);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 transition-all duration-150',
                      'hover:bg-gray-50',
                      isSelected && 'bg-blue-50'
                    )}
                  >
                    <div className="flex-shrink-0 transform transition-transform hover:scale-110">
                      {getCategoryCartoonIcon(option, 40)}
                    </div>
                    <div className="flex-1 text-left">
                      <span className={cn(
                        'font-medium',
                        isSelected ? 'text-blue-700' : 'text-gray-900'
                      )}>
                        {option}
                      </span>
                    </div>
                    {isSelected && (
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ 
                          backgroundColor: bgColor 
                        }}
                      >
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
