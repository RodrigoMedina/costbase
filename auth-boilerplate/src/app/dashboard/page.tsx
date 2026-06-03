"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import * as FancyButton from "@/components/ui/fancy-button";
import { LogoMark } from "@/components/shared/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <main className="min-h-dvh bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <LogoMark className="h-10 w-10" />
          <div className="flex gap-2">
            <Link href="/dashboard/settings">
              <FancyButton.Root variant="basic" size="small">Settings</FancyButton.Root>
            </Link>
            <FancyButton.Root variant="secondary" size="small" onClick={() => signOut()}>
              Sign Out
            </FancyButton.Root>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
            <CardDescription>Welcome back, {session.user?.name || session.user?.email}!</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{session.user?.email}</span>
            </div>
            {session.user?.name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{session.user?.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email Verified</span>
              <span className="font-medium">
                {session.user?.emailVerified ? "✅" : "❌"}
              </span>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          This is your simple dashboard. Build your app from here.
        </p>
      </div>
    </main>
  );
}
