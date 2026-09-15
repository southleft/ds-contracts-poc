import overview from "../../../docs/CURRENT.md?raw";
import diagram from "../../../docs/assets/product-loop.svg";
import { renderProductOverview } from "../../../product/overview";
import "../../../product/overview.css";
import { Link } from "../router";

const html = renderProductOverview(overview, diagram);

export function System() {
  return (
    <div className="product-overview">
      <nav
        className="product-overview__actions"
        aria-label="Try the current capabilities"
      >
        <Link to="/sources">Validate a source</Link>
        <Link to="/playground">Explore the contract engine</Link>
      </nav>
      <article dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
