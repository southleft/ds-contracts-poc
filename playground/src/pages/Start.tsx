import guide from "../../../docs/USER-JOURNEYS.md?raw";
import { renderJourneyGuide } from "../../../product/journeys";
import "../../../product/overview.css";

const html = renderJourneyGuide(guide, "app");
export function Start() {
  return (
    <div className="product-overview">
      <article dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
