import { PerformanceMonitor } from './production';

// Performance optimization utilities
export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private batchQueue: Map<string, any[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  // Cache management
  setCache(key: string, data: any, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + ttl
    });
  }

  getCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.timestamp) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  clearCache(): void {
    this.cache.clear();
  }

  // Batch operations for better performance
  async batchOperation<T>(
    operation: string, 
    items: T[], 
    processor: (item: T) => Promise<any>,
    batchSize: number = 100
  ): Promise<void> {
    const monitor = PerformanceMonitor.getInstance();
    const endTimer = monitor.startTimer(`batch_${operation}`);
    
    try {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await Promise.all(batch.map(processor));
        
        // Yield control to prevent blocking UI
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } finally {
      endTimer();
    }
  }

  // Debounced function execution
  debounce<T extends (...args: any[]) => any>(
    func: T, 
    delay: number = 300
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  // Throttled function execution
  throttle<T extends (...args: any[]) => any>(
    func: T, 
    limit: number = 1000
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Memory management
  optimizeMemory(): void {
    // Clear old cache entries
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.timestamp) {
        this.cache.delete(key);
      }
    }

    // Force garbage collection if available
    if (globalThis.gc) {
      globalThis.gc();
    }
  }

  // Virtualization helper for long lists
  createVirtualizedData<T>(
    data: T[], 
    itemHeight: number, 
    containerHeight: number
  ): { visibleItems: T[]; startIndex: number; endIndex: number } {
    const startIndex = Math.floor(window.scrollY / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 2; // +2 for buffer
    const endIndex = Math.min(startIndex + visibleCount, data.length);
    
    return {
      visibleItems: data.slice(startIndex, endIndex),
      startIndex,
      endIndex
    };
  }
}

// Lazy loading utilities
export class LazyLoader {
  private static instance: LazyLoader;
  private loadedModules: Set<string> = new Set();

  static getInstance(): LazyLoader {
    if (!LazyLoader.instance) {
      LazyLoader.instance = new LazyLoader();
    }
    return LazyLoader.instance;
  }

  async loadModule<T>(modulePath: string): Promise<T> {
    if (this.loadedModules.has(modulePath)) {
      // Return cached module if already loaded
      return import(modulePath) as Promise<T>;
    }

    const monitor = PerformanceMonitor.getInstance();
    const endTimer = monitor.startTimer(`load_module_${modulePath}`);
    
    try {
      const module = await import(modulePath);
      this.loadedModules.add(modulePath);
      return module as T;
    } finally {
      endTimer();
    }
  }

  // Lazy load images
  setupImageLazyLoading(): void {
    const images = document.querySelectorAll('img[data-src]');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          img.src = img.dataset.src!;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      });
    });

    images.forEach(img => observer.observe(img));
  }

  // Lazy load components based on viewport
  setupComponentLazyLoading(): void {
    const components = document.querySelectorAll('[data-lazy-component]');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement;
          const componentPath = element.dataset.lazyComponent;
          
          if (componentPath) {
            try {
              const Component = await this.loadModule(componentPath);
              // Render component (implementation depends on your framework)
              element.innerHTML = ''; // Clear placeholder
              // Component.render(element);
            } catch (error) {
              console.error('Failed to load component:', error);
            }
          }
          
          observer.unobserve(element);
        }
      });
    });

    components.forEach(el => observer.observe(el));
  }
}

// Resource preloading
export class ResourcePreloader {
  private static instance: ResourcePreloader;
  private preloadedResources: Set<string> = new Set();

  static getInstance(): ResourcePreloader {
    if (!ResourcePreloader.instance) {
      ResourcePreloader.instance = new ResourcePreloader();
    }
    return ResourcePreloader.instance;
  }

