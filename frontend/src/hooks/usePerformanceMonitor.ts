/**
 * Performance Monitor Hook
 * 
 * Monitors app performance and stability including:
 * - Page load times
 * - Component render performance
 * - Memory usage
 * - Error tracking
 * - User interaction delays
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface PerformanceMetrics {
  pageLoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  memoryUsage: number;
  errorCount: number;
  lastError: string | null;
}

interface PerformanceEntry {
  name: string;
  value: number;
  timestamp: number;
}

export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    pageLoadTime: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    cumulativeLayoutShift: 0,
    firstInputDelay: 0,
    memoryUsage: 0,
    errorCount: 0,
    lastError: null,
  });

  const [performanceEntries, setPerformanceEntries] = useState<PerformanceEntry[]>([]);
  const startTimeRef = useRef<number>(Date.now());
  const errorCountRef = useRef<number>(0);

  // Track page load performance
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming;
          const loadTime = navEntry.loadEventEnd - navEntry.loadEventStart;
          
          setMetrics(prev => ({
            ...prev,
            pageLoadTime: Math.round(loadTime),
          }));
        }
      });
    });

    try {
      observer.observe({ entryTypes: ['navigation'] });
    } catch (e) {
      console.warn('Performance observer not supported:', e);
    }

    return () => observer.disconnect();
  }, []);

  // Track Web Vitals
  useEffect(() => {
    const trackWebVitals = () => {
      // First Contentful Paint
      const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
      if (fcpEntry) {
        setMetrics(prev => ({
          ...prev,
          firstContentfulPaint: Math.round(fcpEntry.startTime),
        }));
      }

      // Largest Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          setMetrics(prev => ({
            ...prev,
            largestContentfulPaint: Math.round(lastEntry.startTime),
          }));
        }
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // Cumulative Layout Shift
      let clsValue = 0;
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        });
        setMetrics(prev => ({
          ...prev,
          cumulativeLayoutShift: Math.round(clsValue * 1000) / 1000,
        }));
      }).observe({ entryTypes: ['layout-shift'] });

      // First Input Delay
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          setMetrics(prev => ({
            ...prev,
            firstInputDelay: Math.round((entry as any).processingStart - entry.startTime),
          }));
        });
      }).observe({ entryTypes: ['first-input'] });
    };

    trackWebVitals();
  }, []);

  // Track memory usage
  useEffect(() => {
    const trackMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMemory = Math.round(memory.usedJSHeapSize / 1048576); // Convert to MB
        
        setMetrics(prev => ({
          ...prev,
          memoryUsage: usedMemory,
        }));
      }
    };

    const interval = setInterval(trackMemory, 5000); // Track every 5 seconds
    trackMemory(); // Initial track

    return () => clearInterval(interval);
  }, []);

  // Track errors
  const trackError = useCallback((error: Error | string) => {
    const errorMessage = typeof error === 'string' ? error : error.message;
    errorCountRef.current += 1;
    
    setMetrics(prev => ({
      ...prev,
      errorCount: errorCountRef.current,
      lastError: errorMessage,
    }));

    // Add to performance entries
    setPerformanceEntries(prev => [...prev, {
      name: 'error',
      value: 1,
      timestamp: Date.now(),
    }]);
  }, []);

  // Track custom performance events
  const trackPerformance = useCallback((name: string, value: number) => {
    setPerformanceEntries(prev => [...prev, {
      name,
      value,
      timestamp: Date.now(),
    }]);
  }, []);

  // Get performance score
  const getPerformanceScore = useCallback(() => {
    let score = 100;
    
    // Deduct points for poor metrics
    if (metrics.pageLoadTime > 3000) score -= 20;
    else if (metrics.pageLoadTime > 2000) score -= 10;
    
    if (metrics.firstContentfulPaint > 2000) score -= 15;
    else if (metrics.firstContentfulPaint > 1000) score -= 5;
    
    if (metrics.largestContentfulPaint > 4000) score -= 15;
    else if (metrics.largestContentfulPaint > 2500) score -= 5;
    
    if (metrics.cumulativeLayoutShift > 0.25) score -= 20;
    else if (metrics.cumulativeLayoutShift > 0.1) score -= 10;
    
    if (metrics.firstInputDelay > 300) score -= 15;
    else if (metrics.firstInputDelay > 100) score -= 5;
    
    if (metrics.memoryUsage > 100) score -= 10;
    else if (metrics.memoryUsage > 50) score -= 5;
    
    if (metrics.errorCount > 0) score -= metrics.errorCount * 10;
    
    return Math.max(0, score);
  }, [metrics]);

  // Measure component render time
  const measureRender = useCallback((name: string) => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      trackPerformance(`${name}_render`, Math.round(renderTime));
      
      if (renderTime > 100) { // Log slow renders
        console.warn(`Slow render detected: ${name} took ${renderTime.toFixed(2)}ms`);
      }
    };
  }, [trackPerformance]);

  // Get performance report
  const getPerformanceReport = useCallback(() => {
    return {
      metrics,
      score: getPerformanceScore(),
      entries: performanceEntries.slice(-50), // Last 50 entries
      recommendations: getRecommendations(metrics),
    };
  }, [metrics, getPerformanceScore, performanceEntries]);

  return {
    metrics,
    performanceEntries,
    trackError,
    trackPerformance,
    measureRender,
    getPerformanceScore,
    getPerformanceReport,
  };
};

// Helper function to get performance recommendations
const getRecommendations = (metrics: PerformanceMetrics): string[] => {
  const recommendations: string[] = [];
  
  if (metrics.pageLoadTime > 3000) {
    recommendations.push('Consider optimizing images and reducing bundle size to improve page load time');
  }
  
  if (metrics.firstContentfulPaint > 2000) {
    recommendations.push('Optimize critical rendering path to show content faster');
  }
  
  if (metrics.largestContentfulPaint > 4000) {
    recommendations.push('Optimize large elements and lazy load non-critical content');
  }
  
  if (metrics.cumulativeLayoutShift > 0.25) {
    recommendations.push('Ensure proper image dimensions and avoid dynamic content shifts');
  }
  
  if (metrics.firstInputDelay > 300) {
    recommendations.push('Reduce JavaScript execution time to improve interactivity');
  }
  
  if (metrics.memoryUsage > 100) {
    recommendations.push('Optimize memory usage by cleaning up unused objects and reducing data retention');
  }
  
  if (metrics.errorCount > 5) {
    recommendations.push('High error count detected. Review error logs and fix critical issues');
  }
  
  return recommendations;
};
