'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useRemoteStore, type RemoteServer } from '@/stores/remoteStore';
import { cn } from '@/lib/utils';

interface ServerFormProps {
  server?: RemoteServer | null;
  onClose: () => void;
}

interface FormData {
  name: string;
  host: string;
  port: number;
  username: string;
  privateKeyPath: string;
  remotePort: number;
}

interface FormErrors {
  name?: string;
  host?: string;
  port?: string;
  username?: string;
  privateKeyPath?: string;
  remotePort?: string;
}

export function ServerForm({ server, onClose }: ServerFormProps) {
  const { addServer, updateServer } = useRemoteStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState<FormData>({
    name: server?.name || '',
    host: server?.host || '',
    port: server?.port || 22,
    username: server?.username || '',
    privateKeyPath: server?.privateKeyPath || '',
    remotePort: server?.remotePort || 3001,
  });

  const isEditing = !!server;

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = '请输入服务器名称';
    }
    if (!formData.host.trim()) {
      newErrors.host = '请输入主机地址';
    }
    if (!formData.username.trim()) {
      newErrors.username = '请输入用户名';
    }
    if (formData.port < 1 || formData.port > 65535) {
      newErrors.port = '端口号必须在 1-65535 之间';
    }
    if (formData.remotePort < 1 || formData.remotePort > 65535) {
      newErrors.remotePort = '远程端口必须在 1-65535 之间';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (isEditing && server) {
        await updateServer(server.id, formData);
      } else {
        await addServer(formData);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save server:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-neutral-800 border border-neutral-700 rounded-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <h3 className="text-lg font-medium text-neutral-100">
            {isEditing ? '编辑服务器' : '添加服务器'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Server Name */}
          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">
              服务器名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="例如：北京生产环境"
              className={cn(
                'w-full bg-neutral-900 border rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
                errors.name ? 'border-red-500' : 'border-neutral-700'
              )}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Host and Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm text-neutral-300 mb-1.5">
                主机地址 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.host}
                onChange={(e) => handleChange('host', e.target.value)}
                placeholder="192.168.1.100"
                className={cn(
                  'w-full bg-neutral-900 border rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
                  errors.host ? 'border-red-500' : 'border-neutral-700'
                )}
              />
              {errors.host && (
                <p className="mt-1 text-xs text-red-400">{errors.host}</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-neutral-300 mb-1.5">
                SSH 端口
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => handleChange('port', parseInt(e.target.value) || 22)}
                min={1}
                max={65535}
                className={cn(
                  'w-full bg-neutral-900 border rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500',
                  errors.port ? 'border-red-500' : 'border-neutral-700'
                )}
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">
              用户名 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => handleChange('username', e.target.value)}
              placeholder="openclaw"
              className={cn(
                'w-full bg-neutral-900 border rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
                errors.username ? 'border-red-500' : 'border-neutral-700'
              )}
            />
            {errors.username && (
              <p className="mt-1 text-xs text-red-400">{errors.username}</p>
            )}
          </div>

          {/* Private Key Path */}
          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">
              私钥路径
            </label>
            <input
              type="text"
              value={formData.privateKeyPath}
              onChange={(e) => handleChange('privateKeyPath', e.target.value)}
              placeholder="~/.ssh/id_rsa（可选）"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-neutral-500">
              留空则使用默认 SSH 密钥
            </p>
          </div>

          {/* Remote Port */}
          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">
              远程服务端口
            </label>
            <input
              type="number"
              value={formData.remotePort}
              onChange={(e) => handleChange('remotePort', parseInt(e.target.value) || 3001)}
              min={1}
              max={65535}
              className={cn(
                'w-full bg-neutral-900 border rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500',
                errors.remotePort ? 'border-red-500' : 'border-neutral-700'
              )}
            />
            {errors.remotePort && (
              <p className="mt-1 text-xs text-red-400">{errors.remotePort}</p>
            )}
            <p className="mt-1 text-xs text-neutral-500">
              dashboard-remote-server 监听的端口
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                isSubmitting
                  ? 'bg-neutral-600 text-neutral-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
              )}
            >
              {isSubmitting ? '保存中...' : isEditing ? '保存' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
