/**
 * 任务 T3-09: WebSocket 消息处理
 * 目标文件: apps/server/src/routes/websocket.ts (新增处理分支)
 *
 * 在 handleMessage 中添加远程连接相关的消息处理
 */

// ==================== 新增导入 ====================
// 在文件顶部添加:
import { getRemoteConnectionManager } from '../remote';

// ==================== 新增消息处理 ====================
// 在 handleMessage 的 switch(message.type) 中添加以下 case:

// --- remote.servers: 返回服务器列表 ---
case 'remote.servers': {
  const manager = getRemoteConnectionManager();
  const servers = manager.getAllServersStatus();
  broadcast('remote.servers', { servers });
  break;
}

// --- remote.switch: 切换活跃服务器 ---
case 'remote.switch': {
  const { serverId } = payload as { serverId: string | null };
  const manager = getRemoteConnectionManager();
  manager.setActiveServer(serverId);

  // 广播给所有客户端
  broadcast('remote.active', { serverId });
  break;
}

// --- directory.list: 列出远程目录 ---
case 'directory:list': {
  const { path: dirPath, serverId } = payload as { path: string; serverId?: string };
  const manager = getRemoteConnectionManager();
  const client = serverId ? manager.getClient(serverId) : manager.getActiveClient();

  if (!client || !client.isConnected()) {
    send(socket, 'directory:list:result', {
      path: dirPath,
      error: '未连接到远程服务器',
    });
    break;
  }

  try {
    const files = await client.listDirectory(dirPath);
    send(socket, 'directory:list:result', { path: dirPath, files });
  } catch (err: any) {
    send(socket, 'directory:list:result', {
      path: dirPath,
      error: err.message || '目录读取失败',
    });
  }
  break;
}

// --- file:read: 读取远程文件 ---
case 'file:read': {
  const { path: filePath, serverId } = payload as { path: string; serverId?: string };
  const manager = getRemoteConnectionManager();
  const client = serverId ? manager.getClient(serverId) : manager.getActiveClient();

  if (!client || !client.isConnected()) {
    send(socket, 'file:read:result', {
      path: filePath,
      error: '未连接到远程服务器',
    });
    break;
  }

  try {
    const content = await client.readFile(filePath);
    send(socket, 'file:read:result', {
      path: filePath,
      content: content.content,
      encoding: content.encoding,
    });
  } catch (err: any) {
    send(socket, 'file:read:result', {
      path: filePath,
      error: err.message || '文件读取失败',
    });
  }
  break;
}

// --- watch.subscribe: 订阅文件监控 ---
case 'watch.subscribe': {
  const { path: watchPath, recursive } = payload as { path: string; recursive?: boolean };
  const manager = getRemoteConnectionManager();
  const client = manager.getActiveClient();

  if (!client || !client.isConnected()) {
    send(socket, 'error', { message: '未连接到远程服务器' });
    break;
  }

  try {
    const subscriptionId = await client.watchSubscribe(watchPath);
    // 设置事件监听，转发到前端
    const unsubscribe = client.onWatchEvent((event) => {
      send(socket, 'watch.event', event);
    });
    send(socket, 'watch.subscribed', { subscriptionId });
  } catch (err: any) {
    send(socket, 'error', { message: err.message });
  }
  break;
}

// --- watch.unsubscribe: 取消文件监控 ---
case 'watch.unsubscribe': {
  const { subscriptionId } = payload as { subscriptionId: string };
  const manager = getRemoteConnectionManager();
  const client = manager.getActiveClient();

  if (client && client.isConnected()) {
    try {
      await client.watchUnsubscribe(subscriptionId);
    } catch {}
  }
  break;
}

// ==================== 连接状态推送 ====================
// 在 RemoteConnectionManager 初始化时注册状态变更回调:

// 在 app.ts 或 websocket 初始化时:
const manager = getRemoteConnectionManager();
manager.onStatusChange((serverId, status, error) => {
  // 广播给所有已连接的 WebSocket 客户端
  broadcastToAll('remote.server.status', { id: serverId, status, error });
});

// ==================== helper 函数 ====================
// send 函数（向单个客户端发送）
function send(socket: any, type: string, payload: any) {
  if (socket.readyState === 1) { // WebSocket.OPEN
    socket.send(JSON.stringify({ type, payload }));
  }
}
