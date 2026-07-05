// FIXTURE: plain function declaration + interface with a non-Props name +
// legacy defaultProps — another convention cluster foreign to this repo.
interface AlertOwnProps {
  severity?: 'info' | 'warning' | 'danger';
  heading: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function Alert({ severity, heading, dismissible, onDismiss }: AlertOwnProps) {
  return (
    <div role={severity === 'danger' ? 'alert' : 'status'} data-severity={severity}>
      <strong>{heading}</strong>
      {dismissible ? <button onClick={onDismiss}>Dismiss</button> : null}
    </div>
  );
}

Alert.defaultProps = { severity: 'info', dismissible: false };
