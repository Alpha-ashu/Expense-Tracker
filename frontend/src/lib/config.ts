// Configuration constants from environment variables
export const config = {
  api: {
    baseUrl: (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:3000',
    timeout: 10000,
  },
  socket: {
    url: (import.meta as any).env.VITE_SOCKET_URL || 'http://localhost:3000',
    autoConnect: true,
  },
  features: {
    realtime: (import.meta as any).env.VITE_ENABLE_REALTIME === 'true',
    notifications: (import.meta as any).env.VITE_ENABLE_NOTIFICATIONS === 'true',
  },
  environment: (import.meta as any).env.VITE_NODE_ENV || 'development',
  // API Keys and Credentials
  apiKeys: {
    stripe: (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY,
    google: (import.meta as any).env.VITE_GOOGLE_CLIENT_ID,
    firebase: (import.meta as any).env.VITE_FIREBASE_API_KEY,
  },
};

// API endpoints
export const endpoints = {
  auth: {
    register: `${config.api.baseUrl}/api/v1/auth/register`,
    login: `${config.api.baseUrl}/api/v1/auth/login`,
  },
  health: `${config.api.baseUrl}/health`,
};

// Socket events
export const socketEvents = {
  connect: 'connect',
  disconnect: 'disconnect',
  error: 'error',
  // Add more events as needed
};