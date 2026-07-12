import { Link } from '../router';
import { examples, type Example } from '../engine/examples';
import { contractsById } from '../engine/data';
import { PreviewFrame } from '../components/PreviewFrame';

function Thumb({ example }: { example: Example }) {
  if (example.kind === 'code') {
    // The code path rides the TypeScript compiler — proposal runs on demand
    // in the playground, not on gallery load. The thumbnail shows the input.
    return (
      <div className="excard__thumb excard__thumb--code" aria-hidden="true">
        {example.tsx.split('\n').slice(6, 20).join('\n')}
      </div>
    );
  }
  const contract = contractsById.get(example.contractId);
  if (!contract) return <div className="excard__thumb" />;
  return (
    <div className="excard__thumb">
      <PreviewFrame contract={contract} contracts={contractsById} title={`${example.name} preview`} />
    </div>
  );
}

export function Examples() {
  return (
    <div className="examples">
      <h1>Examples</h1>
      <p className="examples__sub">
        Every card is rendered live by the same emitter you get in the playground — pick one to
        open it there, contract and all.
      </p>
      <div className="examples__grid">
        {examples.map((e) => (
          <Link key={e.slug} to={`/playground?example=${e.slug}`} className="excard">
            <Thumb example={e} />
            <div className="excard__body">
              <div className="excard__meta">{e.category}</div>
              <div className="excard__name">{e.name}</div>
              <div className="excard__blurb">{e.blurb}</div>
              <div className="excard__caption">
                <span className="excard__caption-label">What to notice</span>
                {e.caption}
                {e.expectedRefusal ? (
                  <span
                    className="excard__flag"
                    title={e.expectedRefusal}
                  >
                    refuses on purpose
                  </span>
                ) : null}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
