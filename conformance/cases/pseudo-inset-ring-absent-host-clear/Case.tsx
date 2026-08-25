export default function Case({ appearance = 'outline', tone = 'brand' }: { appearance?: 'outline' | 'tint' | 'ghost'; tone?: 'brand' | 'danger' }) {
  return (
    <div className="cf-root" data-cf="pseudo-inset-ring-absent-host-clear" data-appearance={appearance} data-tone={tone}>
      <span className="cf-a">Badge</span>
    </div>
  );
}
