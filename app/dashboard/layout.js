import Link from 'next/link';
import RoleToggle from '@/components/dashboard/RoleToggle';

export const metadata = {
  title: 'Instructor dashboard — Counter-Drone Trainer',
};

export default function DashboardLayout({ children }) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-6 pb-16">
      <header className="flex items-baseline justify-between gap-6 border-b border-rule py-4">
        <Link href="/dashboard" className="text-base font-bold tracking-tight link-wipe">
          <span data-instructor-only>Instructor dashboard</span>
          <span data-trainee-only>Trainee record</span>
        </Link>
        <div className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-2">
          <RoleToggle />
          <Link href="/" className="no-print link-wipe text-sm text-accent">
            Trainer home
          </Link>
        </div>
      </header>
      <main className="pt-8">{children}</main>
    </div>
  );
}
