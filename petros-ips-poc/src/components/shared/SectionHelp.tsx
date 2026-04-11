import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { EducationalEntry } from '@/lib/educational-content';

interface SectionHelpProps {
  entry: EducationalEntry;
}

export function SectionHelp({ entry }: SectionHelpProps) {
  const [open, setOpen] = useState(false);

  if (!entry.sectionHelp) return null;

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-text-muted hover:text-petrol transition-colors py-2 min-h-[44px] sm:min-h-0 sm:py-1"
      >
        <HelpCircle size={12} />
        <span>{open ? 'Hide' : 'What is this?'}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="mt-2 p-3 bg-content-alt/50 border border-border/50 text-[11px] text-text-secondary leading-relaxed space-y-2">
          {entry.sectionHelp.split('\n\n').map((paragraph, i) => (
            <p key={i} className="whitespace-pre-line">{paragraph}</p>
          ))}
          {entry.references.length > 0 && (
            <p className="text-[9px] text-text-muted mt-2">
              Ref: {entry.references.join('; ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
