"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import * as FancyButton from "@/components/ui/fancy-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function VerifyEmailForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    }
  }, [token]);

  const verifyEmail = async (verificationToken: string) => {
    setLoading(true);
    setError("");

    try {
      const { error } = await authClient.verifyEmail({
        query: {
          token: verificationToken,
        },
      });

      if (error) {
        setError(error.message || "Email verification failed");
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      }
    } catch (err) {
      setError((err as Error).message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    if (!email) {
      setError("Email address is required to resend verification");
      return;
    }

    setResendLoading(true);
    setError("");

    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
      });

      if (error) {
        setError(error.message || "Failed to resend verification email");
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError((err as Error).message || "An unexpected error occurred");
    } finally {
      setResendLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full sm:max-w-md sm:border sm:shadow-sm sm:rounded-xl border-0 shadow-none rounded-none py-4 sm:py-6">
        <CardHeader className="text-center px-4 sm:px-6">
          <CardTitle>Verifying your email...</CardTitle>
          <CardDescription>
            Please wait while we verify your email address.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="w-full sm:max-w-md sm:border sm:shadow-sm sm:rounded-xl border-0 shadow-none rounded-none py-4 sm:py-6">
        <CardHeader className="text-center px-4 sm:px-6">
          <CardTitle>Email verified!</CardTitle>
          <CardDescription>
            Your email has been successfully verified. You&apos;ll be redirected
            to the dashboard shortly.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <FancyButton.Root
            className="w-full font-medium"
            onClick={() => router.push("/dashboard")}
            variant="primary"
            size="small"
          >
            Go to Dashboard
          </FancyButton.Root>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full sm:max-w-md sm:border sm:shadow-sm sm:rounded-xl border-0 shadow-none rounded-none py-4 sm:py-6">
      <CardHeader className="text-center px-4 sm:px-6">
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>
          {token
            ? "We&apos;re verifying your email address."
            : "Check your email for a verification link, or request a new one below."}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!token && email && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Didn&apos;t receive the email? Check your spam folder or request a
              new verification email.
            </p>
            <FancyButton.Root
              className="w-full font-medium"
              onClick={resendVerification}
              disabled={resendLoading}
              variant="primary"
              size="small"
            >
              {resendLoading ? "Sending..." : "Resend verification email"}
            </FancyButton.Root>
          </div>
        )}

        <div className="mt-4 text-center">
          <FancyButton.Root
            variant="secondary"
            onClick={() => router.push("/login")}
            size="small"
            className="font-medium"
          >
            Back to Login
          </FancyButton.Root>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <Card className="w-full sm:max-w-md sm:border sm:shadow-sm sm:rounded-xl border-0 shadow-none rounded-none py-4 sm:py-6">
          <CardHeader className="text-center px-4 sm:px-6">
            <CardTitle>Loading...</CardTitle>
            <CardDescription>
              Please wait while we load the email verification form.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          </CardContent>
        </Card>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
