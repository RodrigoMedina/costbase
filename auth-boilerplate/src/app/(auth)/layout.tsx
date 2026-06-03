export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="bg-gray-50 dark:bg-gray-900">
      <div className="flex min-h-dvh items-center justify-center p-4 sm:p-6 lg:p-8">
        {children}
      </div>
    </main>
  );
}
