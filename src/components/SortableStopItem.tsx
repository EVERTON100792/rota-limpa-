import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Stop } from '../types';

interface SortableStopItemProps {
  stop: Stop;
  index: number;
  onRemove: (id: string) => void;
}

export const SortableStopItem: React.FC<SortableStopItemProps> = ({ stop, index, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group p-3 bg-zinc-950 border rounded-xl flex items-center gap-3 transition-all
        ${isDragging ? 'border-brand-blue shadow-2xl opacity-80 scale-[1.02]' : 'border-zinc-800 hover:border-zinc-700'}
      `}
    >
      <div 
        {...attributes} 
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-zinc-700 hover:text-zinc-500 transition-colors"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-zinc-800 text-zinc-400`}>
        {index + 1}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[8px] font-black bg-zinc-800 text-zinc-400 px-1 rounded uppercase">Entrega {index + 1}</span>
        </div>
        <p className="text-xs text-zinc-300 truncate font-medium">{stop.address}</p>
      </div>
      
      <button 
        onClick={() => onRemove(stop.id)}
        className="p-1.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
