import bcrypt from 'bcryptjs';
import { User, RegisterInput, LoginInput, AuthTokens } from './auth.types';
import { prisma } from '../../db/prisma';
import { generateTokens } from '../../utils/auth';
import { Prisma } from '@prisma/client';

export class AuthService {
  async register(input: RegisterInput & {
    firstName?: string;
    lastName?: string;
    salary?: number;
    dateOfBirth?: Date;
    jobType?: string;
  }): Promise<AuthTokens> {

    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: input.email },
      });


      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Determine role and approval status
      const role = input.role || 'user';
      const isApproved = role === 'user'; // Users are auto-approved, advisors need admin approval


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

      const tokens = generateTokens(user);
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

  async updateProfile(userId: string, data: any, email?: string): Promise<any> {
    const { firstName, lastName, gender, country, state, city, monthlyIncome, dateOfBirth, jobType, phone } = data;

    console.log(`[AuthService] Processing profile update for userId: ${userId}`);

    // Standardize income - handle potential float/string/null
    let decimalMonthlyIncome: Prisma.Decimal | null = null;
    let decimalAnnualIncome: Prisma.Decimal | null = null;
    try {
      if (monthlyIncome !== undefined && monthlyIncome !== null) {
        const incomeNum = Number(monthlyIncome);
        if (!isNaN(incomeNum)) {
          decimalMonthlyIncome = new Prisma.Decimal(incomeNum);
          decimalAnnualIncome = new Prisma.Decimal(incomeNum * 12);
        }
      }
    } catch (e) {
      console.warn('[AuthService] Income conversion error:', e);
    }

    // Standardize DOB
    let dob: Date | undefined;
    if (dateOfBirth) {
      try {
        const parsedDate = new Date(dateOfBirth);
        if (!isNaN(parsedDate.getTime())) {
          dob = parsedDate;
        }
      } catch (e) {
        console.warn('[AuthService] DOB conversion error:', e);
      }
    }

    try {
      // 1. Primary Update: local User table (PostgreSQL public schema)
      console.log('[AuthService] Updating User table...');
      const user = await prisma.user.upsert({
        where: { id: userId },
        update: {
          firstName,
          lastName,
          name: `${firstName || ''} ${lastName || ''}`.trim(),
          gender,
          country,
          state,
          city,
          salary: monthlyIncome ? Number(monthlyIncome) * 12 : undefined,
          dateOfBirth: dob,
          jobType,
          updatedAt: new Date(),
        } as any,
        create: {
          id: userId,
          email: email || '',
          name: `${firstName || ''} ${lastName || ''}`.trim(),
          password: 'supabase-managed-account',
          firstName,
          lastName,
          gender,
          country,
          state,
          city,
          salary: monthlyIncome ? Number(monthlyIncome) * 12 : 0,
          dateOfBirth: dob,
          jobType,
          updatedAt: new Date(),
          createdAt: new Date(),
        } as any
      });
      console.log('[AuthService] User table updated successfully');

      // 2. Best-effort Sync: profiles table (often managed by Supabase)
      try {
        console.log('[AuthService] Syncing to profiles table...');
        // We use raw SQL for the profiles table because it might have foreign keys or 
        // schema issues that conflict with Prisma's standard ORM expectations for multi-schema.
        // It's much safer to use raw SQL for this secondary table.
        await prisma.$executeRaw`
          INSERT INTO profiles (
            id, email, first_name, last_name, full_name, gender, 
            country, state, city, phone, monthly_income, annual_income, 
            date_of_birth, job_type, updated_at
          ) VALUES (
            ${userId}::uuid, ${email || ''}, ${firstName || null}, ${lastName || null}, 
            ${`${firstName || ''} ${lastName || ''}`.trim()}, ${gender || null},
            ${country || null}, ${state || null}, ${city || null}, ${phone || null}, 
            ${decimalMonthlyIncome}, ${decimalAnnualIncome}, 
            ${dob || null}, ${jobType || null}, NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            full_name = EXCLUDED.full_name,
            gender = EXCLUDED.gender,
            country = EXCLUDED.country,
            state = EXCLUDED.state,
            city = EXCLUDED.city,
            phone = EXCLUDED.phone,
            monthly_income = EXCLUDED.monthly_income,
            annual_income = EXCLUDED.annual_income,
            date_of_birth = EXCLUDED.date_of_birth,
            job_type = EXCLUDED.job_type,
            updated_at = NOW();
        `;
        console.log('[AuthService] profiles table synced successfully');
      } catch (syncError: any) {
        // Non-blocking error for the profiles table sync
        console.warn(`[AuthService] Non-blocking profiles sync failed: ${syncError.message}`, {
          code: syncError.code,
          meta: syncError.meta
        });
      }

      return user;
    } catch (primaryError: any) {
      console.error('[AuthService] Critical User update failed:', primaryError);
      throw primaryError; // This will return 500 to the client correctly
    }
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
