/**
 * Accessibility Wrapper Component
 * 
 * Provides comprehensive accessibility features including:
 * - Keyboard navigation support
 * - Screen reader announcements
 * - Focus management
 * - ARIA attributes
 */

import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

export const AccessibilityWrapper: React.FC<Props> = ({ children }) => {
  const [announcement, setAnnouncement] = useState('');
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);
  const location = useLocation();
  const mainContentRef = useRef<HTMLElement>(null);

  // Detect keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsKeyboardUser(true);
        document.body.classList.add('keyboard-user');
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardUser(false);
      document.body.classList.remove('keyboard-user');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
      document.body.classList.remove('keyboard-user');
    };
  }, []);

  // Announce route changes to screen readers
  useEffect(() => {
    const pageName = location.pathname === '/' ? 'Dashboard' : 
                     location.pathname.substring(1).charAt(0).toUpperCase() + 
                     location.pathname.substring(2);
    
    setAnnouncement(`Navigated to ${pageName} page`);
    
    // Clear announcement after it's been read
    const timer = setTimeout(() => setAnnouncement(''), 1000);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Focus management for route changes
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.focus();
    }
  }, [location.pathname]);

  // Skip to main content functionality
  const handleSkipToContent = () => {
    if (mainContentRef.current) {
      mainContentRef.current.focus();
      mainContentRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="accessibility-wrapper">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        onClick={handleSkipToContent}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        Skip to main content
      </a>

      {/* Screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Main content with proper focus management */}
      <main
        id="main-content"
        ref={mainContentRef}
        tabIndex={-1}
        className="outline-none"
        role="main"
      >
        {children}
      </main>

      {/* Global keyboard navigation styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .keyboard-user *:focus {
            outline: 2px solid #3b82f6 !important;
            outline-offset: 2px !important;
          }
          
          .sr-only {
            position: absolute !important;
            width: 1px !important;
            height: 1px !important;
            padding: 0 !important;
            margin: -1px !important;
            overflow: hidden !important;
            clip: rect(0, 0, 0, 0) !important;
            white-space: nowrap !important;
            border: 0 !important;
          }
          
          .focus\\:not-sr-only:focus {
            position: static !important;
            width: auto !important;
            height: auto !important;
            padding: inherit !important;
            margin: inherit !important;
            overflow: visible !important;
            clip: auto !important;
            white-space: normal !important;
          }
        `
      }} />
    </div>
  );
};

// Hook for managing focus traps
export const useFocusTrap = (isActive: boolean = true) => {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive]);

  return containerRef;
};

// Hook for ARIA announcements
export const useAnnouncement = () => {
  const [announcement, setAnnouncement] = useState('');

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    setAnnouncement(message);
    
    // Clear after screen reader has time to read
    setTimeout(() => setAnnouncement(''), 1000);
  };

  return { announce, announcement };
};
