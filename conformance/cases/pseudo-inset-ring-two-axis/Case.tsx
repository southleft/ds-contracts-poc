export default function Case({ appearance = 'filled', tone = 'brand' }: { appearance?: 'filled' | 'outline' | 'tint'; tone?: 'brand' | 'danger' }) {
  return (
    <div className="cf-root" data-cf="pseudo-inset-ring-two-axis" data-appearance={appearance} data-tone={tone}>
      <span className="cf-a">Badge</span>
    </div>
  );
}
