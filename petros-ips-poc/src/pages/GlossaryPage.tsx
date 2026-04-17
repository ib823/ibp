import { useState, useEffect, useRef, useMemo } from 'react';

function resolveInitialOpenId(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.slice(1).toLowerCase();
  if (!hash) return null;
  // Use GLOSSARY_ENTRIES imported below; safe because module-scope imports
  // are hoisted before this function executes.
  return GLOSSARY_ENTRIES.find((e) => e.id === hash)?.id ?? null;
}
import { usePageTitle } from '@/hooks/usePageTitle';
import { Input } from '@/components/ui5/Ui5Input';
import { GLOSSARY_ENTRIES } from '@/data/glossary';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GlossaryPage() {
  usePageTitle('Glossary');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(() => resolveInitialOpenId());
  const entryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const sorted = useMemo(
    () => [...GLOSSARY_ENTRIES].sort((a, b) => a.term.localeCompare(b.term)),
    [],
  );

  // Rank order (best → worst): exact title, title prefix, title substring,
  // definition substring. Entries not matching any of these are filtered
  // out. Ties within a rank fall back to alphabetical.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    const scored = sorted
      .map((e) => {
        const t = e.term.toLowerCase();
        const d = e.definition.toLowerCase();
        let rank = 99;
        if (t === q) rank = 0;
        else if (t.startsWith(q)) rank = 1;
        else if (t.includes(q)) rank = 2;
        else if (d.includes(q)) rank = 3;
        return { e, rank };
      })
      .filter((x) => x.rank < 99)
      .sort((a, b) => a.rank - b.rank || a.e.term.localeCompare(b.e.term));
    return scored.map((x) => x.e);
  }, [search, sorted]);

  // Scroll to the entry that was opened from a #hash URL. The state
  // itself is initialized in useState above so this effect is
  // side-effect-only (no setState inside an effect body).
  useEffect(() => {
    if (!openId) return;
    requestAnimationFrame(() => {
      entryRefs.current[openId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    // Run once on mount — intentionally do not depend on openId so the
    // scroll only fires for the initial hash, not every subsequent
    // manual open/close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleEntry = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4 max-w-3xl w-full">
      <h1 className="text-lg font-semibold text-text-primary">Glossary</h1>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search terms..."
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Results count */}
      {search && (
        <p className="text-[10px] text-text-muted">
          {filtered.length} of {sorted.length} entries
        </p>
      )}

      {/* Entries */}
      <div className="space-y-1">
        {filtered.map((entry) => {
          const isOpen = openId === entry.id;
          return (
            <div
              key={entry.id}
              id={entry.id}
              ref={(el) => { entryRefs.current[entry.id] = el; }}
              className={cn(
                'border border-border bg-white transition-colors',
                isOpen && 'border-petrol/30',
              )}
            >
              <button
                onClick={() => toggleEntry(entry.id)}
                className="w-full flex items-start gap-2 px-4 py-3 text-left min-h-[44px]"
              >
                {isOpen ? (
                  <ChevronDown size={14} className="text-petrol mt-0.5 shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-text-muted mt-0.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-text-primary break-words">{highlightMatch(entry.term, search)}</div>
                  <div className="text-xs text-text-muted break-words mt-0.5">{highlightMatch(entry.definition, search)}</div>
                </div>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pl-10 space-y-2">
                  <p className="text-xs text-text-secondary leading-relaxed break-words">
                    {entry.explanation}
                  </p>
                  {entry.formula && (
                    <div className="bg-content-alt p-2 rounded overflow-x-auto">
                      <code className="text-xs font-data text-text-primary whitespace-nowrap">
                        {entry.formula}
                      </code>
                    </div>
                  )}
                  {entry.reference && (
                    <p className="text-xs text-text-muted break-words">
                      Ref: {entry.reference}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex items-center justify-center h-32 border border-border bg-white">
          <p className="text-sm text-text-muted">No entries matching "{search}"</p>
        </div>
      )}
    </div>
  );
}

// Highlights every case-insensitive occurrence of `query` inside `text`
// by wrapping matches in a <mark> element. Returns plain text when
// query is empty so React doesn't create unnecessary nodes.
function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark
        key={`${idx}-${needle}`}
        className="bg-amber/30 text-text-primary rounded-sm px-0.5"
      >
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    i = idx + q.length;
  }
  return parts;
}
