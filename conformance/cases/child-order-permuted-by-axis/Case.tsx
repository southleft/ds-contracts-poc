export default function Case({ rotation = 'none' }: { rotation?: 'none' | 'once' }) {
  const a = <span className="cf-a" key="a">A</span>;
  const b = <span className="cf-b" key="b">B</span>;
  const c = <span className="cf-c" key="c">C</span>;
  return (
    <div className="cf-root" data-cf="child-order-permuted-by-axis" data-rotation={rotation}>
      {rotation === 'once' ? [b, c, a] : [a, b, c]}
    </div>
  );
}
