import path from "node:path";
import type { SourceProfile } from "./check.js";
import { reactReferenceCases } from "./react-reference-cases.js";
import type { ReactReference } from "./react-reference.js";

/** Independent source witnesses, frozen before qualification. Values come from
 * src/index.css (:root tokens), authored component utility classes, their
 * prebuilt tailwind.css rules, and the font's name ID 1 (Inter). They are not
 * sampled from converter output. A changed source requires renewed witnesses. */
export const reactWitnessFiles: Record<string, string> = {
  "src/components/ui/button.tsx":
    "972808a00bd6fe16935206ec74197f724a31375731737d19694bbb3b6f265050",
  "src/components/ui/checkbox.tsx":
    "2f5f0c90bce6753d7ba68534c006419be0f05758b913f0ea4c41c380a5cf6366",
  "src/components/ui/card.tsx":
    "3a84e2190990034c3e0c21dc432e7e978cfd62648e1c7af8e1fe8f103ac8ea7b",
  "src/index.css":
    "5ad8b87c7bcaf1f71a9a751563648be6f85ba6dccb6071274781231fa5fd1d73",
  "tailwind.css":
    "a94ce9d642a66e0dca12548f4e6d52eed7289c3fd7d88073e6942928c270401d",
  "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2":
    "3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62",
};
export function reactWitnessesMatch(reference: ReactReference) {
  const roots = Object.keys(reference.files)
    .filter((f) => f.endsWith("/src/index.css"))
    .map((f) => f.slice(0, -"/src/index.css".length));
  return (
    roots.length === 1 &&
    Object.keys(reference.cohort.witnessFiles).length > 0 &&
    Object.entries(reference.cohort.witnessFiles).every(
      ([file, hash]) => reference.files[path.join(roots[0], file)] === hash,
    )
  );
}
/** The built-in cohort's witnesses. Readers take a profile from the cohort of
 * the reference they read, never from this function directly. */
export function reactReferenceProfile(id: string): SourceProfile {
  const selected = reactReferenceCases.find((c) => c.id === id);
  if (!selected) throw Error("react-reference-case-unknown");
  return reactReferenceProfileFor(selected);
}
export function reactReferenceProfileFor(selected: {
  id: string;
  subject: string;
}): SourceProfile {
  const id = selected.id;
  const base = {
    id,
    provenance:
      "react-reference-profiles.ts: pinned authored modules, src/index.css, tailwind.css and Inter font metadata",
    fontFamily: "Inter",
    requiredTokens: {
      "--primary": "oklch(0.205 0 0)",
      "--input": "oklch(0.922 0 0)",
      "--card": "oklch(1 0 0)",
      "--radius": "0.625rem",
    },
  };
  if (selected.subject === "Button")
    return {
      ...base,
      path: ['[data-slot="button"]'],
      requiredStyles: {
        display: "inline-flex",
        height: "36px",
        "border-radius": "8px",
        "font-size": "14px",
        "font-weight": "500",
        opacity: id === "button-disabled" ? "0.5" : "1",
        "background-color":
          id === "button-secondary" ? "oklch(0.97 0 0)" : "oklch(0.205 0 0)",
      },
      probes: {
        state: {
          path: ['[data-slot="button"]'],
          properties: { disabled: id === "button-disabled" },
        },
        ...(id === "button-icon"
          ? {
              icon: {
                path: ['[data-slot="button"] svg'],
                styles: { width: "16px", height: "16px" },
              },
            }
          : {}),
      },
    };
  if (selected.subject === "Checkbox")
    return {
      ...base,
      path: ['[data-slot="checkbox"]'],
      associatedLabelText: "Receive updates",
      requiredStyles: {
        display: "flex",
        width: "16px",
        height: "16px",
        "border-radius": "4px",
        opacity: id === "checkbox-disabled" ? "0.5" : "1",
        "background-color":
          id === "checkbox-checked" ? "oklch(0.205 0 0)" : "rgba(0, 0, 0, 0)",
      },
      probes: {
        state: {
          path: ['[data-slot="checkbox"]'],
          properties: {
            disabled: id === "checkbox-disabled",
            ariaChecked:
              id === "checkbox-checked"
                ? "true"
                : id === "checkbox-indeterminate"
                  ? "mixed"
                  : "false",
          },
        },
        ...(["checkbox-checked", "checkbox-indeterminate"].includes(id)
          ? {
              indicator: {
                path: ['[data-slot="checkbox-indicator"] svg'],
                styles: { width: "14px", height: "14px" },
              },
            }
          : {}),
      },
    };
  // A subject without an authored witness is refused. Borrowing another
  // subject's witness would judge the wrong component and could pass.
  if (selected.subject !== "Card")
    throw Error("react-reference-subject-unwitnessed");
  return {
    ...base,
    path: ['[data-slot="card"]'],
    fontPath: ['[data-slot="card-title"]'],
    requiredStyles: {
      display: "flex",
      "flex-direction": "column",
      width: "360px",
      "border-radius": "14px",
      "background-color": "oklch(1 0 0)",
      "font-size": "14px",
    },
    probes: {
      header: { path: ['[data-slot="card-header"]'] },
      content: { path: ['[data-slot="card-content"]'] },
      footer: { path: ['[data-slot="card-footer"]'] },
      ...(id === "card-composed"
        ? {
            checkbox: {
              path: ['[data-slot="card"] [data-slot="checkbox"]'],
              properties: { ariaChecked: "true", disabled: false },
            },
            button: {
              path: ['[data-slot="card"] [data-slot="button"]'],
              properties: { disabled: false },
            },
          }
        : {}),
    },
  };
}
