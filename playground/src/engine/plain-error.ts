/**
 * Plain-words error formatting — the rule that raw validator/exception JSON
 * NEVER renders as a headline anywhere in the UI (owner field case: a zod
 * issue array rendered verbatim in the left rail when a CBDS plugin send
 * carried a set whose derived contract id failed the schema).
 *
 * The technical text is never discarded: it rides `detail`, which surfaces
 * render as an expandable/secondary line (ReceiptEntry.detail, the error
 * notice's <details>). Headline in words, receipt in full — same discipline
 * as every other named refusal.
 */

import { plainWordsProposalError } from '../../../core/index.js';

export interface PlainError {
  /** Human sentence — safe to render as the visible message. */
  headline: string;
  /** The verbatim technical text, when it differs from the headline. */
  detail?: string;
}

/** The formatting itself is core (plainWordsProposalError — zod issues in
 *  words, machine-looking messages demoted to detail) so CI's receipts
 *  referee the same spelling the UI shows. */
export function plainWordsError(e: unknown): PlainError {
  return plainWordsProposalError(e);
}
