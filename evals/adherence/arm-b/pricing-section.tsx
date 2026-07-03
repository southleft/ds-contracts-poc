import {
  Badge,
  Button,
  Card,
  Inline,
  Stack,
} from 'ds-contracts-poc';

interface Plan {
  name: string;
  price: string;
  cadence: string;
  description: string;
  cta: string;
  featured?: boolean;
}

const plans: Plan[] = [
  {
    name: 'Starter',
    price: '$0',
    cadence: '/mo',
    description:
      'Everything you need to get up and running. Perfect for individuals and small side projects exploring the basics.',
    cta: 'Get started',
  },
  {
    name: 'Pro',
    price: '$29',
    cadence: '/mo',
    description:
      'Advanced tooling, higher limits, and priority support for growing teams that ship every day.',
    cta: 'Start free trial',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: '',
    description:
      'Dedicated infrastructure, SSO, and a hands-on success team for organizations operating at scale.',
    cta: 'Contact sales',
  },
];

export default function PricingSection() {
  return (
    <section
      style={{
        padding: '64px 24px',
        maxWidth: 1080,
        margin: '0 auto',
      }}
    >
      <Stack gap="large" align="center">
        <Stack gap="small" align="center">
          <h2
            style={{
              fontSize: 32,
              fontWeight: 700,
              margin: 0,
              textAlign: 'center',
            }}
          >
            Simple, transparent pricing
          </h2>
          <p
            style={{
              fontSize: 16,
              color: '#6b7280',
              margin: 0,
              textAlign: 'center',
              maxWidth: 520,
            }}
          >
            Choose the plan that fits your team. Upgrade, downgrade, or cancel
            anytime.
          </p>
        </Stack>

        <Inline gap="large" align="stretch">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              style={{
                flex: 1,
                minWidth: 260,
                display: 'flex',
                flexDirection: 'column',
                padding: 28,
                border: plan.featured
                  ? '2px solid #4f46e5'
                  : '1px solid #e5e7eb',
                boxShadow: plan.featured
                  ? '0 12px 32px rgba(79, 70, 229, 0.18)'
                  : '0 2px 8px rgba(0, 0, 0, 0.05)',
              }}
            >
              <Stack gap="medium">
                <Inline gap="small" align="center">
                  <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
                    {plan.name}
                  </h3>
                  {plan.featured && (
                    <Badge variant="primary">Most popular</Badge>
                  )}
                </Inline>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 36, fontWeight: 800 }}>
                    {plan.price}
                  </span>
                  {plan.cadence && (
                    <span style={{ fontSize: 15, color: '#6b7280' }}>
                      {plan.cadence}
                    </span>
                  )}
                </div>

                <p
                  style={{
                    fontSize: 15,
                    lineHeight: 1.5,
                    color: '#4b5563',
                    margin: 0,
                    flex: 1,
                  }}
                >
                  {plan.description}
                </p>

                <Button
                  variant={plan.featured ? 'primary' : 'secondary'}
                  fullWidth
                >
                  {plan.cta}
                </Button>
              </Stack>
            </Card>
          ))}
        </Inline>
      </Stack>
    </section>
  );
}
