import { useEffect, useRef } from 'react';

// A CLOSED shadow root: element.shadowRoot is null, so no walker can descend.
export default function Case() {
  const ref = useRef<HTMLSpanElement | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !ref.current) return;
    done.current = true;
    const root = ref.current.attachShadow({ mode: 'closed' });
    root.innerHTML = '<style>span{background-color:rgb(0,128,128);color:#fff;padding:4px}</style><span>Closed</span>';
  }, []);
  return (
    <div className="cf-root" data-cf="shadow-root-closed">
      <span className="cf-a" ref={ref} />
    </div>
  );
}
