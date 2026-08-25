export default function Case({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return <button className="cf-root" type="button" data-cf="focus-border-color-zero-width" data-size={size} />;
}
