export default function Case() {
  return (
    <div className="cf-root" data-cf="table-zebra-nth-child">
      {Array.from({ length: 6 }, (_, i) => (
        <div className="cf-a" key={i}>
          <span>Row</span>
        </div>
      ))}
    </div>
  );
}
