'use client';

import { usePathname } from 'next/navigation';
import ChatExperience from './ChatExperience';

export default function ChatWidgetWrapper() {
  const pathname = usePathname();

  if (!pathname) return null;
  if (pathname.startsWith('/chat')) return null;

  return <ChatExperience variant="widget" />;
}

