'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { MainContent } from '@/components/layout/MainContent';
import { useChatStore } from '@/stores/chatStore';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const { currentConversationId, createConversation, conversations, setCurrentConversation } = useChatStore();
  const { loadHistory, switchConversation, createConversation: createConversationWS } = useWebSocket();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Load history on mount
    if (mounted) {
      loadHistory();
      // Wait a bit for history to load
      const timeout = setTimeout(() => {
        setHistoryLoaded(true);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [mounted, loadHistory]);

  useEffect(() => {
    // Handle initial conversation after history is loaded
    if (mounted && historyLoaded) {
      if (conversations.length > 0 && !currentConversationId) {
        // Switch to the most recent conversation
        const mostRecent = conversations[0];
        setCurrentConversation(mostRecent.id);
        switchConversation(mostRecent.id);
      } else if (conversations.length === 0 && !currentConversationId) {
        // No conversations exist, create a new one
        const newId = createConversation();
        createConversationWS(newId);
      }
    }
  }, [mounted, historyLoaded, conversations, currentConversationId, createConversation, setCurrentConversation, switchConversation, createConversationWS]);

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
