
  # Expense Tracker Import Feature

  This is a code bundle for Expense Tracker Import Feature. The original project is available at https://www.figma.com/design/YFfOCSQMHx6XmjEezEKAkY/Expense-Tracker-Import-Feature.

  ## Security Notice

  This application has undergone a comprehensive security review. Critical vulnerabilities have been addressed including:
  - Authentication and authorization issues
  - Input validation and sanitization
  - Rate limiting and DoS protection
  - Secure configuration management
  
  See [SECURITY_IMPROVEMENTS.md](./SECURITY_IMPROVEMENTS.md) for detailed information.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  
  ## Security Configuration

  **Required Environment Variables:**
  - `JWT_SECRET`: Must be at least 32 characters (no fallback allowed)
  - `DATABASE_URL`: PostgreSQL connection string
  - `SUPABASE_URL`: Supabase project URL (if using Supabase)
  - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (if using Supabase)
  
  **Optional Environment Variables:**
  - `FRONTEND_URL`: Frontend URL for CORS (defaults to http://localhost:5173)
  - `NODE_ENV`: development, production, or test
  - `PORT`: Backend port (defaults to 3000)
  
  Copy `.env.example` to `.env` and configure these variables before running the application.
  