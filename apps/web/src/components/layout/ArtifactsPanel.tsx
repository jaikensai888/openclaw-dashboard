'use client';

import { useState, useEffect } from 'react';
import { X, FileText, Code, Image, File, Download, Trash2, ArrowLeft, Loader2, FolderOpen } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useRemoteStore } from '@/stores/remoteStore';
import { useFileStore } from '@/stores/fileStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/api';
import { FileExplorer } from '@/components/remote/FileExplorer';
import { FilePreview } from '@/components/remote/FilePreview';

type ViewMode = 'list' | 'preview';
type TabMode = 'artifacts' | 'remote';

interface ArtifactContent {
  id: string;
  title: string;
  type: string;
  mimeType: string;
  content: string | null;
  isReference: boolean;
}

export function ArtifactsPanel() {
  const {
    artifactsPanelOpen,
    setArtifactsPanelOpen,
    artifacts,
    selectedArtifactId,
    setSelectedArtifactId,
    currentConversationId,
  } = useChatStore();

  const { activeServerId } = useRemoteStore();
  const { selectedFile, setSelectedFile, setFileContent } = useFileStore();
  const { listDirectory: wsListDirectory, readFile: wsReadFile } = useWebSocket();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [tabMode, setTabMode] = useState<TabMode>('artifacts');
  const [previewContent, setPreviewContent] = useState<ArtifactContent | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // Reset tab to artifacts when panel closes
  useEffect(() => {
    if (!artifactsPanelOpen) {
      setTabMode('artifacts');
      setViewMode('list');
    }
  }, [artifactsPanelOpen]);

  // WebSocket send wrapper for FileExplorer
  const wsSend = (type: string, payload: unknown) => {
    // Map FileExplorer actions to WebSocket messages
    if (type === 'directory:list') {
      const p = payload as { path: string };
      wsListDirectory(p.path);
    } else if (type === 'file:read') {
      const p = payload as { path: string };
      wsReadFile(p.path);
    }
  };

  // Handle file selection from FileExplorer
  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
    setViewMode('preview');
  };

  const handleFileBack = () => {
    setSelectedFile(null);
    setFileContent(null);
    setViewMode('list');
  };

  const handleFileRefresh = () => {
    if (selectedFile) {
      wsReadFile(selectedFile);
    }
  };

  // Handle artifact selection (switch to artifacts tab and preview)
  const handleSelectArtifactWithTab = (artifactId: string) => {
    setTabMode('artifacts');
    handleSelectArtifact(artifactId);
  };

  if (!artifactsPanelOpen) return null;

  // Filter artifacts for current conversation
  const currentConversationArtifacts = currentConversationId
    ? artifacts.filter((a: { conversationId: string }) => a.conversationId === currentConversationId)
    : [];
  const selectedArtifact = currentConversationArtifacts.find((a: { id: string }) => a.id === selectedArtifactId);

  const getArtifactIcon = (type: string) => {
    switch (type) {
      case 'code':
        return Code;
      case 'image':
        return Image;
      case 'document':
      case 'file':
      default:
        return FileText;
    }
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async () => {
    if (!selectedArtifact) return;
    try {
      const res = await fetch(`${API_BASE_URL}/artifacts/${selectedArtifact.id}/download`);
      if (!res.ok) throw new Error('下载失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedArtifact.title || 'artifact';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedArtifact || !confirm('确定要删除此产物吗？')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/artifacts/${selectedArtifact.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('删除失败');
      // Clear selection and go back to list
      setSelectedArtifactId(null);
      setViewMode('list');
      setPreviewContent(null);
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleSelectArtifact = async (artifactId: string) => {
    setSelectedArtifactId(artifactId);
    setViewMode('preview');
    setIsLoadingContent(true);
    setContentError(null);
    setPreviewContent(null);

    try {
      const res = await fetch(`${API_BASE_URL}/artifacts/${artifactId}/content`);
      const data = await res.json();
      if (data.success) {
        setPreviewContent(data.data);
      } else {
        setContentError(data.error || '加载失败');
      }
    } catch (error) {
      console.error('Failed to load artifact content:', error);
      setContentError('加载内容失败');
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedArtifactId(null);
    setPreviewContent(null);
    setContentError(null);
  };

  // Render preview content based on file type
  const renderPreviewContent = () => {
    if (isLoadingContent) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-4">
          <Loader2 className="w-8 h-8 mb-3 animate-spin" />
          <span className="text-sm">加载中...</span>
        </div>
      );
    }

    if (contentError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-4">
          <File className="w-12 h-12 mb-3 opacity-50" />
          <span className="text-sm text-red-400">{contentError}</span>
        </div>
      );
    }

    if (!previewContent) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-4">
          <File className="w-12 h-12 mb-3 opacity-50" />
          <span className="text-sm">无内容</span>
        </div>
      );
    }

    if (previewContent.isReference) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-4">
          <File className="w-12 h-12 mb-3 opacity-50" />
          <span className="text-sm">AI 声称已保存此文件</span>
          <span className="text-xs mt-1 text-neutral-600">（内容在 Gateway 端）</span>
        </div>
      );
    }

    if (previewContent.type === 'image') {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <img
            src={`${API_BASE_URL}/artifacts/${previewContent.id}/preview`}
            alt={previewContent.title || 'Preview'}
            className="max-w-full max-h-full object-contain rounded"
          />
        </div>
      );
    }

    if (previewContent.content) {
      // Check if it's markdown
      const isMarkdown = previewContent.title?.endsWith('.md') || previewContent.type === 'document';

      if (isMarkdown) {
        return (
          <div className="p-4 prose prose-invert prose-sm max-w-none overflow-auto h-full">
            <pre className="whitespace-pre-wrap text-sm text-neutral-300 font-mono">
              {previewContent.content}
            </pre>
          </div>
        );
      }

      // Code preview
      return (
        <div className="p-4 overflow-auto h-full">
          <pre className="text-xs text-neutral-300 font-mono whitespace-pre-wrap break-all">
            {previewContent.content}
          </pre>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-4">
        <File className="w-12 h-12 mb-3 opacity-50" />
        <span className="text-sm">无预览内容</span>
        <button
          onClick={handleDownload}
          className="mt-3 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-xs text-neutral-300 transition-colors"
        >
          下载文件
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 bg-black/30 z-40 lg:hidden"
        onClick={() => setArtifactsPanelOpen(false)}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={cn(
          'fixed lg:relative right-0 top-0 h-full bg-neutral-800 border-l border-neutral-700 z-50 flex flex-col',
          'w-80 lg:w-96',
          'transform transition-transform duration-300 ease-in-out'
        )}
        role="complementary"
        aria-label="产物面板"
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-700">
          <div className="flex items-center justify-between">
            {viewMode === 'preview' && tabMode === 'artifacts' ? (
              <>
                <button
                  onClick={handleBackToList}
                  className="flex items-center gap-1.5 text-neutral-300 hover:text-neutral-100 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">返回</span>
                </button>
                <div className="flex items-center gap-1">
                  {!selectedArtifact?.metadata?.isReference && (
                    <button
                      onClick={handleDownload}
                      className="p-1.5 hover:bg-neutral-700 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
                      aria-label="下载"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={handleDelete}
                    className="p-1.5 hover:bg-neutral-700 rounded text-neutral-400 hover:text-red-400 transition-colors"
                    aria-label="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setArtifactsPanelOpen(false)}
                    className="p-1.5 hover:bg-neutral-700 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
                    aria-label="关闭面板"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-medium text-neutral-200">产物面板</h2>
                </div>
                <button
                  onClick={() => setArtifactsPanelOpen(false)}
                  className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors flex-shrink-0 ml-2"
                  aria-label="关闭面板"
                >
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              </>
            )}
          </div>

          {/* Preview mode: show filename */}
          {viewMode === 'preview' && selectedArtifact && (
            <div className="mt-2 pt-2 border-t border-neutral-700">
              <p className="text-sm font-medium text-neutral-200 truncate">{selectedArtifact.title}</p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Tab Switcher - only in list mode */}
          {viewMode === 'list' && (
            <div className="flex border-b border-neutral-700">
              <button
                onClick={() => setTabMode('artifacts')}
                className={cn(
                  'flex-1 px-4 py-2 text-sm transition-colors',
                  tabMode === 'artifacts'
                    ? 'text-neutral-200 border-b-2 border-primary-500'
                    : 'text-neutral-500 hover:text-neutral-300'
                )}
              >
                <FileText className="w-4 h-4 inline mr-1.5" />
                本地产物
              </button>
              <button
                onClick={() => setTabMode('remote')}
                className={cn(
                  'flex-1 px-4 py-2 text-sm transition-colors',
                  tabMode === 'remote'
                    ? 'text-neutral-200 border-b-2 border-primary-500'
                    : 'text-neutral-500 hover:text-neutral-300'
                )}
              >
                <FolderOpen className="w-4 h-4 inline mr-1.5" />
                远程文件
              </button>
            </div>
          )}

          {tabMode === 'remote' && viewMode === 'list' ? (
            // Remote File Explorer
            <FileExplorer
              onFileSelect={handleFileSelect}
              wsSend={wsSend}
            />
          ) : tabMode === 'remote' && selectedFile && viewMode === 'preview' ? (
            // Remote File Preview
            <FilePreview
              filePath={selectedFile}
              onBack={handleFileBack}
              onRefresh={handleFileRefresh}
            />
          ) : viewMode === 'list' ? (
            // List view
            currentConversationArtifacts.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm p-4 text-center">
                <div>
                  <File className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
                  <p>尚无产物生成</p>
                  <p className="text-xs mt-1">AI 生成的代码将自动保存</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {currentConversationArtifacts.map((artifact) => {
                  const Icon = getArtifactIcon(artifact.type);

                  return (
                    <button
                      key={artifact.id}
                      onClick={() => handleSelectArtifact(artifact.id)}
                      className="w-full text-left p-3 rounded-lg bg-neutral-700/50 hover:bg-neutral-700 border border-transparent transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-neutral-200">
                            {artifact.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-neutral-500">
                              {formatTime(artifact.createdAt)}
                            </p>
                            {artifact.metadata?.size !== undefined && typeof artifact.metadata.size === 'number' && (
                              <p className="text-xs text-neutral-600">
                                {formatSize(artifact.metadata.size)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            // Preview view
            <div className="flex-1 overflow-hidden bg-neutral-900">
              {renderPreviewContent()}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
