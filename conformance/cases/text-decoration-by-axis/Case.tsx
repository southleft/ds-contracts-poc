export default function Case({ underline = 'none' }: { underline?: 'none' | 'always' }) {
  return (
    <a className="cf-root" data-cf="text-decoration-by-axis" data-underline={underline} href="#cf-link">
      Link
    </a>
  );
}
