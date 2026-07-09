import { useEffect, useState } from 'react';
import type { Contract } from '../../../core/index.js';
import {
  fetchFigmaRender,
  figmaSessionToken,
  type FigmaRenderResult,
} from '../engine/figma-render';
import { InfoPopover } from './InfoPopover';

/**
 * GROUND TRUTH — Figma's OWN render of the imported node, beside the
 * compiled canvas. The anchor (fileKey/nodeId) rides the contract itself
 * (anchors.figma, written at proposal time); the token is the session-only
 * one the Figma tab's import used. Every non-fetch state explains itself:
 * no anchor, no token, rate limit, node gone — named, never silent.
 */

type PanelState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'ok'; url: string; note: string | null }
  | { kind: 'error'; error: string };

export function FigmaGroundTruth({ contract }: { contract: Contract }) {
  const anchor = contract.anchors?.figma;
  const fileKey = anchor?.fileKey ?? null;
  const nodeId = anchor?.nodeId ?? null;
  const token = figmaSessionToken();
  const fetchable = Boolean(fileKey && nodeId && token);

  const [state, setState] = useState<PanelState>({ kind: 'idle' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!fileKey || !nodeId || !token) {
      setState({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'busy' });
    void fetchFigmaRender(fileKey, nodeId, token).then((r: FigmaRenderResult) => {
      if (cancelled) return;
      setState(r.ok ? { kind: 'ok', url: r.url, note: r.note } : { kind: 'error', error: r.error });
    });
    return () => {
      cancelled = true;
    };
  }, [fileKey, nodeId, token, attempt]);

  return (
    <>
      <div className="preview__cap">
        <span>Figma’s own render</span>
        <InfoPopover title="About this panel — the Figma images API">
          <p>
            <strong>Ground truth, not a compile.</strong> The canvas beside this is compiled from
            the contract; this panel is the PNG Figma itself draws for the imported node —
            GET /v1/images/:fileKey (PNG, @2x), using the contract’s own anchor
            (anchors.figma.fileKey · nodeId) and the session token the import used.
          </p>
          <p>
            The token is session-only — sent to api.figma.com and nowhere else, never stored, gone
            on reload. The API answers with a short-lived S3 URL; the image loads as a plain
            &lt;img&gt;. Rate limits are named (HTTP 429 — wait a minute and retry).
          </p>
        </InfoPopover>
      </div>
      <div className="gt__body">
        {!fileKey || !nodeId ? (
          <p className="gt__msg">
            No Figma source on this contract — it was not imported from a Figma node
            (anchors.figma is empty), so there is no ground truth to fetch. Generate one via the
            validation loop: paste the Figma script tab’s output into a file, then import that
            node back here.
          </p>
        ) : !token ? (
          <p className="gt__msg">
            This contract knows its Figma source ({fileKey} · {nodeId}), but the session token is
            gone — tokens are session-only, never stored. Re-import to fetch ground truth.
          </p>
        ) : state.kind === 'busy' ? (
          <p className="gt__msg">Asking Figma for the node render (images API, PNG @2x)…</p>
        ) : state.kind === 'error' ? (
          <div className="gt__msg gt__msg--error">
            {state.error}
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={() => setAttempt((n) => n + 1)}>
                Retry
              </button>
            </div>
          </div>
        ) : state.kind === 'ok' ? (
          <figure className="gt__figure">
            <img
              src={state.url}
              alt={`Figma's own render of ${contract.name} (node ${nodeId})`}
            />
            {state.note ? <figcaption className="gt__note">{state.note}</figcaption> : null}
          </figure>
        ) : fetchable ? null : (
          <p className="gt__msg">Nothing to fetch yet.</p>
        )}
      </div>
    </>
  );
}
