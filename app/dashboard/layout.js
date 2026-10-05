import Link from 'next/link';

export const metadata = {
  title: 'Instructor dashboard — Counter-Drone Trainer',
};

export default function DashboardLayout({ children }) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-6 pb-16">
      <header className="flex items-baseline justify-between gap-6 border-b border-ink py-4">
        <Link href="/dashboard" className="font-semibold underline-offset-4 hover:underline">
          Instructor dashboard
        </Link>
        <Link href="/" className="no-print text-sm underline underline-offset-4">
          Trainer home
        </Link>
      </header>
      <main className="pt-8">{children}</main>
    </div>
  );
}
