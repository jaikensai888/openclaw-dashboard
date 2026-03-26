'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useRemoteStore, RemoteServer } from '@/stores/remoteStore';
import { cn } from '@/lib/utils';

interface ServerFormProps {
  server: RemoteServer | null;
  onClose: () => void;
}

interface FormData {
  name: string;
  host: string;
  port: string;
  username: string;
  privateKeyPath: string;
  remotePort: string;
}

interface FormErrors {
  name?: string;
  host?: string;
  port?: string;
  username?: string;
  remotePort?: string;
}

export function ServerForm({ server, onClose }: ServerFormProps) {
  const { addServer, updateServer } = useRemoteStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    host: '',
    port: '22',
    username: '',
    privateKeyPath: '',
    remotePort: '8765',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // Initialize form with server data if editing
  useEffect(() => {
    if (server) {
      setFormData({
        name: server.name,
        host: server.host,
        port: String(server.port),
        username: server.username,
        privateKeyPath: server.privateKeyPath || '',
        remotePort: String(server.remotePort),
      });
    }
  }, [server]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = '请输入服务器名称';
    }

    if (!formData.host.trim()) {
      newErrors.host = '请输入主机地址';
    }

    const port = parseInt(formData.port, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      newErrors.port = '请输入有效的端口号 (1-65535)';
    }

    if (!formData.username.trim()) {
      newErrors.username = '请输入用户名';
    }

    const remotePort = parseInt(formData.remotePort, 10);
    if (isNaN(remotePort) || remotePort < 1 || remotePort > 65535) {
      newErrors.remotePort = '请输入有效的端口号 (1-65535)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const config = {
        name: formData.name.trim(),
        host: formData.host.trim(),
        port: parseInt(formData.port, 10),
        username: formData.username.trim(),
        privateKeyPath: formData.privateKeyPath.trim() || undefined,
        remotePort: parseInt(formData.remotePort, 10),
      };

      if (server) {
        await updateServer(server.id, config);
      } else {
        await addServer(config);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save server:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-neutral-800 rounded-lg border border-neutral-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <h3 className="text-lg font-semibold">
            {server ? '编辑服务器' : '添加服务器'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Server Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              服务器名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="例如: 生产服务器"
              className={cn(
                'w-full bg-neutral-900 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
                errors.name ? 'border-red-500' : 'border-neutral-700'
              )}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Host */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              主机地址 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.host}
              onChange={(e) => handleChange('host', e.target.value)}
              placeholder="例如: 192.168.1.100 或 example.com"
              className={cn(
                'w-full bg-neutral-900 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
                errors.host ? 'border-red-500' : 'border-neutral-700'
              )}
            />
            {errors.host && (
              <p className="mt-1 text-xs text-red-400">{errors.host}</p>
            )}
          </div>

          {/* SSH Port */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              SSH 端口 <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={formData.port}
              onChange={(e) => handleChange('port', e.target.value)}
              placeholder="22"
              min={1}
              max={65535}
              className={cn(
                'w-full bg-neutral-900 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
                errors.port ? 'border-red-500' : 'border-neutral-700'
              )}
            />
            {errors.port && (
              <p className="mt-1 text-xs text-red-400">{errors.port}</p>
            )}
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              用户名 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => handleChange('username', e.target.value)}
              placeholder="例如: root"
              className={cn(
                'w-full bg-neutral-900 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
                errors.username ? 'border-red-500' : 'border-neutral-700'
              )}
            />
            {errors.username && (
              <p className="mt-1 text-xs text-red-400">{errors.username}</p>
            )}
          </div>

          {/* Private Key Path */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              私钥路径 <span className="text-neutral-500">(可选)</span>
            </label>
            <input
              type="text"
              value={formData.privateKeyPath}
              onChange={(e) => handleChange('privateKeyPath', e.target.value)}
              placeholder="例如: ~/.ssh/id_rsa"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-neutral-500">
              留空则使用默认密钥或密码认证
            </p>
          </div>

          {/* Remote Port */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              远程服务端口 <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={formData.remotePort}
              onChange={(e) => handleChange('remotePort', e.target.value)}
              placeholder="8765"
              min={1}
              max={65535}
              className={cn(
                'w-full bg-neutral-900 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
                errors.remotePort ? 'border-red-500' : 'border-neutral-700'
              )}
            />
            {errors.remotePort && (
              <p className="mt-1 text-xs text-red-400">{errors.remotePort}</p>
            )}
            <p className="mt-1 text-xs text-neutral-500">
              远程服务器上 OpenClaw Agent 的监听端口
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-300 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm font-medium transition-colors',
                isSubmitting && 'opacity-60 cursor-not-allowed'
              )}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {server ? '保存' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
