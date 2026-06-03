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

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const message = searchParams.get("message");

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError("");

    try {
      const { error } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
        callbackURL: redirectTo,
      });

      if (error) {
        if (error.status === 403) {
          setError("Please verify your email address before logging in.");
        } else {
          setError(error.message || "Login failed");
        }
      } else {
        router.push(redirectTo);
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

  return (
    <Card className="w-full sm:max-w-md sm:border sm:shadow-sm sm:rounded-xl border-0 shadow-none rounded-none py-4 sm:py-6">
      <CardHeader className="px-4 sm:px-6">
        <div className="mb-6 text-center flex items-center justify-center">
          <Link href="/" title="Home">
            <LogoMark className="h-12 w-12" />
          </Link>
        </div>
        <CardTitle>Welcome back 👋</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        {message && (
          <Alert className="mb-4">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="mt-4">
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
            </div>
            <FieldSeparator className="my-5">Or continue with</FieldSeparator>

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
                      placeholder="Enter your password"
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
              {loading ? "Signing in..." : "Sign in"}
            </FancyButton.Root>
          </form>
        </Form>

        <div className="mt-4 text-center text-sm">
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-primary"
          >
            Forgot your password?
          </Link>
        </div>

        <div className="mt-4 text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Card className="w-full sm:max-w-md sm:border sm:shadow-sm sm:rounded-xl border-0 shadow-none rounded-none py-4 sm:py-6">
          <CardHeader className="text-center px-4 sm:px-6">
            <div className="flex items-center justify-center mb-4">
              <Link href="/" title="Home">
                <LogoMark className="h-12 w-12" />
              </Link>
            </div>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>
              Please wait while we load the login form.
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
      <LoginForm />
    </Suspense>
  );
}
