/**
 * Eval fixture — A ROLLUP-ONLY PACKAGE (Fluent 2 recon §2.6 / H10).
 *
 * Synthesized in the exact shape api-extractor publishes and that measurement
 * found across all 65 `@fluentui/react-*` packages: 0 `.tsx`, 0 non-`.d.ts`
 * `.ts`, one ambient-declaration rollup carrying the whole API surface.
 *
 * The react-tsx walker skips `*.d.ts` BY NAME, so pointing `code.root` here
 * opens nothing at all. Before the fix that produced
 * `No components found — check code.root …`: a refusal naming nothing, which
 * blamed the config for a fact about the package and read byte-identically to
 * an empty directory. This fixture pins the NAMED refusal instead.
 */
import * as React from 'react';

export declare type WidgetSize = 'small' | 'medium' | 'large';

export declare interface WidgetProps {
    /**
     * Visual weight of the widget.
     * @default 'secondary'
     */
    appearance?: 'primary' | 'secondary';
    /**
     * A Widget can be one of several preset sizes.
     * @defaultvalue medium
     */
    size?: WidgetSize;
    disabled?: boolean;
}

export declare const Widget: React.ForwardRefExoticComponent<WidgetProps>;

export declare interface PanelProps {
    tone?: 'neutral' | 'critical';
}

export declare const Panel: React.ForwardRefExoticComponent<PanelProps>;
