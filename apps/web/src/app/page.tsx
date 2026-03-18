'use client';

import { useState, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { MainContent } from '@/components/layout/MainContent';
import { ArtifactsPanel } from '@/components/layout/ArtifactsPanel';
import { useChatStore } from '@/stores/chatStore';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { currentConversationId, createConversation, conversations, setCurrentConversation, isHistoryLoaded, setHistoryLoaded } = useChatStore();
  const { loadHistory, switchConversation, createConversation: createConversationWS, waitForConnection } = useWebSocket();

  // Track if we've already handled initial conversation to prevent re-runs
  const initialConversationHandledRef = useRef(false);
  const historyLoadInitiatedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Wait for WebSocket connection before loading history
  useEffect(() => {
    if (mounted && !historyLoadInitiatedRef.current) {
      historyLoadInitiatedRef.current = true;
      waitForConnection().then(() => {
        console.log('[Page] WebSocket connected, loading history...');
        loadHistory();
      });
    }
  }, [mounted, waitForConnection, loadHistory]);

  // Handle initial conversation selection/creation - only after history is loaded
  useEffect(() => {
    // Only run once, and only after history is definitively loaded
    if (!mounted || !isHistoryLoaded || initialConversationHandledRef.current) {
      return;
    }

    // Mark as handled to prevent re-runs
    initialConversationHandledRef.current = true;

    if (!currentConversationId) {
      if (conversations.length > 0) {
        // Switch to the most recent conversation
        const mostRecent = conversations[0];
        console.log('[Page] Switching to existing conversation:', mostRecent.id);
        setCurrentConversation(mostRecent.id);
        switchConversation(mostRecent.id);
      } else {
        // No conversations exist, create a new one
        console.log('[Page] No conversations, creating new one');
        const newId = createConversation();
        createConversationWS(newId);
      }
    }
  }, [mounted, isHistoryLoaded, conversations, currentConversationId, createConversation, setCurrentConversation, switchConversation, createConversationWS]);

  // Fallback: if history takes too long (e.g., server timeout), mark as loaded
  useEffect(() => {
    if (mounted && !isHistoryLoaded) {
      const timeout = setTimeout(() => {
        console.log('[Page] History load timeout, proceeding anyway');
        setHistoryLoaded(true);
      }, 5000); // 5 second timeout

      return () => clearTimeout(timeout);
    }
  }, [mounted, isHistoryLoaded, setHistoryLoaded]);

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
      <ArtifactsPanel />
    </div>
  );
}
