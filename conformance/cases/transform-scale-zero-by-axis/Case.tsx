export default function Case({ checked = 'unchecked' }: { checked?: 'unchecked' | 'checked' }) {
  return (
    <div className="cf-root" data-cf="transform-scale-zero-by-axis" data-checked={checked}>
      <span className="cf-a" />
    </div>
  );
}
