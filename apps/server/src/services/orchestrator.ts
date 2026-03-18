/**
 * Orchestrator Service
 *
 * Central coordination layer for multi-agent conversations.
 * Handles message routing, agent selection, and handoff logic.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  VirtualAgentId,
  ActiveAgentInfo,
  GatewayRunRef,
  HandoffInstruction,
} from '@openclaw-dashboard/shared';
import {
  getVirtualAgent,
  getDefaultVirtualAgent,
  toActiveAgentInfo,
  isValidAgentId,
  listVirtualAgents,
  type VirtualAgent,
} from './virtualAgents.js';
import {
  getGatewayClient,
  type RunAgentOptions,
  type AgentEvent,
} from './openclawGatewayClient.js';
import {
  parseHandoff,
  buildHandoffContext,
  isHandoffDepthValid,
} from './handoffParser.js';

export interface HandleUserMessageOptions {
  conversationId: string;
  content: string;
  virtualAgentId?: VirtualAgentId;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface OrchestratorEvent {
  type: 'agent.active' | 'agent.handoff' | 'agent.streaming' | 'agent.message' | 'agent.error';
  conversationId: string;
  data: unknown;
}

type OrchestratorEventHandler = (event: OrchestratorEvent) => void;

interface ConversationState {
  currentAgentId: VirtualAgentId;
  handoffDepth: number;
  lastUserMessage?: string;
}

/**
 * Orchestrator class manages multi-agent conversations
 */
export class Orchestrator {
  private runMappings = new Map<string, GatewayRunRef>();
  private conversationStates = new Map<string, ConversationState>();
  private eventHandlers = new Set<OrchestratorEventHandler>();
  private gatewayUnsubscribe: (() => void) | null = null;

  /**
   * Initialize the orchestrator and subscribe to gateway events
   */
  start(): void {
    const gateway = getGatewayClient();
    if (gateway) {
      this.gatewayUnsubscribe = gateway.onAgentEvent((event) => {
        this.handleGatewayEvent(event);
      });
      console.log('[Orchestrator] Started with Gateway connection');
    } else {
      console.log('[Orchestrator] Started without Gateway (plugin mode only)');
    }
  }

  /**
   * Stop the orchestrator
   */
  stop(): void {
    if (this.gatewayUnsubscribe) {
      this.gatewayUnsubscribe();
      this.gatewayUnsubscribe = null;
    }
    this.eventHandlers.clear();
  }

