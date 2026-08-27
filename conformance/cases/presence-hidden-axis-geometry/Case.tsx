export default function Case({ checked = 'unchecked' }: { checked?: 'unchecked' | 'checked' | 'indeterminate' }) {
  return (
    <div className="cf-root" data-cf="presence-hidden-axis-geometry" data-checked={checked}>
      {checked !== 'unchecked' ? <span className="cf-a" data-kind={checked} /> : null}
      <span className="cf-b">Host</span>
    </div>
  );
}
