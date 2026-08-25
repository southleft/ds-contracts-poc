export default function Case({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <button className="cf-root" data-cf="focus-ring-reservation-transparent" data-size={size} type="button">Sample</button>
  );
}
