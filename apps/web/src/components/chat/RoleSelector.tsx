'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Bot, User, ExternalLink } from 'lucide-react';
import { useChatStore, type Expert } from '@/stores/chatStore';
import { cn } from '@/lib/utils';

export function RoleSelector() {
  const { experts, currentExpertId, setCurrentExpertId, setCurrentView } = useChatStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Get current expert
  const currentExpert = experts.find((e) => e.id === currentExpertId) || experts.find((e) => e.isDefault);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelectExpert = (expert: Expert) => {
    setCurrentExpertId(expert.id);
    setIsOpen(false);
  };

  const handleViewAllExperts = () => {
    setCurrentView('expert');
    setIsOpen(false);
  };

  const getIcon = (expert: Expert) => {
    return expert.icon === 'Bot' ? Bot : User;
  };

  const Icon = currentExpert ? getIcon(currentExpert) : Bot;

  // Show top 4 experts + "view all" option
  const visibleExperts = experts.slice(0, 4);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-l-lg',
          'bg-neutral-800 border border-r-0 border-neutral-700',
          'text-sm hover:bg-neutral-700 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary-500'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="选择角色"
      >
        <Icon className="w-4 h-4 text-primary-400" />
        <span className="text-neutral-300">{currentExpert?.name || '选择角色'}</span>
        <ChevronDown className={cn('w-3 h-3 text-neutral-500 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 w-56 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-50"
          role="listbox"
          aria-label="角色列表"
        >
          {/* Expert options */}
          <div className="py-1 max-h-64 overflow-y-auto">
            {visibleExperts.map((expert) => {
              const ExpertIcon = getIcon(expert);
              const isSelected = expert.id === currentExpertId;

              return (
                <button
                  key={expert.id}
                  onClick={() => handleSelectExpert(expert)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    isSelected
                      ? 'bg-primary-600/20 text-primary-400'
                      : 'hover:bg-neutral-700 text-neutral-300'
                  )}
                  role="option"
                  aria-selected={isSelected}
                >
                  <ExpertIcon className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{expert.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{expert.title}</p>
                  </div>
                  {expert.isDefault && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-500">默认</span>
                  )}
                  {isSelected && (
                    <span className="text-primary-400">✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider + View all link */}
          {experts.length > 4 && (
            <>
              <div className="border-t border-neutral-700" />
              <button
                onClick={handleViewAllExperts}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="text-sm">查看全部专家...</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
