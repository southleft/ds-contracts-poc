import React from 'react';
import {
  Badge,
  Button,
  Card,
  Inline,
  Stack,
} from 'ds-contracts-poc';

type Severity = 'info' | 'success' | 'warning';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: Severity;
}

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    title: 'New comment on your contract',
    message: 'Jordan left a note on the "Master Services Agreement" draft.',
    severity: 'info',
  },
  {
    id: 'n2',
    title: 'Contract signed',
    message: 'The "Vendor NDA" was fully executed by all parties.',
    severity: 'success',
  },
  {
    id: 'n3',
    title: 'Renewal due soon',
    message: 'The "Cloud Hosting Agreement" expires in 7 days.',
    severity: 'warning',
  },
];

const SEVERITY_TONE: Record<Severity, string> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
};

export default function NotificationCenter() {
  const [items, setItems] = React.useState<NotificationItem[]>(NOTIFICATIONS);

  const dismiss = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <section
      aria-label="Notification center"
      style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}
    >
      <Stack gap="md">
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
          Notifications
        </h2>

        {items.length === 0 ? (
          <Card>
            <p style={{ margin: 0, color: '#6b7280' }}>You're all caught up.</p>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id}>
              <Stack gap="sm">
                <Inline gap="sm" align="center" justify="between">
                  <strong style={{ fontSize: 15, fontWeight: 600 }}>
                    {item.title}
                  </strong>
                  <Badge tone={SEVERITY_TONE[item.severity]} variant={item.severity}>
                    {SEVERITY_LABEL[item.severity]}
                  </Badge>
                </Inline>

                <p style={{ margin: 0, color: '#4b5563', fontSize: 14 }}>
                  {item.message}
                </p>

                <Inline gap="sm" justify="end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismiss(item.id)}
                    aria-label={`Dismiss notification: ${item.title}`}
                  >
                    Dismiss
                  </Button>
                </Inline>
              </Stack>
            </Card>
          ))
        )}
      </Stack>
    </section>
  );
}
