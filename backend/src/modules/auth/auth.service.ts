import bcrypt from 'bcryptjs';
import { User, RegisterInput, LoginInput, AuthTokens } from './auth.types';
import { prisma } from '../../db/prisma';
import { generateTokens } from '../../utils/auth';

export class AuthService {
  async register(input: RegisterInput & {
    firstName?: string;
    lastName?: string;
    salary?: number;
    dateOfBirth?: Date;
    jobType?: string;
  }): Promise<AuthTokens> {
    console.log('AuthService.register called with:', {
      email: input.email,
      name: input.name,
      hasPassword: !!input.password
    });

    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: input.email },
      });

      console.log('Existing user check result:', !!existingUser);

      if (existingUser) {
        console.log('User already exists, throwing error');
        throw new Error('Email already registered');
      }

      // Hash password
      console.log('Hashing password...');
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Determine role and approval status
      const role = input.role || 'user';
      const isApproved = role === 'user'; // Users are auto-approved, advisors need admin approval

      console.log('Creating user with role:', role, 'approved:', isApproved);

      // Create user with profile information
      const user = await prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          password: hashedPassword,
          role,
          isApproved,
          firstName: input.firstName,
          lastName: input.lastName,
          salary: input.salary,
          dateOfBirth: input.dateOfBirth,
          jobType: input.jobType,
        },
      });

      console.log('User created successfully with ID:', user.id);

      // Generate tokens
      const tokens = generateTokens(user);
      console.log('Tokens generated successfully');
      return tokens;
    } catch (error) {
      console.error('Error in AuthService.register:', error);
      throw error;
    }
  }

  async completeProfile(userId: string, profileData: {
    firstName: string;
    lastName: string;
    salary: number;
    dateOfBirth: Date;
    jobType: string;
  }): Promise<User> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: profileData,
    });

    return user;
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Check if user is approved (especially important for advisors)
    // For now, still allow login even if not approved, but token will indicate status
    return generateTokens(user);
  }

  async getUser(userId: string): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async updateUserRole(userId: string, role: 'admin' | 'advisor' | 'user'): Promise<User> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    return user;
  }

  async approveAdvisor(advisorId: string): Promise<User> {
    const user = await prisma.user.update({
      where: { id: advisorId },
      data: { isApproved: true },
    });

    return user;
  }

  async rejectAdvisor(advisorId: string): Promise<void> {
    await prisma.user.update({
      where: { id: advisorId },
      data: { role: 'user', isApproved: false },
    });
  }

  async getAdvisors(): Promise<User[]> {
    const advisors = await prisma.user.findMany({
      where: { role: 'advisor', isApproved: true },
    });

    return advisors;
  }

  // API Keys and Credentials
  getApiKey(key: string): string | undefined {
    return process.env[key as keyof NodeJS.ProcessEnv] as string | undefined;
  }

  getStripeApiKey(): string | undefined {
    return this.getApiKey('STRIPE_API_KEY');
  }

  getOpenAIApiKey(): string | undefined {
    return this.getApiKey('OPENAI_API_KEY');
  }

  getGoogleApiKey(): string | undefined {
    return this.getApiKey('GOOGLE_API_KEY');
  }

  getFirebaseSecret(): string | undefined {
    return this.getApiKey('FIREBASE_SECRET');
  }

  getAwsSecretAccessKey(): string | undefined {
    return this.getApiKey('AWS_SECRET_ACCESS_KEY');
  }

  getSendGridApiKey(): string | undefined {
    return this.getApiKey('SENDGRID_API_KEY');
  }
}
