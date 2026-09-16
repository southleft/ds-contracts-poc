/** Frozen before qualification. These mount the original source components,
 * never the contract emitter. They are a reference adapter, not converters. */
export const reactReferenceCases = [
  { id: "button-default", subject: "Button", label: "Default" },
  { id: "button-secondary", subject: "Button", label: "Secondary" },
  { id: "button-disabled", subject: "Button", label: "Disabled" },
  { id: "button-icon", subject: "Button", label: "Icon and text" },
  { id: "checkbox-unchecked", subject: "Checkbox", label: "Unchecked" },
  { id: "checkbox-checked", subject: "Checkbox", label: "Checked" },
  { id: "checkbox-indeterminate", subject: "Checkbox", label: "Indeterminate" },
  { id: "checkbox-disabled", subject: "Checkbox", label: "Disabled" },
  { id: "card-content", subject: "Card", label: "Header, content and footer" },
  { id: "card-composed", subject: "Card", label: "Nested Checkbox and Button" },
] as const;
export const reactReferenceEntry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Button} from './src/components/ui/button';
import {Checkbox} from './src/components/ui/checkbox';
import {Card,CardHeader,CardTitle,CardDescription,CardContent,CardFooter} from './src/components/ui/card';
import {PlusIcon} from 'lucide-react';
import '@fontsource-variable/inter';
import './tailwind.css';
const selected = new URLSearchParams(location.search).get('case');
const known = ${JSON.stringify(reactReferenceCases.map((c) => c.id))};
if (!known.includes(selected)) throw Error('Unknown reference case');
const checkbox = (checked, disabled=false) => <div style={{display:'flex',alignItems:'center',gap:8}}>
  <Checkbox id="notifications" defaultChecked={checked} disabled={disabled}/>
  <label htmlFor="notifications">Receive updates</label>
</div>;
let example;
if (selected.startsWith('button-')) example=<Button variant={selected==='button-secondary'?'secondary':undefined} disabled={selected==='button-disabled'}>
  {selected==='button-icon'?<PlusIcon/>:null}Save changes</Button>;
else if (selected.startsWith('checkbox-')) example=checkbox(selected==='checkbox-indeterminate'?'indeterminate':selected==='checkbox-checked',selected==='checkbox-disabled');
else example=<Card style={{width:360}}><CardHeader><CardTitle>Workspace settings</CardTitle><CardDescription>Manage your notifications.</CardDescription></CardHeader>
  <CardContent>{selected==='card-composed'?checkbox(true):'Choose which updates you receive.'}</CardContent>
  <CardFooter>{selected==='card-composed'?<Button>Save changes</Button>:'Settings apply to this workspace.'}</CardFooter></Card>;
createRoot(document.getElementById('root')).render(example);
`;
