export default function Case({ orientation = 'vertical' }: { orientation?: 'vertical' | 'horizontal' }) {
  return (
    <div className="cf-root" data-cf="flex-direction-by-axis" data-orientation={orientation}>
      <span className="cf-a">A</span>
      <span className="cf-b">B</span>
    </div>
  );
}
