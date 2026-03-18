'use client';

import { useState } from 'react';
import { X, FileText, Code, Image, File, ExternalLink, Copy, Download } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { cn } from '@/lib/utils';

type TabType = 'artifacts' | 'files' | 'changes' | 'preview';

const tabs: { id: TabType; label: string }[] = [
  { id: 'artifacts', label: '产物' },
  { id: 'files', label: '全部文件' },
  { id: 'changes', label: '变更' },
  { id: 'preview', label: '预览' },
];

export function ArtifactsPanel() {
  const {
    artifactsPanelOpen,
    setArtifactsPanelOpen,
    artifacts,
    selectedArtifactId,
    setSelectedArtifactId,
  } = useChatStore();

  const [activeTab, setActiveTab] = useState<TabType>('artifacts');

  if (!artifactsPanelOpen) return null;

  const selectedArtifact = artifacts.find((a) => a.id === selectedArtifactId);

  const getArtifactIcon = (type: string) => {
    switch (type) {
      case 'code':
        return Code;
      case 'image':
        return Image;
      case 'document':
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
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <h2 className="text-sm font-medium text-neutral-200">产物面板</h2>
          <button
            onClick={() => setArtifactsPanelOpen(false)}
            className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors"
            aria-label="关闭面板"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 px-3 py-2.5 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'text-primary-400 border-b-2 border-primary-400'
                  : 'text-neutral-400 hover:text-neutral-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {artifacts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm p-4 text-center">
              <div>
                <File className="w-12 h-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
                <p>尚无产物生成</p>
                <p className="text-xs mt-1">请下达任务指令</p>
              </div>
            </div>
          ) : (
            <>
              {/* Artifact List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {artifacts.map((artifact) => {
                  const Icon = getArtifactIcon(artifact.type);
                  const isSelected = artifact.id === selectedArtifactId;

                  return (
                    <button
                      key={artifact.id}
                      onClick={() => setSelectedArtifactId(artifact.id)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg transition-colors',
                        isSelected
                          ? 'bg-primary-600/20 border border-primary-500/50'
                          : 'bg-neutral-700/50 hover:bg-neutral-700 border border-transparent'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-neutral-200">
                            {artifact.title}
                          </p>
                          <p className="text-xs text-neutral-500 mt-1">
                            {formatTime(artifact.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Preview Area */}
              {selectedArtifact && (
                <div className="h-48 border-t border-neutral-700 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral-400">预览</span>
                    <div className="flex gap-1">
                      <button
                        className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-neutral-200"
                        aria-label="复制"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-neutral-200"
                        aria-label="下载"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      <button
                        className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-neutral-200"
                        aria-label="在新窗口打开"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="h-32 bg-neutral-900 rounded-lg p-2 overflow-auto text-xs text-neutral-300 font-mono">
                    {selectedArtifact.content || '无内容预览'}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
