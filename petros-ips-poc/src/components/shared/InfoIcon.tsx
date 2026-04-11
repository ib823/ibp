import { Info } from 'lucide-react';
import { Dialog, Bar, Button as Ui5Button } from '@ui5/webcomponents-react';
import type { DialogDomRef } from '@ui5/webcomponents-react';
import { useRef, useState, useEffect } from 'react';
import type { EducationalEntry } from '@/lib/educational-content';

interface InfoIconProps {
  entry: EducationalEntry;
  className?: string;
  size?: number;
}

export function InfoIcon({ entry, className, size }: InfoIconProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<DialogDomRef>(null);

  // UI5 Dialog uses `open` prop declaratively
  useEffect(() => {
    // Sync imperative state just in case a close event bypassed React state
    if (!open && dialogRef.current?.open) {
      dialogRef.current.open = false;
    }
  }, [open]);

  const content = entry.infoPanel ?? entry.sectionHelp;
  if (!content) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`More information about ${entry.label}`}
        className={`inline-flex items-center justify-center w-5 h-5 sm:w-4 sm:h-4 rounded-full text-text-muted hover:text-petrol hover:bg-petrol/10 transition-colors shrink-0 relative after:content-[''] after:absolute after:inset-0 after:-m-3 after:min-w-[44px] after:min-h-[44px] ${className ?? ''}`}
      >
        <Info size={size ?? 14} className="sm:w-3 sm:h-3" />
      </button>
      <Dialog
        ref={dialogRef}
        open={open}
        headerText={entry.label}
        onClose={() => setOpen(false)}
        footer={
          <Bar
            endContent={
              <Ui5Button design="Emphasized" onClick={() => setOpen(false)}>
                Close
              </Ui5Button>
            }
          />
        }
      >
        <div className="p-4 space-y-3 max-w-lg normal-case" style={{ textTransform: 'none' }}>
          {content.split('\n\n').map((paragraph, i) => (
            <p key={i} className="whitespace-pre-line text-sm text-text-secondary leading-relaxed normal-case">
              {paragraph}
            </p>
          ))}
          {entry.references.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-[10px] font-semibold tracking-wider text-text-muted mb-1 normal-case">
                References
              </p>
              <ul className="text-[10px] text-text-muted space-y-0.5 normal-case">
                {entry.references.map((ref, i) => (
                  <li key={i}>{ref}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
