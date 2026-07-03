/** Seeded violation fixture — one of every violation class the judge must
 *  catch. Never rendered; exists to prove the judge's teeth. */
import { Button, Card, Table } from 'ds-contracts-poc';

declare function DatePicker(props: Record<string, unknown>): null;

export function BadScreen() {
  return (
    <div style={{ background: '#2563EB', padding: '16px' }}>
      <Card title="Team" className="custom-card">
        Overridden card.
      </Card>
      <Card>Missing its required title.</Card>
      <DatePicker range />
      <Button variant="warning">Not a real variant</Button>
      <Button tone="danger">Unknown prop</Button>
      <Button>One primary</Button>
      <Button>Two primaries</Button>
      <button type="button">Raw button</button>
      <Table density="cozy">
        <Card title="Wrong slot content">Cards do not go in tables.</Card>
      </Table>
      <span style={{ color: 'rgb(255, 0, 0)' }}>Literal color</span>
      <span style={{ width: 'var(--not-a-real-token)' }}>Unknown token</span>
    </div>
  );
}
