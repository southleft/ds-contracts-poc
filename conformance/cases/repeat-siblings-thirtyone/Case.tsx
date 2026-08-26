export default function Case() {
  return (
    <div className="cf-root" data-cf="repeat-siblings-thirtyone">
      {Array.from({ length: 30 }, (_, i) => (
        <span className="cf-a" key={i} />
      ))}
      <span className="cf-b" />
    </div>
  );
}
