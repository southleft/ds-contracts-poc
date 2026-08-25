export default function Case({ labelPosition = 'after' }: { labelPosition?: 'after' | 'before' }) {
  const indicator = <span className="cf-a" key="i">I</span>;
  const label = <span className="cf-b" key="l">L</span>;
  return (
    <div className="cf-root" data-cf="child-order-reversed-by-axis" data-label-position={labelPosition}>
      {labelPosition === 'before' ? [label, indicator] : [indicator, label]}
    </div>
  );
}
