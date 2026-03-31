/**
 * 任务 T3-04: Gateway 桥接接入
 * 目标文件: packages/dashboard-remote-server/src/server/jsonRpcServer.ts
 *
 * 将 gatewayBridge 模块接入 JSON-RPC 方法注册
 * 实现 gateway.runAgent, gateway.getStatus, gateway.listAgents 方法
 */

// ==================== jsonRpcServer.ts 修改 ====================
// 在 setupMethods() 方法中添加 Gateway 方法注册:

private setupMethods(): void {
  // ... 现有文件系统和监控方法 ...

  // ==================== Gateway 方法 ====================

  // gateway.connect - 连接本地 Gateway
  this.connection.onRequest('gateway.connect', async () => {
    if (!this.gatewayBridge) {
      return { success: false, error: 'Gateway bridge not initialized' };
    }
    try {
      await this.gatewayBridge.connect();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // gateway.disconnect - 断开 Gateway
  this.connection.onRequest('gateway.disconnect', async () => {
    if (!this.gatewayBridge) return { success: true };
    try {
      await this.gatewayBridge.disconnect();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // gateway.runAgent - 通过 Gateway 运行 Agent
  this.connection.onRequest('gateway.runAgent', async (params: RunAgentParams) => {
    if (!this.gatewayBridge) {
      throw new Error('Gateway bridge not initialized');
    }
    if (!this.gatewayBridge.isConnected()) {
      throw new Error('Gateway not connected');
    }

    // 调用 gateway bridge 的 runAgent
    await this.gatewayBridge.runAgent(params);
    return { success: true };
  });

  // gateway.getStatus - 获取 Gateway 连接状态
  this.connection.onRequest('gateway.getStatus', async () => {
    return {
      connected: this.gatewayBridge?.isConnected() || false,
      gatewayUrl: this.config.gateway?.url || null,
    };
  });

  // gateway.listAgents - 列出可用 Agent（从 Gateway 获取）
  this.connection.onRequest('gateway.listAgents', async () => {
    if (!this.gatewayBridge || !this.gatewayBridge.isConnected()) {
      return { agents: [] };
    }
    // Gateway 桥接中的 listAgents
    return this.gatewayBridge.listAgents();
  });

  // ==================== Gateway 事件转发 ====================
  // 在初始化 gatewayBridge 后注册事件监听:

  if (this.gatewayBridge) {
    this.gatewayBridge.registerBroadcast((event: AgentEvent) => {
      // 通过 JSON-RPC 通知发送给客户端
      this.connection.sendNotification('gateway.onAgentEvent', event);
    });

    this.gatewayBridge.onConnectionChange((connected: boolean) => {
      this.connection.sendNotification('gateway.onConnectionChange', { connected });
    });
  }
}
