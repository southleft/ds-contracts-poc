export default function Case({ gutters = 'wide' }: { gutters?: 'wide' | 'none' }) {
  return (
    <div className="cf-root" data-cf="overlay-text-fill-stage-derived" data-gutters={gutters}>
      <span className="cf-a" />
      <span className="cf-b">Sample</span>
    </div>
  );
}
