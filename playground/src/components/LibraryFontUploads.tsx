import React from 'react';
import type { LibraryFontUpload } from '../engine/library-fonts';
export function LibraryFontUploads({ fonts, onChange, disabled }: {
  fonts: LibraryFontUpload[]; onChange: (fonts: LibraryFontUpload[]) => void; disabled: boolean;
}) {
  const update = (id: number, change: Partial<LibraryFontUpload>) => onChange(fonts.map(face => face.id === id ? { ...face, ...change } : face));
  return <fieldset disabled={disabled}>
    <legend>Include font files (optional)</legend>
    <p className="hint">Choose fonts you can distribute with this library and add their license notices. Files stay in browser memory and are sent to the local server when you prepare the library. The full request, including encoded files, is limited to 5 MB.</p>
    {fonts.map((face, index) => <fieldset key={face.id}>
      <legend>Font {index + 1}</legend>
      <p className="hint">Selected font: <strong>{face.file?.name ?? 'None selected'}</strong></p>
      <label>{face.file ? 'Replace font file' : 'Choose font file'} <input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={event => update(face.id, { file: event.target.files?.[0] ?? null })} /></label>
      <label>Family name <input value={face.family} placeholder="Inter" onChange={event => update(face.id, { family: event.target.value })} /></label>
      <label>Weight or range <input value={face.weight} placeholder="400 or 100 900" onChange={event => update(face.id, { weight: event.target.value })} /></label>
      <label>Style <select value={face.style} onChange={event => update(face.id, { style: event.target.value as LibraryFontUpload['style'] })}><option value="normal">Normal</option><option value="italic">Italic</option></select></label>
      <p className="hint">Selected license notice: <strong>{face.license?.name ?? 'None selected'}</strong></p>
      <label>{face.license ? 'Replace license notice' : 'Choose license notice (optional)'} <input type="file" accept=".txt,text/plain" onChange={event => update(face.id, { license: event.target.files?.[0] ?? null })} /></label>
      <button type="button" onClick={() => onChange(fonts.filter(row => row.id !== face.id))}>Remove font {index + 1}</button>
    </fieldset>)}
    <button type="button" disabled={disabled || fonts.length >= 32} onClick={() => onChange([...fonts, { id: Math.max(-1, ...fonts.map(face => face.id)) + 1, family: '', weight: '400', style: 'normal', file: null, license: null }])}>Add font</button>
  </fieldset>;
}
