// ════════════════════════════════════════════════════════════════════════
// SacMappingPage — renders the canonical POC ↔ SAC object-mapping
// document (SAC_MAPPING.md) as a navigable page so demo evaluators
// and bid-team members can browse it at /sac-mapping. The single
// source of truth is the markdown file; this component only styles
// the rendered output.
// ════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Button } from '@/components/ui5/Ui5Button';
import { toast } from '@/lib/toast';
// Import the markdown content as a raw string at build time.
// Vite ?raw query: https://vite.dev/guide/assets.html#importing-asset-as-string
import sacMappingSource from '/SAC_MAPPING.md?raw';

export default function SacMappingPage() {
  usePageTitle('SAC Mapping');

  // Memoise so re-renders don't re-process the markdown.
  const content = useMemo(() => sacMappingSource as string, []);

  const handleDownload = () => {
    try {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PETROS_IPS_SAC_Mapping_${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('SAC mapping document downloaded');
    } catch (e) {
      toast.error(`Download failed: ${String(e instanceof Error ? e.message : e)}`);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">POC ↔ SAC Object Mapping</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Bid-team commitment ledger: every POC concept named to its SAC delivery vehicle.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon="download"
          className="text-xs shrink-0"
          onClick={handleDownload}
          title="Download the SAC mapping document as a Markdown file for inclusion in the proposal."
        >
          Download .md
        </Button>
      </div>

      <article
        className="prose prose-sm max-w-none border border-border bg-white p-6
                   [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-text-primary [&_h1]:mt-0
                   [&_h2]:text-body [&_h2]:font-semibold [&_h2]:text-petrol [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:pb-1 [&_h2]:border-b [&_h2]:border-border
                   [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:text-text-secondary [&_h3]:mt-4 [&_h3]:mb-1
                   [&_p]:text-xs [&_p]:text-text-secondary [&_p]:leading-relaxed
                   [&_ul]:text-xs [&_ul]:text-text-secondary [&_ul]:list-disc [&_ul]:pl-5
                   [&_strong]:text-text-primary [&_strong]:font-semibold
                   [&_code]:text-caption [&_code]:font-data [&_code]:bg-content-alt [&_code]:px-1 [&_code]:rounded
                   [&_a]:text-petrol [&_a]:underline [&_a]:underline-offset-2
                   [&_hr]:border-border [&_hr]:my-4
                   [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_table]:my-3
                   [&_th]:text-left [&_th]:font-semibold [&_th]:text-text-primary [&_th]:bg-content-alt [&_th]:px-2 [&_th]:py-1.5 [&_th]:border [&_th]:border-border
                   [&_td]:text-text-secondary [&_td]:px-2 [&_td]:py-1.5 [&_td]:border [&_td]:border-border [&_td]:align-top"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </article>
    </div>
  );
}
