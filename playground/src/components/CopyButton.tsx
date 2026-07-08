import { useEffect, useRef, useState } from 'react';

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied — nothing to fall back to in a sandboxed page */
    }
  };
  return (
    <button type="button" className={`btn--small ${className ?? ''}`} onClick={onCopy}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
