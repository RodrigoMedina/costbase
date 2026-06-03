"use client";

import { useState } from "react";
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
import { LogoMark } from "@/components/shared/icons";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setLoading(true);
    setError("");

    try {
      const { error } = await authClient.requestPasswordReset({
        email: data.email,
        redirectTo: "/reset-password",
      });

      if (error) {
        setError(error.message || "Failed to send reset email");
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError((err as Error).message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="w-full sm:max-w-md sm:border sm:shadow-sm sm:rounded-xl border-0 shadow-none rounded-none py-4 sm:py-6">
        <CardHeader className="text-center px-4 sm:px-6">
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We&apos;ve sent you a password reset link. Please check your email
            and follow the instructions.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <FancyButton.Root
            variant="secondary"
            className="w-full font-medium"
            size="small"
            asChild
          >
            <Link href="/login">Back to Login</Link>
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
        <CardDescription>
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </CardDescription>
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

            <FancyButton.Root
              type="submit"
              className="w-full font-medium"
              disabled={loading}
              variant="primary"
              size="small"
            >
              {loading ? "Sending..." : "Send reset link"}
            </FancyButton.Root>
          </form>
        </Form>

        <div className="mt-4 text-center text-sm">
          Remember your password?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