  /**
   * Subscribe to orchestrator events
   */
  onEvent(handler: OrchestratorEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Handle a user message - route to appropriate agent
   */
  async handleUserMessage(options: HandleUserMessageOptions): Promise<{ runId?: string; error?: string }> {
    const { conversationId, content, virtualAgentId, history } = options;

    // Get or create conversation state
    let state = this.conversationStates.get(conversationId);
    if (!state) {
      state = {
        currentAgentId: virtualAgentId || 'default',
        handoffDepth: 0,
      };
      this.conversationStates.set(conversationId, state);
    }

    // Update agent if specified
    if (virtualAgentId && isValidAgentId(virtualAgentId)) {
      state.currentAgentId = virtualAgentId;
    }

    // Store last user message for handoff context
    state.lastUserMessage = content;

    // Get the virtual agent
    const agent = getVirtualAgent(state.currentAgentId) || getDefaultVirtualAgent();

    // Emit agent.active event
    this.emit({
      type: 'agent.active',
      conversationId,
      data: { agent: toActiveAgentInfo(agent) },
    });

    // Try Gateway direct connection first
    const gateway = getGatewayClient();
    if (gateway?.isConnected()) {
      return this.runViaGateway(conversationId, agent, content, history, state);
    }

    // Fall back to plugin mode (handled by websocket.ts)
    return { error: 'No gateway connection, falling back to plugin mode' };
  }

  /**
   * Handle gateway events (streaming, completion, etc.)
   */
  handleGatewayEvent(event: AgentEvent): void {
    const mapping = this.runMappings.get(event.runId);
    if (!mapping) {
      return;
    }

    const { conversationId, virtualAgentId } = mapping;

    if (event.stream === 'start') {
      this.emit({
        type: 'agent.streaming',
        conversationId,
        data: { delta: '', done: false },
      });
    } else if (event.stream === 'delta' && event.data?.delta) {
      this.emit({
        type: 'agent.streaming',
        conversationId,
        data: { delta: event.data.delta, done: false },
      });
    } else if (event.stream === 'end' || event.data?.done) {
      const content = event.data?.content || '';

      // Check for handoff instruction
      const parsed = parseHandoff(content, virtualAgentId);

      if (parsed.handoff) {
        this.handleHandoff(conversationId, parsed.handoff, parsed.cleanContent);
      } else {
        this.emit({
          type: 'agent.message',
          conversationId,
          data: { content: parsed.cleanContent },
        });
      }

      this.emit({
        type: 'agent.streaming',
        conversationId,
        data: { delta: '', done: true },
      });

      // Clean up mapping
      this.runMappings.delete(event.runId);
    }
  }

  /**
   * Get available agents
   */
  getAvailableAgents(): ActiveAgentInfo[] {
    return listVirtualAgents().map(toActiveAgentInfo);
  }

  /**
   * Get current agent for a conversation
   */
  getCurrentAgent(conversationId: string): ActiveAgentInfo | null {
    const state = this.conversationStates.get(conversationId);
    if (!state) {
      return null;
    }

    const agent = getVirtualAgent(state.currentAgentId);
    return agent ? toActiveAgentInfo(agent) : null;
  }

  /**
   * Set agent for a conversation
   */
  setConversationAgent(conversationId: string, agentId: VirtualAgentId): boolean {
    if (!isValidAgentId(agentId)) {
      return false;
    }

    let state = this.conversationStates.get(conversationId);
    if (!state) {
      state = {
        currentAgentId: agentId,
        handoffDepth: 0,
      };
      this.conversationStates.set(conversationId, state);
    } else {
      state.currentAgentId = agentId;
      state.handoffDepth = 0; // Reset handoff depth when manually switching
    }

    return true;
  }

  // Private methods

  private async runViaGateway(
    conversationId: string,
    agent: VirtualAgent,
    content: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> | undefined,
    state: ConversationState
  ): Promise<{ runId?: string; error?: string }> {
    const gateway = getGatewayClient();
    if (!gateway) {
      return { error: 'Gateway not available' };
    }

    try {
      const options: RunAgentOptions = {
        conversationId,
        virtualAgentId: agent.id,
        systemPrompt: agent.systemPrompt,
        userMessage: content,
        history,
        model: agent.model,
      };

      const result = await gateway.runAgent(options);

      // Store mapping for event routing
      this.runMappings.set(result.runId, {
        runId: result.runId,
        virtualAgentId: agent.id,
        conversationId,
      });

      return { runId: result.runId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Orchestrator] Gateway run failed:', message);
      return { error: message };
    }
  }

  private async handleHandoff(
    conversationId: string,
    handoff: HandoffInstruction,
    currentContent: string
  ): Promise<void> {
    const state = this.conversationStates.get(conversationId);
    if (!state) {
      return;
    }

    // Check handoff depth
    if (!isHandoffDepthValid(state.handoffDepth)) {
      this.emit({
        type: 'agent.message',
        conversationId,
        data: {
          content: `${currentContent}\n\n[系统提示: 已达到最大交接深度，无法继续移交]`,
        },
      });
      return;
    }

    const fromAgent = getVirtualAgent(handoff.fromAgentId);
    const toAgent = getVirtualAgent(handoff.toAgentId);

    if (!toAgent) {
      this.emit({
        type: 'agent.message',
        conversationId,
        data: {
          content: `${currentContent}\n\n[系统提示: 目标 Agent 不存在: ${handoff.toAgentId}]`,
        },
      });
      return;
    }

    // Emit handoff event
    this.emit({
      type: 'agent.handoff',
      conversationId,
      data: {
        fromAgentId: handoff.fromAgentId,
        toAgentId: handoff.toAgentId,
        reason: handoff.reason,
      },
    });

    // Update state
    state.currentAgentId = handoff.toAgentId;
    state.handoffDepth += 1;

    // Emit new agent active
    this.emit({
      type: 'agent.active',
      conversationId,
      data: { agent: toActiveAgentInfo(toAgent) },
    });

    // Build context for new agent
    const handoffContext = buildHandoffContext(
      { displayName: fromAgent?.displayName || handoff.fromAgentId },
      state.lastUserMessage || '',
      currentContent,
      handoff.reason
    );

    // Start new agent run
    const gateway = getGatewayClient();
    if (gateway?.isConnected()) {
      try {
        const result = await gateway.runAgent({
          conversationId,
          virtualAgentId: toAgent.id,
          systemPrompt: toAgent.systemPrompt,
          userMessage: handoffContext,
          model: toAgent.model,
        });

        this.runMappings.set(result.runId, {
          runId: result.runId,
          virtualAgentId: toAgent.id,
          conversationId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.emit({
          type: 'agent.error',
          conversationId,
          data: { error: `Handoff failed: ${message}` },
        });
      }
    }
  }

  private emit(event: OrchestratorEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('[Orchestrator] Event handler error:', error);
      }
    }
  }
}

// Singleton instance
let orchestratorInstance: Orchestrator | null = null;

/**
 * Get or create the orchestrator singleton
 */
export function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator();
  }
  return orchestratorInstance;
}

/**
 * Initialize and start the orchestrator
 */
export function initOrchestrator(): Orchestrator {
  const orchestrator = getOrchestrator();
  orchestrator.start();
  return orchestrator;
}
