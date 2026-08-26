export default function Case() {
  return (
    <div className="cf-root" data-cf="repeat-grid-month">
      {Array.from({ length: 34 }, (_, i) => (
        <span className="cf-a" key={i} />
      ))}
      <span className="cf-b" />
    </div>
  );
}
