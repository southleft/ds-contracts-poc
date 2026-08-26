export default function Case() {
  return (
    <div className="cf-root" data-cf="repeat-siblings-seven">
      {Array.from({ length: 6 }, (_, i) => (
        <span className="cf-a" key={i} />
      ))}
      <span className="cf-b" />
    </div>
  );
}
