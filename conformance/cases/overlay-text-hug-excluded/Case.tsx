export default function Case({ size = 'default' }: { size?: 'default' | 'lg' }) {
  return (
    <div className="cf-root" data-cf="overlay-text-hug-excluded" data-size={size}>
      <span className="cf-a" />
      <span className="cf-b">Sample</span>
    </div>
  );
}
