import { Stack, Inline, Card, Button } from 'ds-contracts-poc';

export function PricingSection() {
  return (
    <Stack gap="lg">
      <Inline gap="lg">
        <Card
          title="Starter"
          actions={<Button variant="secondary">Get started</Button>}
        >
          Everything a solo builder needs to ship a first project, with core
          features and community support.
        </Card>
        <Card
          title="Pro"
          actions={<Button>Start free trial</Button>}
        >
          For growing teams that need advanced collaboration, higher limits, and
          priority support.
        </Card>
        <Card
          title="Enterprise"
          actions={<Button variant="secondary">Contact sales</Button>}
        >
          Custom scale, security reviews, and dedicated onboarding for large
          organizations.
        </Card>
      </Inline>
    </Stack>
  );
}
