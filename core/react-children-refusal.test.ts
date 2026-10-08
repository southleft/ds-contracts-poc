import assert from "node:assert/strict";
import test from "node:test";
import { ContractSchema, type Contract } from "../scripts/contract-schema.js";
import { emitReact } from "./emit-react.js";
import { tokenInventoryFromJson } from "./tokens.js";

// A component whose JSX never renders `children` must refuse them in its
// props type instead of accepting and discarding them (design-led consumer
// finding, Altitude Badge 2026-09-18). A component with a declared slot keeps
// `children` byte-for-byte.
const tokens = { primitives: { paint: { base: { $type: "color", $value: "#4375ff" } } }, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
function contract(anatomyRoot: Record<string, unknown>, props: unknown[] = []): Contract {
  return ContractSchema.parse({
    id: "probe.children", name: "ChildrenProbe", version: "1.0.0", archetype: "none",
    description: "Children refusal conformance, not a qualified source component.",
    semantics: { element: "div" }, props, states: [],
    anatomy: { root: { layout: { display: "inline-flex", direction: "row" }, tokens: { "background-color": "{paint.base}" }, ...anatomyRoot } },
    bindings: { code: { anchors: { importPath: "./fixture", export: "Fixture" } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
}
const emit = (c: Contract) => emitReact(c, { contracts: new Map([[c.id, c]]), icons: new Map(), tokens: tokenInventoryFromJson([tokens.primitives]) }).tsx;

test("a slotless component omits children from its props type and destructure", () => {
  const tsx = emit(contract({ parts: { label: { content: { prop: "text" } } } }, [
    { name: "text", type: "text", default: "Badge", bindings: { code: { prop: "text" }, figma: { kind: "TEXT", property: "Text" } } },
  ]));
  assert.match(tsx, /extends Omit<HTMLAttributes<HTMLDivElement>, 'children'>/);
  assert.match(tsx, /`children` OMITTED/);
  assert.doesNotMatch(tsx.slice(tsx.indexOf("forwardRef<")), /\bchildren\b/);
  assert.match(tsx, /\{text\}/, "the TEXT-bound prop still renders");
});

test("a component with a declared slot keeps children in its props type and renders them", () => {
  const tsx = emit(contract({ slot: { name: "children" } }));
  assert.match(tsx, /extends HTMLAttributes<HTMLDivElement> \{/);
  assert.doesNotMatch(tsx, /`children` OMITTED/);
  assert.match(tsx, /\{children\}/);
});

test('a part named children and literal children text do not grant an unused caller API',()=>{
 for(const root of [
  {parts:{children:{content:{prop:'label'}}}},
  {parts:{copy:{text:'children'}}},
  {parts:{copy:{text:'A "children" label'}}},
 ]){
  const tsx=emit(contract(root,[{name:'label',type:'text',default:'Button',bindings:{code:{prop:'label'},figma:{kind:'TEXT',property:'Label'}}}]));
  assert.match(tsx,/extends Omit<HTMLAttributes<HTMLDivElement>, 'children'>/);
  assert.doesNotMatch(tsx.slice(tsx.indexOf('function ChildrenProbe('),tsx.indexOf(') {',tsx.indexOf('function ChildrenProbe('))),/\bchildren\b/);
 }
});

test('a children-bound text leaf keeps the caller API even when its CSS part has the same name',()=>{
 const tsx=emit(contract({parts:{children:{content:{prop:'children'}}}},[
  {name:'label',type:'text',default:'Button',bindings:{code:{prop:'children'},figma:{kind:'TEXT',property:'Label'}}},
 ]));
 assert.match(tsx,/extends HTMLAttributes<HTMLDivElement> \{/);
 assert.match(tsx,/\{children\}/);
});

test('the generated consumer type rejects children on a named label part and accepts them on a real slot',async()=>{
 const {generatedTypeErrors}=await import('./react-test-runtime.js');
 const label=contract({parts:{children:{content:{prop:'label'}}}},[
  {name:'label',type:'text',default:'Button',bindings:{code:{prop:'label'},figma:{kind:'TEXT',property:'Label'}}},
 ]);
 const closed=emit(label),open=emit(contract({slot:{name:'children'}}));
 assert.deepEqual(generatedTypeErrors(label.name,closed),[]);
 assert(generatedTypeErrors(label.name,closed+'\nconst consumer = <ChildrenProbe children="Caller text" />;').some(e=>e.includes('children')));
 assert.deepEqual(generatedTypeErrors(label.name,open+'\nconst consumer = <ChildrenProbe children="Caller text" />;'),[]);
});

test('a conditional slot with default content retains its children binding',async()=>{
 const {generatedTypeErrors}=await import('./react-test-runtime.js');
 const child=contract({text:'Default'});child.id='probe.default';child.name='DefaultSample';
 const c=contract({parts:{icon:{slot:{name:'children',renderDefault:true,collapseWhenEmpty:true,defaultContent:[{id:child.id}]},parts:{fallback:{component:{id:child.id}}}}}});
 const tsx=emitReact(c,{contracts:new Map([[c.id,c],[child.id,child]]),icons:new Map(),tokens:tokenInventoryFromJson([tokens.primitives])}).tsx;
 assert.match(tsx,/children === undefined/);
 assert.deepEqual(generatedTypeErrors(c.name,tsx+'\nconst consumer = <ChildrenProbe children="Caller text" />;',{DefaultSample:emit(child)}),[]);
});
