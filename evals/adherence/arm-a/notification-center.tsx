import { Stack, Card, Badge, Button } from 'ds-contracts-poc';

export function NotificationCenter() {
  return (
    <Stack gap="md">
      <Card
        title="Deployment complete"
        actions={
          <>
            <Badge variant="success">success</Badge>
            <Button variant="secondary">Dismiss</Button>
          </>
        }
      >
        Version 2.4.0 is now live in production.
      </Card>

      <Card
        title="Storage nearing capacity"
        actions={
          <>
            <Badge variant="warning">warning</Badge>
            <Button variant="secondary">Dismiss</Button>
          </>
        }
      >
        You have used 92% of your available storage quota.
      </Card>

      <Card
        title="New team member added"
        actions={
          <>
            <Badge variant="info">info</Badge>
            <Button variant="secondary">Dismiss</Button>
          </>
        }
      >
        Jordan Lee has joined the Engineering workspace.
      </Card>
    </Stack>
  );
}
