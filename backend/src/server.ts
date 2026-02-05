import app from './app';
import { setupSocketIO } from './sockets';
import { logger } from './config/logger';

const PORT = process.env.PORT || 3000;

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

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

setupSocketIO(server);

export default server;