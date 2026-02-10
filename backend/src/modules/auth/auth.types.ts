export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isApproved: boolean;
  createdAt: Date;
}

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
  role?: 'user' | 'advisor'; // Default is 'user'
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    isApproved: boolean;
  };
}
