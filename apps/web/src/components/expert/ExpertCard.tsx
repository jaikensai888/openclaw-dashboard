'use client';

import { User, Bot, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Expert } from '@/stores/chatStore';

interface ExpertCardProps {
  expert: Expert;
  isSelected?: boolean;
  onSummon: (expert: Expert) => void;
  onEdit?: (expert: Expert) => void;
}

export function ExpertCard({ expert, isSelected, onSummon, onEdit }: ExpertCardProps) {
  const getIcon = () => {
    switch (expert.icon) {
      case 'Bot':
        return Bot;
      default:
        return User;
    }
  };

  const Icon = getIcon();

  return (
    <div
      className={cn(
        'relative group p-4 bg-neutral-800 rounded-xl border transition-all',
        'hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/10',
        isSelected
          ? 'border-primary-500 ring-2 ring-primary-500/30'
          : 'border-neutral-700'
      )}
    >
      {/* Avatar */}
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-3 mx-auto bg-primary-600"
        style={expert.color ? { backgroundColor: expert.color } : undefined}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>

      {/* Name & Title */}
      <h3 className="text-sm font-medium text-center mb-1 text-neutral-200">
        {expert.name}
      </h3>
      <p className="text-xs text-center text-neutral-500 mb-3">
        {expert.title}
      </p>

      {/* Description (if exists) */}
      {expert.description && (
        <p className="text-xs text-center text-neutral-600 mb-3 line-clamp-2">
          {expert.description}
        </p>
      )}

      {/* Summon button - appears on hover and focus */}
      <button
        onClick={() => onSummon(expert)}
        className={cn(
          'w-full py-2 rounded-lg text-sm font-medium transition-all',
          'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
          'bg-primary-600 hover:bg-primary-700 text-white',
          'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary-500'
        )}
        aria-label={`召唤 ${expert.name}`}
      >
        立即召唤
      </button>

      {/* Default badge */}
      {expert.isDefault && (
        <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400">
          默认
        </span>
      )}

      {/* Edit button - appears on hover */}
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(expert);
          }}
          className={cn(
            'absolute top-2 left-2 p-1.5 rounded-lg transition-all',
            'opacity-0 group-hover:opacity-100',
            'bg-neutral-700 hover:bg-neutral-600 text-neutral-400 hover:text-white'
          )}
          aria-label={`编辑 ${expert.name}`}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
