import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create your account.",
  robots: { index: false, follow: false },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
