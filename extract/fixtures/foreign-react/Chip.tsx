// FIXTURE: a "foreign" component written in conventions this repo does NOT
// use — type-alias props behind a local alias, memo wrapper, default params —
// to prove the extractor doesn't depend on our own generator's style.
import { memo } from 'react';

type Tone = 'neutral' | 'info' | 'success' | 'critical';

type ChipProps = {
  /** Visual tone of the chip. */
  tone?: Tone;
  size?: 'compact' | 'regular';
  /** Text shown inside the chip. */
  text: string;
  removable?: boolean;
  onRemove?: () => void;
};

export const Chip = memo(function Chip({
  tone = 'neutral',
  size = 'regular',
  text,
  removable = false,
  onRemove,
}: ChipProps) {
  return (
    <span data-tone={tone} data-size={size} data-removable={removable}>
      {text}
      {removable ? <button onClick={onRemove}>×</button> : null}
    </span>
  );
});
