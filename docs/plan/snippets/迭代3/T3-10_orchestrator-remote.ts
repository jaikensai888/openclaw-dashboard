/**
 * 任务 T3-10: Orchestrator 远程模式
 * 目标文件: apps/server/src/services/orchestrator.ts
 *
 * 修改 handleUserMessage 支持远程服务器路由
 */

// ==================== 新增导入 ====================
import { getRemoteConnectionManager } from '../remote';

// ==================== 修改 handleUserMessage ====================
// 在现有 handleUserMessage 函数中，在调用 runViaGateway 之前添加远程路由判断:

async handleUserMessage(params: {
  conversationId: string;
  content: string;
  virtualAgentId?: string;
  expertSystemPrompt?: string;
  serverId?: string;              // 新增：远程服务器 ID
}) {
  const { conversationId, content, virtualAgentId, expertSystemPrompt, serverId } = params;

  // ========== 远程模式路由 ==========
  if (serverId) {
    console.log(`[Orchestrator] Routing to remote server: ${serverId}`);
    return this.runViaRemote(serverId, {
      conversationId, content, virtualAgentId, expertSystemPrompt,
    });
  }

  // ========== 本地 Gateway 模式（现有逻辑）==========
  return this.runViaGateway({
    conversationId, content, virtualAgentId, expertSystemPrompt,
  });
}

// ==================== 新增 runViaRemote 方法 ====================
private async runViaRemote(
  serverId: string,
  params: {
    conversationId: string;
    content: string;
    virtualAgentId?: string;
    expertSystemPrompt?: string;
  }
): Promise<{ runId?: string; error?: string }> {
  const manager = getRemoteConnectionManager();
  const client = manager.getClient(serverId);

  if (!client) {
    return { error: `远程服务器 ${serverId} 未连接` };
  }

  if (!client.isConnected()) {
    return { error: `远程服务器 ${serverId} 连接已断开` });
  }

  // 确保 Gateway 已连接
  if (!client.isGatewayConnected()) {
    try {
      await client.gatewayConnect();
    } catch (err: any) {
      return { error: `远程 Gateway 连接失败: ${err.message}` };
    }
  }

  try {
    // 注册事件监听，转发到 Orchestrator 事件系统
    const onAgentEvent = (event: any) => {
      this.emit({
        type: event.type,  // agent.active, agent.streaming, agent.message, etc.
        conversationId: params.conversationId,
        data: event.data,
      } as OrchestratorEvent);
    };

    const cleanup = client.onGatewayEvent(onAgentEvent);

    // 发送 Agent 请求
    await client.runAgent({
      conversationId: params.conversationId,
      message: params.content,
      virtualAgentId: params.virtualAgentId,
      systemPrompt: params.expertSystemPrompt,
    });

    return { runId: `remote_${serverId}_${Date.now()}` };
  } catch (err: any) {
    return { error: `远程请求失败: ${err.message}` };
  }
}
