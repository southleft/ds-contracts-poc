export default function Case({ align = 'end' }: { align?: 'end' | 'start' }) {
  return (
    <div className="cf-root" data-cf="flex-direction-reverse-by-axis" data-align={align}>
      <span className="cf-a">A</span>
      <span className="cf-b">B</span>
    </div>
  );
}
