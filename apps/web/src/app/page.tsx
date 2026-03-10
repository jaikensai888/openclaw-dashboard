'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { MainContent } from '@/components/layout/MainContent';
import { useChatStore } from '@/stores/chatStore';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { currentConversationId, createConversation } = useChatStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Create initial conversation if none exists
    if (mounted && !currentConversationId) {
      createConversation();
    }
  }, [mounted, currentConversationId, createConversation]);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-neutral-900 text-white">
      <Sidebar />
      <MainContent />
    </div>
  );
}
