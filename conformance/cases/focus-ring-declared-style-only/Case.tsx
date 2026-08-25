export default function Case({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <a className="cf-root" data-cf="focus-ring-declared-style-only" data-size={size} href="#focus-ring-declared-style-only">Sample</a>
  );
}
