import fs from 'fs';
import path from 'path';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

type RouteMount = {
  prefix: string;
  folder: string;
  fileBase: string;
  tag: string;
};

type OpenApiOperation = {
  tags: string[];
  summary: string;
  description?: string;
  operationId: string;
  security?: Array<Record<string, string[]>>;
  parameters?: any[];
  requestBody?: any;
  responses: Record<string, any>;
};

type EndpointOverride = Partial<OpenApiOperation> & {
  requestExample?: Record<string, unknown>;
  responseExample?: Record<string, unknown>;
};

const API_TITLE = 'Finora Backend API';
const API_VERSION = '1.0.0';

const ROUTE_MOUNTS: RouteMount[] = [
  { prefix: '/auth', folder: 'auth', fileBase: 'auth.routes', tag: 'Auth' },
  { prefix: '/sync', folder: 'sync', fileBase: 'sync.routes', tag: 'Sync' },
  { prefix: '/pin', folder: 'pin', fileBase: 'pin.routes', tag: 'PIN' },
  { prefix: '/transactions', folder: 'transactions', fileBase: 'transaction.routes', tag: 'Transactions' },
  { prefix: '/accounts', folder: 'accounts', fileBase: 'account.routes', tag: 'Accounts' },
  { prefix: '/goals', folder: 'goals', fileBase: 'goal.routes', tag: 'Goals' },
  { prefix: '/loans', folder: 'loans', fileBase: 'loan.routes', tag: 'Loans' },
  { prefix: '/settings', folder: 'settings', fileBase: 'settings.routes', tag: 'Settings' },
  { prefix: '/friends', folder: 'friends', fileBase: 'friend.routes', tag: 'Friends' },
  { prefix: '/investments', folder: 'investments', fileBase: 'investment.routes', tag: 'Investments' },
  { prefix: '/todos', folder: 'todos', fileBase: 'todo.routes', tag: 'Todos' },
  { prefix: '/groups', folder: 'groups', fileBase: 'group.routes', tag: 'Groups' },
  { prefix: '/ai', folder: 'ai', fileBase: 'ai.routes', tag: 'AI' },
  { prefix: '/receipts', folder: 'receipts', fileBase: 'receipt.routes', tag: 'Receipts' },
  { prefix: '/bookings', folder: 'bookings', fileBase: 'booking.routes', tag: 'Bookings' },
  { prefix: '/advisors', folder: 'advisors', fileBase: 'advisor.routes', tag: 'Advisors' },
  { prefix: '/sessions', folder: 'sessions', fileBase: 'session.routes', tag: 'Sessions' },
  { prefix: '/payments', folder: 'payments', fileBase: 'payment.routes', tag: 'Payments' },
  { prefix: '/notifications', folder: 'notifications', fileBase: 'notification.routes', tag: 'Notifications' },
  { prefix: '/bills', folder: 'bills', fileBase: 'bills.routes', tag: 'Bills' },
  { prefix: '/dashboard', folder: 'dashboard', fileBase: 'dashboard.routes', tag: 'Dashboard' },
  { prefix: '/admin', folder: 'admin', fileBase: 'admin.routes', tag: 'Admin' },
  { prefix: '/stocks', folder: 'stocks', fileBase: 'stock.routes', tag: 'Stocks' },
];

