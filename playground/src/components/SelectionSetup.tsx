import { cloneElement, useId, useState, type ReactElement } from "react";
import type { Contract, Part } from "../../../scripts/contract-schema.js";
import {
  prepareSelectionSetup,
  selectionSetupParts,
  type SelectionSetup as Setup,
} from "../engine/selection-setup";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="selection-setup__field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}

const ordinary = (part: Part) =>
  !part.component &&
  !part.repeat &&
  !part.slot &&
  !part.content &&
  part.text === undefined &&
  !part.icon &&
  !part.shape &&
  !part.meter;
export function SelectionSetup({
  contract,
  contracts,
  onApply,
  onEditJson,
}: {
  contract: Contract;
  contracts: Map<string, Contract>;
  onApply(next: Contract): void;
  onEditJson(): void;
}) {
  const rows = selectionSetupParts(contract),
    repeats = rows.filter((row) => row.part.repeat && row.part.component);
  const [input, setInput] = useState<Setup>({
    itemPart: "",
    keyField: "itemId",
    listLabel: "",
    valueProp: "selection",
    valueCode: "value",
    initialCode: "defaultValue",
    callbackCode: "onValueChange",
    selectedProp: "",
    selectedOn: "",
    selectedOff: "",
    panelContainer: "",
    initialKey: "",
    orientation: "horizontal",
    direction: "ltr",
    activation: "automatic",
    items: [],
  });
  const [review, setReview] = useState<ReturnType<
      typeof prepareSelectionSetup
    > | null>(null),
    [problem, setProblem] = useState<string | null>(null);
  const change = (patch: Partial<Setup>) => {
    setInput((previous) => ({ ...previous, ...patch }));
    setReview(null);
    setProblem(null);
  };
  const selected = rows.find((row) => row.name === input.itemPart),
    repeat = selected?.part.repeat;
  const child =
    selected?.part.component && contracts.get(selected.part.component.id);
  const appearances =
    child?.props.filter(
      (prop) => typeof prop.type === "object" && "enum" in prop.type,
    ) ?? [];
  const appearance = appearances.find(
    (prop) => prop.name === input.selectedProp,
  );
  const values =
    appearance &&
    typeof appearance.type === "object" &&
    "enum" in appearance.type
      ? appearance.type.enum
      : [];
  const collection = contract.props.find(
    (prop) => prop.name === repeat?.itemsProp,
  );
  const fields =
    collection &&
    typeof collection.type === "object" &&
    "arrayOf" in collection.type
      ? collection.type.arrayOf
      : {};
  const container = rows.find((row) => row.name === input.panelContainer);
  const panels = rows.filter(
    (row) =>
      container &&
      row.path.slice(0, -1).join("/") === container.path.join("/") &&
      row.name !== selected?.name &&
      (row.part.element ?? "div") === "div" &&
      (ordinary(row.part) || row.part.slot || row.part.component),
  );
  const itemChange = (index: number, patch: Partial<Setup["items"][number]>) =>
    change({
      items: input.items.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    });
  if (contract.selection)
    return (
      <div className="selection-setup">
        <h3>Tab navigation is declared</h3>
        <p>
          {contract.selection.panels.length} panels;{" "}
          {contract.selection.activation} activation;{" "}
          {contract.selection.orientation} navigation;{" "}
          {contract.selection.direction}.
        </p>
        <ul>
          {contract.selection.panels.map((panel) => (
            <li key={panel.value}>
              {panel.value} → {panel.part}
            </li>
          ))}
        </ul>
        <p>
          Keyboard behavior runs in the generated React library. The current
          preview is static. Native return requires preserved item identities and
          matching states and panels. The live return journey is not yet qualified.
        </p>
        <p className="hint">
          Changes stay in this editor until you export them. The imported
          workspace entry remains the loaded source.
        </p>
        <button type="button" onClick={onEditJson}>
          Edit the declaration
        </button>
      </div>
    );
  return (
    <div className="selection-setup">
      <h3>Configure tab navigation</h3>
      <p>
        Declare which items control which panels. The captured appearance alone
        does not establish this relationship.
      </p>
      {!repeats.length ? (
        <p>
          No repeated component is available. This setup requires an observed
          collection of native-button components.
        </p>
      ) : (
        <>
          <Field label="Repeated items">
            <select
              value={input.itemPart}
              onChange={(event) => {
                const target = repeats.find(
                    (row) => row.name === event.target.value,
                  ),
                  r = target?.part.repeat;
                change({
                  itemPart: event.target.value,
                  keyField: r?.keyField ?? "itemId",
                  selectedProp: "",
                  selectedOn: "",
                  selectedOff: "",
                  initialKey: "",
                  items:
                    r?.sample.map((record, index) => ({
                      key: r.keyField ? String(record[r.keyField]) : "",
                      panel: { kind: "existing", part: "" },
                      focusable: true,
                    })) ?? [],
                });
              }}
            >
              <option value="">Choose the repeated component</option>
              {repeats.map((row) => (
                <option key={row.name} value={row.name}>
                  {row.name}
                </option>
              ))}
            </select>
          </Field>
          {repeat && (
            <>
              <fieldset>
                <legend>Identity and selected appearance</legend>
                <Field label="Identity field">
                  <input
                    value={input.keyField}
                    disabled={!!repeat.keyField}
                    onChange={(e) => change({ keyField: e.target.value })}
                  />
                </Field>
                <p className="hint">
                  Assign stable keys below. Changing a label or reordering items
                  will not change their identity.
                </p>
                <Field label="List label">
                  <input
                    value={input.listLabel}
                    onChange={(e) => change({ listLabel: e.target.value })}
                  />
                </Field>
                <Field label="Selected appearance property">
                  <select
                    value={input.selectedProp}
                    onChange={(e) =>
                      change({
                        selectedProp: e.target.value,
                        selectedOn: "",
                        selectedOff: "",
                      })
                    }
                  >
                    <option value="">Choose a child variant</option>
                    {appearances.map((prop) => (
                      <option key={prop.name} value={prop.name}>
                        {prop.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Selected value">
                  <select
                    value={input.selectedOn}
                    onChange={(e) => change({ selectedOn: e.target.value })}
                  >
                    <option value="">Choose a value</option>
                    {values.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Unselected value">
                  <select
                    value={input.selectedOff}
                    onChange={(e) => change({ selectedOff: e.target.value })}
                  >
                    <option value="">Choose a value</option>
                    {values.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Disabled item field">
                  <select
                    value={input.disabledField ?? ""}
                    onChange={(e) =>
                      change({ disabledField: e.target.value || undefined })
                    }
                  >
                    <option value="">No per-item disabled input</option>
                    {Object.entries(fields)
                      .filter(([, type]) => type === "boolean")
                      .map(([field]) => (
                        <option key={field}>{field}</option>
                      ))}
                  </select>
                </Field>
              </fieldset>
              <fieldset>
                <legend>Panel ownership</legend>
                <Field label="Panel container">
                  <select
                    value={input.panelContainer}
                    onChange={(e) =>
                      change({
                        panelContainer: e.target.value,
                        items: input.items.map((item) => ({
                          ...item,
                          panel: { kind: "existing", part: "" },
                        })),
                      })
                    }
                  >
                    <option value="">Choose the container</option>
                    {rows
                      .filter((row) => ordinary(row.part))
                      .map((row) => (
                        <option key={row.name}>{row.name}</option>
                      ))}
                  </select>
                </Field>
                <p className="hint">
                  Retain an existing body or explicitly add an empty content
                  slot. Empty slots must be supplied by the consuming app; they
                  do not invent missing design content.
                </p>
                {input.items.map((item, index) => (
                  <fieldset key={index}>
                    <legend>Observed item {index + 1}</legend>
                    <p>
                      {Object.entries(repeat.sample[index])
                        .map(([name, value]) => `${name}: ${String(value)}`)
                        .join(" · ")}
                    </p>
                    <Field label={`Stable key for item ${index + 1}`}>
                      <input
                        value={item.key}
                        disabled={!!repeat.keyField}
                        onChange={(e) =>
                          itemChange(index, { key: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={`Panel for item ${index + 1}`}>
                      <select
                        value={
                          item.panel.kind === "slot"
                            ? "slot"
                            : `existing:${item.panel.part}`
                        }
                        onChange={(e) =>
                          itemChange(index, {
                            panel:
                              e.target.value === "slot"
                                ? {
                                    kind: "slot",
                                    part: `panel${index + 1}`,
                                    slot: `panel${index + 1}Content`,
                                  }
                                : {
                                    kind: "existing",
                                    part: e.target.value.slice(9),
                                  },
                          })
                        }
                      >
                        <option value="existing:">Choose panel content</option>
                        {panels.map((panel) => (
                          <option
                            key={panel.name}
                            value={`existing:${panel.name}`}
                          >
                            Existing: {panel.name}
                          </option>
                        ))}
                        <option value="slot">
                          New empty consumer content slot
                        </option>
                      </select>
                    </Field>
                    {item.panel.kind === "slot" && (
                      <>
                        <Field label={`Panel name for item ${index + 1}`}>
                          <input
                            value={item.panel.part}
                            onChange={(e) =>
                              itemChange(index, {
                                panel: { ...item.panel, part: e.target.value },
                              })
                            }
                          />
                        </Field>
                        <Field label={`Content slot for item ${index + 1}`}>
                          <input
                            value={item.panel.slot}
                            onChange={(e) =>
                              itemChange(index, {
                                panel: {
                                  kind: "slot",
                                  part: item.panel.part,
                                  slot: e.target.value,
                                },
                              })
                            }
                          />
                        </Field>
                      </>
                    )}
                    <label className="selection-setup__check">
                      <input
                        type="checkbox"
                        checked={item.focusable}
                        onChange={(e) =>
                          itemChange(index, { focusable: e.target.checked })
                        }
                      />
                      Panel can receive keyboard focus
                    </label>
                  </fieldset>
                ))}
                <Field label="Initially selected item">
                  <select
                    value={input.initialKey}
                    onChange={(e) => change({ initialKey: e.target.value })}
                  >
                    <option value="">Choose the initial selection</option>
                    {input.items
                      .filter((item) => item.key)
                      .map((item, index) => (
                        <option key={index}>{item.key}</option>
                      ))}
                  </select>
                </Field>
              </fieldset>
              <fieldset>
                <legend>Navigation and React inputs</legend>
                <Field label="Activation">
                  <select
                    value={input.activation}
                    onChange={(e) =>
                      change({
                        activation: e.target.value as Setup["activation"],
                      })
                    }
                  >
                    <option value="automatic">
                      Automatic — selection follows focus
                    </option>
                    <option value="manual">
                      Manual — Enter or Space selects
                    </option>
                  </select>
                </Field>
                <Field label="Orientation">
                  <select
                    value={input.orientation}
                    onChange={(e) =>
                      change({
                        orientation: e.target.value as Setup["orientation"],
                      })
                    }
                  >
                    <option value="horizontal">Horizontal</option>
                    <option value="vertical">Vertical</option>
                  </select>
                </Field>
                <Field label="Text direction">
                  <select
                    value={input.direction}
                    onChange={(e) =>
                      change({
                        direction: e.target.value as Setup["direction"],
                      })
                    }
                  >
                    <option value="ltr">Left to right</option>
                    <option value="rtl">Right to left</option>
                  </select>
                </Field>
                <Field label="Contract selection property">
                  <input
                    value={input.valueProp}
                    onChange={(e) => change({ valueProp: e.target.value })}
                  />
                </Field>
                <Field label="React controlled input">
                  <input
                    value={input.valueCode}
                    onChange={(e) => change({ valueCode: e.target.value })}
                  />
                </Field>
                <Field label="React initial input">
                  <input
                    value={input.initialCode}
                    onChange={(e) => change({ initialCode: e.target.value })}
                  />
                </Field>
                <Field label="React change callback">
                  <input
                    value={input.callbackCode}
                    onChange={(e) => change({ callbackCode: e.target.value })}
                  />
                </Field>
              </fieldset>
              <button
                type="button"
                className="btn--primary"
                onClick={() => {
                  try {
                    setReview(
                      prepareSelectionSetup(contract, contracts, input),
                    );
                    setProblem(null);
                  } catch (error) {
                    setReview(null);
                    setProblem(
                      error instanceof Error ? error.message : String(error),
                    );
                  }
                }}
              >
                Review selection setup
              </button>
            </>
          )}
          {problem && (
            <p role="alert" className="selection-setup__problem">
              {problem}
            </p>
          )}
          {review && (
            <section aria-label="Selection setup review">
              <h4>Proposed changes</h4>
              <ul>
                {review.changes.map((change, index) => (
                  <li key={index}>{change}</li>
                ))}
              </ul>
              <p>
                The current preview remains static. Keyboard behavior runs in
                the generated React library. Live native return remains unqualified.
              </p>
              <p className="hint">
                Apply updates the editor. Reset restores the loaded source; no
                draft is saved automatically.
              </p>
              <button
                type="button"
                className="btn--primary"
                onClick={() => {
                  try {
                    onApply(review.contract);
                  } catch (error) {
                    setProblem(
                      error instanceof Error ? error.message : String(error),
                    );
                  }
                }}
              >
                Apply selection to contract
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
