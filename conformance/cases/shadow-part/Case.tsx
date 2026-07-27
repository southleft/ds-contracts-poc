import { useEffect, useRef } from 'react';

// An OPEN shadow root exposing a part the page restyles with ::part().
export default function Case() {
  const ref = useRef<HTMLSpanElement | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !ref.current) return;
    done.current = true;
    const root = ref.current.attachShadow({ mode: 'open' });
    root.innerHTML = '<span part="label">Part</span>';
  }, []);
  return (
    <div className="cf-root" data-cf="shadow-part">
      <span className="cf-a" ref={ref} />
    </div>
  );
}
