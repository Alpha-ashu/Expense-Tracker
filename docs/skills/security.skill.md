# Security Skill Reference – Finora

> Stack: Supabase Auth · Custom JWT · Helmet · CORS · express-rate-limit · Zod · bcrypt

---

## 1. Authentication Flow

### Dual-Path JWT Verification (backend/src/middleware/auth.ts)

The `authenticate` middleware verifies incoming Bearer tokens using a waterfall:

```
1. Try custom JWT_SECRET (server-issued tokens)
        ↓ (fails)
2. Try SUPABASE_JWT_SECRET (Supabase-issued tokens)
        ↓ (fails)
3. Call Supabase REST API → GET /auth/v1/user
        ↓ (fails / NODE_ENV === 'development')
4. Dev bypass (non-production only)
```

> **Never** enable the dev bypass in production. Guard with `if (process.env.NODE_ENV !== 'production')`.

### Token Storage (frontend)
- Access token stored under `localStorage.accessToken` (and mirrored keys for compatibility).
- Refresh token stored under `localStorage.refreshToken`.
- `TokenManager` in `frontend/src/lib/api.ts` centralises all read/write/clear operations.
- On 401 response, tokens are cleared and the user is redirected to `/login` unless a live Supabase session exists.

---

## 2. Password Security

- Passwords are hashed with **bcrypt** (cost factor ≥ 12 in production).
- Plain-text passwords must never be logged, stored, or returned in API responses.
- Enforce minimum password policy at both layers:
  - **Frontend**: form validation (min 8 chars).
  - **Backend**: Zod schema + controller guard.

---

## 3. Helmet (HTTP Security Headers)

Helmet is mounted as the **first** middleware in `app.ts`:

```ts
app.use(helmet());
```

Default headers set by Helmet:
| Header | Purpose |
|---|---|
| `Content-Security-Policy` | Mitigate XSS |
| `X-Frame-Options` | Prevent clickjacking |
| `X-Content-Type-Options` | Prevent MIME sniffing |
| `Strict-Transport-Security` | Force HTTPS |
| `Referrer-Policy` | Limit referrer leakage |

Do **not** disable Helmet headers without security review.

---

## 4. CORS Configuration

```ts
app.use(cors({
  origin: [process.env.FRONTEND_URL!, 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
```

- The origin allowlist is configured via `FRONTEND_URL` env var.
- Never use `origin: '*'` with `credentials: true` – browsers will reject it.
- Pre-flight (`OPTIONS`) requests are handled automatically by the CORS middleware.

---

## 5. Rate Limiting

Two rate-limit tiers are applied:

### Global limiter
Applied to all routes:
```ts
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
```

### Auth limiter (stricter)
Applied to `/api/v1/auth/login` and `/api/v1/auth/register`:
```ts
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
```

When the limit is exceeded the server returns `429 Too Many Requests` with code `RATE_LIMIT_EXCEEDED`.

---

## 6. Input Validation (Zod)

### Backend
All mutating routes must use the `validate` middleware:

```ts
import { validate } from '../../middleware/validate';
import { createTransactionSchema } from './transactions.schema';

router.post('/', authenticate, validate(createTransactionSchema), createTransaction);
```

Zod errors are caught by the central `errorHandler` and surfaced as `400 VALIDATION_ERROR` responses without leaking field details to the response body (only to the server log).

### Frontend
- Validate form inputs with Zod before calling the API:
  ```ts
  const result = schema.safeParse(formData);
  if (!result.success) {
    ValidationErrorHandler.showErrors(result.error.issues.map(...));
    return;
  }
  ```
- Never rely only on backend validation – validate on both sides.

---

## 7. Ownership Checks

Every request that accesses user data must verify ownership **server-side**:

```ts
// Correct: filter by userId
const account = await prisma.account.findFirst({
  where: { id: accountId, userId: req.userId },
});
if (!account) throw AppError.notFound('Account');

// Wrong: find by id only (anyone can access any account)
const account = await prisma.account.findUnique({ where: { id: accountId } });
```

- Ownership is checked at the **service layer**, not the route layer.
- Do not rely on frontend-only access control.

---

## 8. Secrets Management

| Secret | Location | Access |
|---|---|---|
| `JWT_SECRET` | `.env` (backend) | Server-side only |
| `SUPABASE_SERVICE_KEY` | `.env` (backend) | Server-side only – never expose |
| `SUPABASE_JWT_SECRET` | `.env` (backend) | Server-side only |
| `VITE_SUPABASE_ANON_KEY` | `.env` (frontend) | Public – safe for browser |
| `VITE_SUPABASE_URL` | `.env` (frontend) | Public – safe for browser |
| `DATABASE_URL` | `.env` (backend) | Server-side only |

Rules:
- Never commit `.env` files. Use `.env.example` with placeholder values.
- Never log secrets, even partially.
- Rotate `JWT_SECRET` if compromised – all existing tokens become invalid.

---

## 9. SQL Injection Prevention

- Prisma uses parameterised queries by default – no raw string concatenation in queries.
- If you use `prisma.$queryRaw`, always use tagged template literals (Prisma sanitises them):
  ```ts
  // ✅ Safe
  await prisma.$queryRaw`SELECT * FROM users WHERE id = ${userId}`;

  // ❌ UNSAFE – SQL injection risk
  await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE id = '${userId}'`);
  ```

---

## 10. XSS Prevention

- All user-supplied text is sanitised with the `sanitize` utility (`backend/src/utils/sanitize.ts`) before storage.
- React escapes JSX expressions by default – do not use `dangerouslySetInnerHTML` with user data.
- CSP headers (Helmet) provide a second layer of defence.

---

## 11. Security Checklist (Pre-Release)

- [ ] Helmet is the first middleware.
- [ ] CORS origin list does not include `*`.
- [ ] Rate limiters are active on auth endpoints.
- [ ] All mutating routes have `validate(schema)`.
- [ ] All data routes have `authenticate` + ownership check.
- [ ] No secrets in source code or logs.
- [ ] Passwords use bcrypt, cost ≥ 12.
- [ ] `NODE_ENV=production` set in deployment environment.
- [ ] Dev auth bypass is unreachable in production.
- [ ] Supabase RLS is enabled on all user-scoped tables.

