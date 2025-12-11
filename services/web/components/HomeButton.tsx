import Link from 'next/link';

interface HomeButtonProps {
  label?: string;
  href?: string;
  className?: string;
}

export default function HomeButton({
  label = '← Home',
  href = '/',
  className = '',
}: HomeButtonProps) {
  const base =
    'inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors';

  return (
    <Link href={href} className={`${base} ${className}`}>
      {label}
    </Link>
  );
}

