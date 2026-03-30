import ChatExperience from '@/components/ChatExperience';

export default function ChatPage() {
  return (
    <main className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden md:h-auto md:min-h-0 md:flex-1">
      <ChatExperience variant="full" />
    </main>
  );
}
