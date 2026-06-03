# 🔐 Auth Boilerplate — Next.js + Better Auth + Drizzle + Neon

Drop-in authentication system. Landing page, signup, login, password reset, email verification, and a simple dashboard.

## 📁 Structure

```
auth-export/
├── .env.example
├── package.json
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── drizzle.config.ts
│
└── src/
    ├── app/
    │   ├── globals.css              ← Tailwind v4 + shadcn theme
    │   ├── layout.tsx               ← Root layout (Inter font)
    │   ├── page.tsx                 ← Landing page
    │   ├── (auth)/
    │   │   ├── layout.tsx           ← Auth pages wrapper
    │   │   ├── login/               ← Email + Google login
    │   │   ├── signup/              ← Registration
    │   │   ├── forgot-password/     ← Request reset link
    │   │   ├── reset-password/      ← Set new password
    │   │   └── verify-email/        ← Email verification
    │   ├── dashboard/
    │   │   └── page.tsx             ← Protected dashboard
    │   └── api/auth/[...all]/route.ts
    │
    ├── middleware.ts                ← Route protection + CORS
    ├── lib/
    │   ├── auth.ts                  ← Better Auth config
    │   ├── auth-client.ts           ← React auth hooks
    │   ├── db/
    │   │   ├── auth-schema.ts       ← User, Session, Account, Verification
    │   │   └── index.ts             ← Drizzle + Neon connection
    │   └── utils.ts                 ← cn() helper
    ├── components/
    │   ├── shared/icons.tsx         ← Logo, GoogleIcon
    │   └── ui/                      ← shadcn-style components
    │       ├── fancy-button.tsx
    │       ├── input.tsx
    │       ├── form.tsx
    │       ├── card.tsx
    │       ├── alert.tsx
    │       ├── field.tsx
    │       ├── label.tsx
    │       └── separator.tsx
    └── utils/                       ← FancyButton utilities
        ├── cn.tsx
        ├── tv.tsx
        ├── polymorphic.tsx
        └── recursive-clone-children.tsx
```

## 🚀 Quick Start

### 1. Create a project from this directory

```bash
# Option A: Copy into a new project
cp -r auth-export my-new-app
cd my-new-app

# Option B: Start fresh
mkdir my-app && cd my-app
# Copy all files from auth-export/ into my-app/
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up your database

Create a PostgreSQL database (e.g. [Neon](https://neon.tech)).

Copy `.env.example` → `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
BETTER_AUTH_SECRET=your-secret-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
```

Generate a secret:

```bash
npx @better-auth/cli secret
```

### 4. Generate and apply database migrations

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 📄 Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page (redirects to dashboard if logged in) |
| `/login` | Email + password login, Google OAuth |
| `/signup` | Create account with email |
| `/forgot-password` | Request password reset link |
| `/reset-password?token=...` | Set new password (from email link) |
| `/verify-email?token=...` | Verify email address |
| `/dashboard` | Protected dashboard (shows user info) |

## 🔐 Auth Flow

```
Unathenticated user
  → /  → Landing page → "Get Started" or "Sign In"
  → /login  → Sign in → /dashboard
  → /signup → Create account → verify email → /dashboard

Authenticated user
  → /login, /signup → redirected to /dashboard
  → /dashboard → shown (protected by middleware)
```

Protected routes are configured in `src/middleware.ts`:

```ts
const protectedRoutes = ["/dashboard"];
```

Add more routes as needed.

---

## 🎨 Styling

- **Tailwind CSS v4** with shadcn-compatible CSS variables
- Dark mode support via `.dark` class
- Fancy buttons with gradient effects (AlignUI)
- Responsive auth pages (mobile-first)

---

## ✉️ Email Sending

By default, emails are logged to console. Replace the stubs in `src/lib/auth.ts`:

```ts
async function sendVerificationEmail(params: { email: string; verificationUrl: string; userName: string }) {
  await resend.emails.send({
    from: "noreply@yourapp.com",
    to: params.email,
    subject: "Verify your email",
    html: `<a href="${params.verificationUrl}">Verify</a>`,
  });
}
```

---

## 🔧 Customization

- **Logo**: Edit `src/components/shared/icons.tsx`
- **Branding**: Update `src/app/layout.tsx` metadata, page titles
- **Colors**: Edit CSS variables in `src/app/globals.css` (`--primary`, etc.)
- **Google OAuth**: Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env.local` (or remove `socialProviders` block from `auth.ts`)
- **Protected routes**: Add to `protectedRoutes` array in `src/middleware.ts`

---

## 📦 Key Dependencies

| Package | Purpose |
|---------|---------|
| `better-auth` | Authentication framework |
| `drizzle-orm` + `@neondatabase/serverless` | Database + ORM |
| `next` + `react` + `react-dom` | App framework |
| `react-hook-form` + `zod` + `@hookform/resolvers` | Form validation |
| `tailwindcss` v4 + `tw-animate-css` | Styling |
| `class-variance-authority` + `clsx` + `tailwind-merge` | CSS utilities |
| `@radix-ui/react-slot` + `@radix-ui/react-label` + `@radix-ui/react-separator` | Headless UI |
