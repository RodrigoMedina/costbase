"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";
import * as FancyButton from "@/components/ui/fancy-button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldSeparator } from "@/components/ui/field";
import { LogoMark, GoogleIcon } from "@/components/shared/icons";

const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be less than 128 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don&apos;t match",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

function RegisterForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setError("");
    try {
      const { error } = await authClient.signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
        callbackURL: redirectTo,
      });

      if (error) {
        setError(error.message || "Registration failed");
      } else {
        setUserEmail(data.email);
        setSuccess(true);
      }
    } catch (err) {
      setError((err as Error).message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: redirectTo,
    });
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setError("");
    setResendMessage("");

    try {
      const { error } = await authClient.sendVerificationEmail({
        email: userEmail,
      });

      if (error) {
        setError(error.message || "Failed to resend verification email");
      } else {
        setResendMessage("Verification email sent. Please check your inbox.");
      }
    } catch (err) {
      setError((err as Error).message || "An unexpected error occurred");
    } finally {
      setResendLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="w-full sm:max-w-md sm:border sm:shadow-sm sm:rounded-xl border-0 shadow-none rounded-none py-4 sm:py-6">
        <CardHeader className="text-center px-4 sm:px-6">
          <CardTitle>Check your email</CardTitle>
          <CardDescription className="space-y-2">
            <div>
              We&apos;ve sent a verification link to{" "}
              <strong>{userEmail}</strong>
            </div>
            <div>
              Please click the link in your email to verify your account.
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-4 sm:px-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {resendMessage && (
            <Alert>
              <AlertDescription>{resendMessage}</AlertDescription>
            </Alert>
          )}

          <FancyButton.Root
            variant="secondary"
            className="w-full font-medium"
            onClick={() => router.push("/login")}
            size="small"
          >
            Go to Login
          </FancyButton.Root>
          <div className="text-center">
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendLoading}
              className="text-sm text-muted-foreground hover:text-primary underline disabled:opacity-50"
            >
              {resendLoading
                ? "Sending..."
                : "Didn't receive the email? Resend verification"}
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full sm:max-w-md sm:border sm:shadow-sm sm:rounded-xl border-0 shadow-none rounded-none py-4 sm:py-6">
      <CardHeader className="px-4 sm:px-6">
        <div className="mb-6 text-center flex items-center justify-center">
          <Link href="/" title="Home">
            <LogoMark className="h-12 w-12" />
          </Link>
        </div>
        <CardTitle>Get started</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Field className="mt-4">
              <FancyButton.Root
                variant="secondary"
                type="button"
                size="small"
                onClick={handleGoogleLogin}
                className="font-medium"
              >
                <GoogleIcon className="size-4" /> Continue with Google
              </FancyButton.Root>
            </Field>
            <FieldSeparator className="my-5">Or continue with</FieldSeparator>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Create a password"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs text-muted-foreground">
                    Must be at least 8 characters with uppercase, lowercase, and
                    numbers.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Confirm your password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FancyButton.Root
              type="submit"
              className="w-full font-medium"
              disabled={loading}
              variant="primary"
              size="small"
            >
              {loading ? "Creating account..." : "Create account"}
            </FancyButton.Root>
          </form>
        </Form>

        <div className="mt-4 text-center text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <Card className="w-full sm:max-w-md sm:border sm:shadow-sm sm:rounded-xl border-0 shadow-none rounded-none py-4 sm:py-6">
          <CardHeader className="text-center px-4 sm:px-6">
            <div className="mb-6 text-center flex items-center justify-center">
              <Link href="/" title="Home">
                <LogoMark className="h-12 w-12" />
              </Link>
            </div>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>
              Please wait while we load the registration form.
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
      <RegisterForm />
    </Suspense>
  );
}
