"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
import Link from "next/link";
import { LogoMark } from "@/components/shared/icons";

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be less than 128 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don&apos;t match",
    path: ["confirmPassword"],
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) {
      setError("Invalid reset token");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error } = await authClient.resetPassword({
        newPassword: data.password,
        token,
      });

      if (error) {
        setError(error.message || "Failed to reset password");
      } else {
        router.push("/login?message=Password reset successfully");
      }
    } catch (err) {
      setError((err as Error).message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Card className="w-full sm:max-w-md sm:border sm:shadow-sm sm:rounded-xl border-0 shadow-none rounded-none py-4 sm:py-6">
        <CardHeader className="text-center px-4 sm:px-6">
          <div className="mb-6 text-center flex items-center justify-center">
            <Link href="/" title="Home">
              <LogoMark className="h-12 w-12" />
            </Link>
          </div>
          <CardTitle>Invalid Reset Link</CardTitle>
          <CardDescription>
            This password reset link is invalid or has expired.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <FancyButton.Root
            className="w-full font-medium"
            onClick={() => router.push("/forgot-password")}
            variant="primary"
            size="small"
          >
            Request New Reset Link
          </FancyButton.Root>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full sm:max-w-md sm:border sm:shadow-sm sm:rounded-xl border-0 shadow-none rounded-none py-4 sm:py-6">
      <CardHeader className="text-center px-4 sm:px-6">
        <div className="mb-6 text-center flex items-center justify-center">
          <Link href="/" title="Home">
            <LogoMark className="h-12 w-12" />
          </Link>
        </div>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>Enter your new password below.</CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter your new password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Confirm your new password"
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
              {loading ? "Resetting..." : "Reset Password"}
            </FancyButton.Root>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
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
              Please wait while we load the password reset form.
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
      <ResetPasswordForm />
    </Suspense>
  );
}
