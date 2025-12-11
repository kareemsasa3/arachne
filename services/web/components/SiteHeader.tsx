'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/chat', label: 'Chat' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/history', label: 'History' },
  { href: '/search', label: 'Search' },
  { href: '/debug/db-viewer', label: 'DB Viewer' },
];

export default function SiteHeader() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-transparent backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="text-lg font-semibold text-white tracking-tight">
          Arachne
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 transition-colors ${
                isActive(link.href)
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-gray-200 hover:bg-white/10'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