const ENDPOINT_OVERRIDES: Record<string, EndpointOverride> = {
  'post /api/v1/auth/register': {
    summary: 'Register a new user',
    description: 'Creates a Finora account and returns authentication data.',
    requestExample: {
      name: 'Asha Sharma',
      email: 'asha@example.com',
      password: 'StrongPassword123!',
    },
    responseExample: {
      user: { id: 'uuid', email: 'asha@example.com', name: 'Asha Sharma' },
      accessToken: 'jwt-token',
      refreshToken: 'refresh-token',
    },
  },
  'post /api/v1/auth/login': {
    summary: 'Login with email and password',
    description: 'Authenticates the user and returns access credentials.',
    requestExample: {
      email: 'asha@example.com',
      password: 'StrongPassword123!',
    },
    responseExample: {
      user: { id: 'uuid', email: 'asha@example.com', name: 'Asha Sharma' },
      accessToken: 'jwt-token',
      refreshToken: 'refresh-token',
    },
  },
  'get /api/v1/auth/profile': {
    summary: 'Get current user profile',
    description: 'Returns the authenticated user profile used by the app shell and onboarding flows.',
    responseExample: {
      id: 'uuid',
      email: 'asha@example.com',
      name: 'Asha Sharma',
      firstName: 'Asha',
      lastName: 'Sharma',
      role: 'user',
    },
  },
  'put /api/v1/auth/profile': {
    summary: 'Update current user profile',
    description: 'Updates the authenticated user profile.',
    requestExample: {
      firstName: 'Asha',
      lastName: 'Sharma',
      country: 'India',
      city: 'Bengaluru',
    },
  },
  'post /api/v1/sync/pull': {
    summary: 'Pull server-side changes',
    description: 'Returns cloud data changed since the last sync timestamp for the requesting device.',
    requestExample: {
      deviceId: 'device_123',
      lastSyncedAt: '2026-04-25T10:00:00.000Z',
      entityTypes: ['accounts', 'transactions', 'goals'],
    },
    responseExample: {
      success: true,
      data: {
        accounts: [],
        transactions: [],
        goals: [],
      },
    },
  },
  'post /api/v1/sync/push': {
    summary: 'Push local changes',
    description: 'Pushes local device changes into the backend sync queue/source of truth.',
    requestExample: {
      deviceId: 'device_123',
      entities: [
        {
          entityType: 'transaction',
          operation: 'upsert',
          data: { localId: 42, amount: 1200, category: 'Food & Dining' },
        },
      ],
    },
  },
  'get /api/v1/accounts': {
    summary: 'List accounts',
    description: 'Returns all active accounts for the authenticated user.',
  },
  'post /api/v1/accounts': {
    summary: 'Create account',
    requestExample: {
      name: 'HDFC Bank',
      type: 'bank',
      balance: 25000,
      currency: 'INR',
    },
  },
  'get /api/v1/transactions': {
    summary: 'List transactions',
    description: 'Supports account, date-range, and category filtering.',
  },
  'post /api/v1/transactions': {
    summary: 'Create transaction',
    requestExample: {
      accountId: 'account-uuid',
      type: 'expense',
      amount: 450,
      category: 'Food & Dining',
      description: 'Lunch',
      date: '2026-04-25T12:30:00.000Z',
    },
  },
  'post /api/v1/goals': {
    summary: 'Create goal',
    requestExample: {
      name: 'Emergency Fund',
      targetAmount: 100000,
      currentAmount: 15000,
      targetDate: '2026-12-31T00:00:00.000Z',
      category: 'savings',
    },
  },
  'post /api/v1/loans': {
    summary: 'Create loan',
    requestExample: {
      type: 'borrowed',
      name: 'Personal Loan',
      principalAmount: 50000,
      emiAmount: 4500,
      dueDate: '2026-06-05T00:00:00.000Z',
      status: 'active',
    },
  },
  'post /api/v1/loans/:id/payment': {
    summary: 'Add loan payment',
    requestExample: {
      amount: 4500,
      accountId: 'account-uuid',
      notes: 'April EMI',
    },
  },
  'post /api/v1/bookings': {
    summary: 'Create advisor booking request',
    requestExample: {
      advisorId: 'advisor-uuid',
      sessionType: 'video',
      description: 'Tax planning for FY 2026',
      proposedDate: '2026-05-01',
      proposedTime: '18:00',
      duration: 60,
      amount: 1499,
    },
  },
  'put /api/v1/bookings/:id/accept': {
    summary: 'Accept booking request',
  },
  'put /api/v1/bookings/:id/reject': {
    summary: 'Reject booking request',
    requestExample: {
      reason: 'Requested slot is unavailable.',
    },
  },
  'put /api/v1/bookings/:id/reschedule': {
    summary: 'Reschedule booking request',
    requestExample: {
      proposedDate: '2026-05-03',
      proposedTime: '19:30',
      reason: 'Can we move this to the weekend?',
    },
  },
  'get /api/v1/sessions/:id/messages': {
    summary: 'List session chat messages',
  },
  'post /api/v1/sessions/:id/messages': {
    summary: 'Send session chat message',
    requestExample: {
      message: 'Please share your last three months of statements before the call.',
    },
  },
  'get /api/v1/dashboard/summary': {
    summary: 'Get dashboard summary',
  },
  'get /api/v1/dashboard/cashflow': {
    summary: 'Get dashboard cashflow',
  },
};

