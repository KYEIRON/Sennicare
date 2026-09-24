export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-boyd-navy-950 px-6 py-12">
      {children}
    </div>
  );
}
