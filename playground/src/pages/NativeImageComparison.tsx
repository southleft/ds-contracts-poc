import { useEffect, useState } from "react";
import type { SourceFrame } from "../../../source-reference/source-framing";

/** Diagnostic images share an explicit pixel scale, never independent fit-to-width. */
export function NativeImageComparison({
  caseId,
  sourceUrl,
  nativeUrl,
  width,
  height,
}: {
  caseId: string;
  sourceUrl: string | null;
  nativeUrl: string;
  width: number;
  height: number;
}) {
  const [run, story] = caseId.split(":");
  const endpoint = `/api/source-reference/${run}/${story}/framing`;
  const [open, setOpen] = useState(false);
  const [frame, setFrame] = useState<SourceFrame | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scale, setScale] = useState(2);
  const [imageError, setImageError] = useState(false);
  const expectedHash = sourceUrl
    ? new URL(sourceUrl, "http://local.invalid").searchParams.get("sha256")
    : null;
  const validFrame = frame?.sourceSha256 === expectedHash ? frame : null;
  useEffect(() => {
    if (!open || !sourceUrl) return;
    let alive = true;
    setBusy(true);
    void fetch(endpoint)
      .then(async (response) => {
        if (!response.ok)
          throw Error(
            "Saved framing is unavailable. The original evidence may have changed.",
          );
        return response.json();
      })
      .then((data) => {
        if (data.frame && data.frame.sourceSha256 !== expectedHash)
          throw Error("Source changed. Refresh before comparing.");
        if (alive) {
          setFrame(data.frame);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) {
          setFrame(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [open, sourceUrl, endpoint, expectedHash]);
  async function prepare() {
    setBusy(true);
    setError("");
    setImageError(false);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error ?? "Source framing unavailable.");
      if (result.frame?.sourceSha256 !== expectedHash)
        throw Error("Source changed. Refresh before comparing.");
      setFrame(result.frame);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Source framing unavailable.");
    } finally {
      setBusy(false);
    }
  }
  const framedUrl = validFrame
    ? `${endpoint}/${validFrame.imageSha256}.png`
    : null;
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        {story || caseId} · {width} × {height} native pixels
      </summary>
      {open && (
        <>
          {sourceUrl && !validFrame && (
            <p>
              <button disabled={busy} onClick={() => void prepare()}>
                {busy ? "Checking original…" : "Frame original for comparison"}
              </button>{" "}
              Measure the archived original without changing it or creating
              another Figma candidate.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          {validFrame && (
            <>
              <label className="native-comparison-scale">
                Image scale{" "}
                <select
                  value={scale}
                  onChange={(event) => setScale(Number(event.target.value))}
                >
                  <option value={1}>1× — actual pixels</option>
                  <option value={2}>2×</option>
                  <option value={4}>4×</option>
                </select>
              </label>
              <p>
                Source bounds: {validFrame.bounds.width} ×{" "}
                {validFrame.bounds.height} CSS pixels. Native export: {width} ×{" "}
                {height} pixels. Both images use {scale}× scale; neither is
                resized to match the other.
              </p>
            </>
          )}
          <div
            className={`native-image-pair${validFrame ? " native-image-pair-framed" : ""}`}
          >
            <figure>
              <figcaption>
                {validFrame
                  ? "Original · measured crop"
                  : "Recorded source · full page"}
              </figcaption>
              {sourceUrl ? (
                <>
                  <a
                    href={framedUrl ?? sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={framedUrl ?? sourceUrl}
                      alt={`Recorded source: ${story}`}
                      onError={() => setImageError(true)}
                      style={
                        validFrame
                          ? {
                              width: validFrame.crop.width * scale,
                              height: validFrame.crop.height * scale,
                            }
                          : undefined
                      }
                    />
                  </a>
                  {validFrame && (
                    <p>
                      <a href={sourceUrl} target="_blank" rel="noreferrer">
                        Open full original
                      </a>{" "}
                      · crop {validFrame.crop.width} × {validFrame.crop.height}{" "}
                      pixels
                    </p>
                  )}
                </>
              ) : (
                <p>
                  Matching current source evidence is unavailable. The native
                  export is retained for inspection.
                </p>
              )}
            </figure>
            <figure>
              <figcaption>Native instance · unqualified</figcaption>
              <div
                className={validFrame ? "native-comparison-surface" : undefined}
                style={validFrame ? { padding: 8 * scale } : undefined}
              >
                <a href={nativeUrl} target="_blank" rel="noreferrer">
                  <img
                    src={nativeUrl}
                    alt={`Native comparison instance: ${story || caseId}`}
                    onError={() => setImageError(true)}
                    style={
                      validFrame
                        ? { width: width * scale, height: height * scale }
                        : undefined
                    }
                  />
                </a>
              </div>
            </figure>
          </div>
          {imageError && (
            <p role="alert">
              A comparison image is unavailable. Refresh to load current
              evidence; do not assess a missing image.
            </p>
          )}
          {validFrame && (
            <p className="source-note">
              The crop encloses fractional bounds and up to eight original
              pixels of surrounding context. Shadows or overflow beyond that
              margin require the full original. Native transparency uses a
              checkerboard; its background has not been matched to the source.
              Raster rounding and subpixel placement can differ. This is visual
              review, not a pixel score or a fidelity pass.
            </p>
          )}
        </>
      )}
    </details>
  );
}