function resolveRouteFile(mount: RouteMount): string {
  const candidateRoots = [
    path.join(__dirname, '..', 'modules'),
    path.join(process.cwd(), 'backend', 'src', 'modules'),
    path.join(process.cwd(), 'backend', 'dist', 'modules'),
  ];

  const candidates = candidateRoots.flatMap((root) => [
    path.join(root, mount.folder, `${mount.fileBase}.ts`),
    path.join(root, mount.folder, `${mount.fileBase}.js`),
  ]);

  const match = candidates.find((candidate) => fs.existsSync(candidate));
  if (!match) {
    throw new Error(`Unable to locate route file for ${mount.fileBase}`);
  }

  return match;
}

function buildOperationId(method: HttpMethod, fullPath: string): string {
  return `${method}_${fullPath.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
}

function buildSummary(method: HttpMethod, fullPath: string, fallbackTag: string): string {
  const override = ENDPOINT_OVERRIDES[`${method} ${fullPath}`];
  if (override?.summary) {
    return override.summary;
  }

  const readablePath = fullPath
    .replace('/api/v1/', '')
    .replace(/\/:/g, ' by ')
    .replace(/\//g, ' ')
    .trim();

  return `${method.toUpperCase()} ${readablePath || fallbackTag}`;
}

function buildParameters(fullPath: string): any[] {
  const matches = fullPath.match(/:([A-Za-z0-9_]+)/g) || [];
  return matches.map((match) => ({
    in: 'path',
    name: match.slice(1),
    required: true,
    schema: { type: 'string' },
  }));
}

function buildResponses(method: HttpMethod, override?: EndpointOverride): Record<string, any> {
  const successCode = method === 'post' ? '201' : '200';
  const responses: Record<string, any> = {
    [successCode]: {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: { oneOf: [{ $ref: '#/components/schemas/SuccessEnvelope' }, { type: 'object' }] },
        },
      },
    },
    '400': { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
    '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
    '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
    '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
    '429': { description: 'Rate limited', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
    '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
  };

  if (override?.responseExample) {
    responses[successCode].content['application/json'].example = override.responseExample;
  }

  return responses;
}

function buildRequestBody(method: HttpMethod, fullPath: string, override?: EndpointOverride) {
  if (!['post', 'put', 'patch'].includes(method)) {
    return undefined;
  }

  const example = override?.requestExample || {
    note: `Provide request payload for ${fullPath}`,
  };

  return {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          additionalProperties: true,
        },
        example,
      },
    },
  };
}

function extractOperations(mount: RouteMount): Record<string, Record<string, OpenApiOperation>> {
  const filePath = resolveRouteFile(mount);
  const content = fs.readFileSync(filePath, 'utf8');
  const operations: Record<string, Record<string, OpenApiOperation>> = {};
  const protectedByDefault = /router\.use\(\s*authMiddleware\s*\)/.test(content);
  const routePattern = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  const matches = [...content.matchAll(routePattern)];

  matches.forEach((match, index) => {
    const method = match[1] as HttpMethod;
    const routePath = match[2];
    const nextIndex = matches[index + 1]?.index ?? content.length;
    const segment = content.slice(match.index ?? 0, nextIndex);
    const normalizedRoute = routePath === '/' ? '' : routePath;
    const fullPath = `/api/v1${mount.prefix}${normalizedRoute}`;
    const override = ENDPOINT_OVERRIDES[`${method} ${fullPath}`];
    const authRequired = protectedByDefault || /authMiddleware/.test(segment);

    const operation: OpenApiOperation = {
      tags: [mount.tag],
      summary: buildSummary(method, fullPath, mount.tag),
      description: override?.description,
      operationId: buildOperationId(method, fullPath),
      security: authRequired ? [{ bearerAuth: [] }] : undefined,
      parameters: buildParameters(fullPath),
      requestBody: buildRequestBody(method, fullPath, override),
      responses: buildResponses(method, override),
    };

    operations[fullPath] = operations[fullPath] || {};
    operations[fullPath][method] = operation;
  });

  return operations;
}

function mergeOperations() {
  return ROUTE_MOUNTS.reduce<Record<string, Record<string, OpenApiOperation>>>((acc, mount) => {
    const next = extractOperations(mount);
    Object.entries(next).forEach(([pathKey, methods]) => {
      acc[pathKey] = acc[pathKey] || {};
      Object.assign(acc[pathKey], methods);
    });
    return acc;
  }, {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Returns API, Redis, and circuit breaker status.',
        operationId: 'get_health',
        responses: {
          '200': {
            description: 'Service status',
            content: {
              'application/json': {
                example: {
                  status: 'ok',
                  timestamp: '2026-04-25T12:00:00.000Z',
                  services: {
                    redis: 'connected',
                    circuitBreakers: {},
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export function generateOpenApiDocument(baseUrl?: string) {
  return {
    openapi: '3.0.3',
    info: {
      title: API_TITLE,
      version: API_VERSION,
      description: 'Tester-oriented OpenAPI document for Finora backend feature APIs.',
    },
    servers: [
      {
        url: baseUrl || 'http://localhost:3000',
        description: 'Local development server',
      },
    ],
    tags: [
      ...ROUTE_MOUNTS.map((mount) => ({ name: mount.tag })),
      { name: 'System' },
    ],
    paths: mergeOperations(),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            code: { type: 'string' },
            details: { type: 'object', additionalProperties: true },
          },
        },
        SuccessEnvelope: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
      },
    },
  };
}

export function generateApiTestingGuide(baseUrl: string) {
  return `# Finora API Testing Guide

Base URL: \`${baseUrl}/api/v1\`

Swagger UI: \`${baseUrl}/api-docs\`
OpenAPI JSON: \`${baseUrl}/api-docs/openapi.json\`

## 1. Authentication setup

1. Register with \`POST /api/v1/auth/register\` or login with \`POST /api/v1/auth/login\`.
2. Copy the returned bearer token.
3. Use header:

\`\`\`
Authorization: Bearer <token>
Content-Type: application/json
\`\`\`

## 2. Core feature coverage

- Auth: register, login, profile get/update, OTP send/verify, device list/revoke
- Accounts: list, create, get, update, delete
- Transactions: list, create, get, update, delete, by-account list
- Goals: list, create, get, update, delete
- Loans: list, create, get, update, delete, add payment
- Investments: list, create, update, delete
- Friends: list, create, update, delete
- Groups: list, create, update, delete
- Settings: get, update
- Notifications: list, unread count, get, mark read, mark all read, delete, clear all
- Sync: pull, push, register device, list devices, deactivate device
- Dashboard: summary, cashflow
- Advisor flows: advisors list/get, bookings create/list/get/accept/reject/cancel/reschedule, sessions get/messages/start/complete/cancel
- Admin: users, approvals, stats, feature flags, reports, AI admin endpoints

## 3. Recommended method-by-method test checklist

### GET
- Verify \`200\` response shape
- Verify auth-protected routes return \`401\` without a token
- Verify resource-scoped routes return \`404\` for missing IDs
- Verify filtering/query params narrow the result set correctly

### POST
- Verify valid payload returns \`200\` or \`201\`
- Verify missing required fields return \`400\`
- Verify duplicate or invalid business cases return the expected validation error
- Verify created rows are visible through follow-up \`GET\`

### PUT / PATCH
- Verify only targeted fields change
- Verify invalid IDs return \`404\` or \`403\` when ownership fails
- Verify stale/invalid payloads return \`400\`

### DELETE
- Verify delete returns success payload
- Verify deleted resource no longer appears in list/detail endpoints
- Verify repeated delete calls return the expected not-found/error behavior

## 4. Rate-limit cases worth testing

- Auth routes: repeated login/register attempts
- Bills routes: repeated uploads
- Receipts routes: repeated scans
- Sync routes: burst pull/push requests

Expected failure status: \`429 Too Many Requests\`

## 5. Database verification points

- Accounts and transactions maintain balance consistency
- Loan payment reduces outstanding balance
- Booking accept creates an advisor session
- Session messages create notification records for the opposite participant
- Notification read/clear flows update persistence correctly
- Sync pull returns records updated after \`lastSyncedAt\`

## 6. Frontend-backend integration checks

- Login -> profile fetch -> dashboard data load
- Add account -> account list refresh
- Add transaction -> dashboard / account balance refresh
- Create booking -> advisor booking request visible -> accept/reject/reschedule -> notification/session side effects
- Session chat -> message list + counterpart notification

## 7. Tester notes

- Prefer Swagger UI for discovery and ad hoc calls.
- Use the OpenAPI JSON for Postman import or automated QA collections.
- Validate both API response correctness and resulting database state for write operations.
`;
}
