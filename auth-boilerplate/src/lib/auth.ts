import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { apiKey } from "@better-auth/api-key";
import { Resend } from "resend";
import type { ReactElement } from "react";
import { getDb } from "@/lib/db";
import { VerificationEmail } from "@/emails/verification-email";
import { ResetPasswordEmail } from "@/emails/reset-password-email";
import { WelcomeEmail } from "@/emails/welcome-email";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const fromAddress =
  process.env.SMTP_FROM || "Auth Boilerplate <onboarding@resend.dev>";

function normalizeUrl(url: string | undefined, fallback: string) {
  if (!url) return fallback;
  return url.startsWith("http://") || url.startsWith("https://")
    ? url
    : `https://${url}`;
}

const appUrl = normalizeUrl(
  process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL,
  process.env.NODE_ENV === "development" ? "http://localhost:3000" : "",
);

async function sendAuthEmail(params: {
  to: string;
  subject: string;
  react: ReactElement;
}) {
  if (!resend) {
    console.log(`[EMAIL STUB] To: ${params.to}, Subject: "${params.subject}"`);
    return;
  }
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: params.to,
    subject: params.subject,
    react: params.react,
  });

  if (error) {
    console.error(`Failed to send "${params.subject}" email:`, error);
  }
}

async function sendVerificationEmail(params: {
  email: string;
  verificationUrl: string;
  userName: string;
}) {
  await sendAuthEmail({
    to: params.email,
    subject: "Verify your email address",
    react: VerificationEmail({
      email: params.email,
      userName: params.userName,
      verificationUrl: params.verificationUrl,
      baseUrl: appUrl,
    }),
  });
}

async function sendResetPasswordEmail(params: {
  email: string;
  resetUrl: string;
  userName: string;
}) {
  await sendAuthEmail({
    to: params.email,
    subject: "Reset your password",
    react: ResetPasswordEmail({
      email: params.email,
      userName: params.userName,
      resetUrl: params.resetUrl,
      baseUrl: appUrl,
    }),
  });
}

async function sendWelcomeEmail(params: {
  email: string;
  userName: string;
}) {
  await sendAuthEmail({
    to: params.email,
    subject: "Welcome!",
    react: WelcomeEmail({
      email: params.email,
      userName: params.userName,
      baseUrl: appUrl,
    }),
  });
}

export function getAuth() {
  return betterAuth({
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  database: drizzleAdapter(getDb(), { provider: "pg" }),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: appUrl,
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.AUTH_URL,
    "http://localhost:5173",
    "http://localhost:3000",
  ].filter(Boolean) as string[],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendEmailVerificationOnSignUp: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail({
        email: user.email,
        resetUrl: url,
        userName: user.name,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({
        email: user.email,
        verificationUrl: url,
        userName: user.name,
      });
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await sendWelcomeEmail({
            email: user.email,
            userName: user.name,
          });
        },
      },
    },
  },
  plugins: [
    apiKey({
      defaultPrefix: "cb_",
      defaultKeyLength: 48,
      rateLimit: {
        enabled: true,
        timeWindow: 60_000,
        maxRequests: 60,
      },
    }),
  ],
  });
}
