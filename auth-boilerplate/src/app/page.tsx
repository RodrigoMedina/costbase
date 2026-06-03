"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import * as FancyButton from "@/components/ui/fancy-button";
import { LogoMark } from "@/components/shared/icons";
import Link from "next/link";

export default function HomePage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && session) {
      router.push("/dashboard");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Not logged in — show landing page
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background p-4">
      <LogoMark className="h-16 w-16" />
      <h1 className="text-3xl font-bold tracking-tight">Welcome to My App</h1>
      <p className="text-muted-foreground text-center max-w-md">
        A modern web application with secure authentication.
      </p>
      <div className="flex gap-4">
        <FancyButton.Root variant="primary" size="small" asChild>
          <Link href="/signup">Get Started</Link>
        </FancyButton.Root>
        <FancyButton.Root variant="secondary" size="small" asChild>
          <Link href="/login">Sign In</Link>
        </FancyButton.Root>
      </div>
    </main>
  );
}
