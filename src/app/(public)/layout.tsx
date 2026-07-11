interface PublicLayoutProps {
  children: React.ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center">
        {children}
      </main>
      <footer className="border-t py-4 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} DocVerify. All rights reserved.
      </footer>
    </div>
  );
}
