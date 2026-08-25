export default function Case({ appearance = 'outline', tone = 'brand', size = 'small' }: { appearance?: 'outline' | 'tint'; tone?: 'brand' | 'danger'; size?: 'small' | 'large' }) {
  return (
    <div className="cf-root" data-cf="pseudo-inset-ring-partial-presence" data-appearance={appearance} data-tone={tone} data-size={size}>
      <span className="cf-a">Badge</span>
    </div>
  );
}