  async preloadImage(src: string): Promise<void> {
    if (this.preloadedResources.has(src)) return;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.preloadedResources.add(src);
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  async preloadFont(fontFamily: string, fontWeight: string = 'normal'): Promise<void> {
    try {
      await document.fonts.load(`${fontWeight} 16px "${fontFamily}"`);
    } catch (error) {
      console.warn(`Failed to preload font: ${fontFamily}`, error);
    }
  }

  async preloadCriticalResources(): Promise<void> {
    const monitor = PerformanceMonitor.getInstance();
    const endTimer = monitor.startTimer('preload_critical_resources');
    
    try {
      // Preload critical images
      const criticalImages = [
        '/favicon.ico',
        '/icons/icon-192x192.png',
        '/icons/icon-512x512.png'
      ];

      await Promise.all(criticalImages.map(src => this.preloadImage(src)));

      // Preload critical fonts
      await Promise.all([
        this.preloadFont('Inter'),
        this.preloadFont('Inter', 'bold'),
        this.preloadFont('Inter', 'medium')
      ]);

      console.log('Critical resources preloaded');
    } finally {
      endTimer();
    }
  }
}

// Network optimization
export class NetworkOptimizer {
  private static instance: NetworkOptimizer;
  private requestCache: Map<string, { data: any; timestamp: number }> = new Map();

  static getInstance(): NetworkOptimizer {
    if (!NetworkOptimizer.instance) {
      NetworkOptimizer.instance = new NetworkOptimizer();
    }
    return NetworkOptimizer.instance;
  }

  async fetchWithCache<T>(
    url: string, 
    options: RequestInit = {}, 
    cacheTTL: number = 5 * 60 * 1000
  ): Promise<T> {
    const cacheKey = `${url}_${JSON.stringify(options)}`;
    const cached = this.requestCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      return cached.data;
    }

    const response = await fetch(url, options);
    const data = await response.json();

    this.requestCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    return data;
  }

  async fetchWithRetry<T>(
    url: string, 
    options: RequestInit = {}, 
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, i)));
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  // Connection quality detection
  async detectConnectionQuality(): Promise<'slow-2g' | '2g' | '3g' | '4g'> {
    if ('connection' in navigator) {
      const connection = navigator.connection as any;
      if (connection.effectiveType) {
        return connection.effectiveType;
      }
    }

    // Fallback: measure download speed
    const startTime = performance.now();
    try {
      await fetch('/favicon.ico', { cache: 'no-cache' });
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (duration > 2000) return 'slow-2g';
      if (duration > 1000) return '2g';
      if (duration > 500) return '3g';
      return '4g';
    } catch {
      return 'slow-2g';
    }
  }
}

// Performance monitoring and reporting
export class PerformanceReporter {
  private static instance: PerformanceReporter;

  static getInstance(): PerformanceReporter {
    if (!PerformanceReporter.instance) {
      PerformanceReporter.instance = new PerformanceReporter();
    }
    return PerformanceReporter.instance;
  }

  reportPerformanceMetrics(): void {
    const monitor = PerformanceMonitor.getInstance();
    const metrics = monitor.getAllMetrics();

    // Report to console in development
    if (process.env.NODE_ENV === 'development') {
      console.table(metrics);
    }

    // Report to analytics service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToAnalytics(metrics);
    }
  }

  private sendToAnalytics(metrics: Record<string, any>): void {
    // In a real app, send to your analytics service
    // Example: Google Analytics, Mixpanel, etc.
    console.log('Performance metrics:', metrics);
  }

  // Web Vitals reporting
  reportWebVitals(): void {
    // Report Core Web Vitals
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.log(`${entry.name}: ${entry.startTime || entry.duration}`);
        }
      });

      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
    }
  }
}

// Initialize all performance optimizations
export function initializePerformanceOptimizations(): void {
  const optimizer = PerformanceOptimizer.getInstance();
  const lazyLoader = LazyLoader.getInstance();
  const preloader = ResourcePreloader.getInstance();
  const reporter = PerformanceReporter.getInstance();

  // Preload critical resources
  preloader.preloadCriticalResources();

  // Set up performance monitoring
  reporter.reportWebVitals();

  // Optimize memory periodically
  setInterval(() => {
    optimizer.optimizeMemory();
  }, 5 * 60 * 1000); // Every 5 minutes

  // Report performance metrics periodically
  setInterval(() => {
    reporter.reportPerformanceMetrics();
  }, 60 * 1000); // Every minute
}