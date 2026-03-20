import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useChatStore } from './chatStore'

describe('chatStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useChatStore.setState({
      conversations: [],
      currentConversationId: null,
      messages: {},
      tasks: {},
      taskOutputs: {},
      streamingContent: '',
      isStreaming: false,
      sidebarOpen: true,
      taskModalTaskId: null,
    })
  })

  describe('setConversations', () => {
    it('should replace all conversations with the provided list', () => {
      const { setConversations, conversations } = useChatStore.getState()

      // Simulate loading conversations from server (e.g., after page refresh)
      setConversations([
        {
          id: 'conv_1',
          title: 'Previous Conversation 1',
          pinned: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'conv_2',
          title: 'Previous Conversation 2',
          pinned: true,
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ])

      const state = useChatStore.getState()
      expect(state.conversations).toHaveLength(2)
      expect(state.conversations[0].id).toBe('conv_1')
      expect(state.conversations[1].pinned).toBe(true)
    })

    it('should persist conversations loaded from server history', () => {
      const { setConversations, createConversation } = useChatStore.getState()

      // First, simulate server history being loaded
      setConversations([
        {
          id: 'conv_existing',
          title: 'Existing Conversation',
          pinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      // Verify the conversation was set
      let state = useChatStore.getState()
      expect(state.conversations).toHaveLength(1)
      expect(state.conversations[0].id).toBe('conv_existing')

      // After history is loaded, if we don't create a new conversation,
      // the existing conversation should still be there
      state = useChatStore.getState()
      expect(state.conversations).toHaveLength(1)
      expect(state.conversations[0].id).toBe('conv_existing')
    })
  })

  describe('history loading flow', () => {
    it('should not lose conversations when setConversations is called after page refresh', () => {
      // This test simulates the bug: after page refresh, if history is loaded
      // correctly, the conversations should be available

      const { setConversations, setCurrentConversation } = useChatStore.getState()

      // Simulate server response with conversation history
      const serverConversations = [
        {
          id: 'conv_server_1',
          title: 'Server Conversation',
          pinned: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      setConversations(serverConversations)
      setCurrentConversation('conv_server_1')

      const state = useChatStore.getState()
      expect(state.conversations).toHaveLength(1)
      expect(state.currentConversationId).toBe('conv_server_1')

      // Verify that a "page refresh" simulation (re-reading state) still has the data
      const refreshedState = useChatStore.getState()
      expect(refreshedState.conversations).toHaveLength(1)
    })
  })
})
