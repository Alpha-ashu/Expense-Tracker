import { Server } from 'socket.io';

export const setupSocketIO = (server: any) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  // API Keys and Credentials
  const getApiKey = (key: string): string | undefined => {
    return process.env[key as keyof NodeJS.ProcessEnv] as string | undefined;
  };

  const getStripeApiKey = (): string | undefined => {
    return getApiKey('STRIPE_API_KEY');
  };

  const getOpenAIApiKey = (): string | undefined => {
    return getApiKey('OPENAI_API_KEY');
  };

  const getGoogleApiKey = (): string | undefined => {
    return getApiKey('GOOGLE_API_KEY');
  };

  const getFirebaseSecret = (): string | undefined => {
    return getApiKey('FIREBASE_SECRET');
  };

  const getAwsSecretAccessKey = (): string | undefined => {
    return getApiKey('AWS_SECRET_ACCESS_KEY');
  };

  const getSendGridApiKey = (): string | undefined => {
    return getApiKey('SENDGRID_API_KEY');
  };

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  return io;
};