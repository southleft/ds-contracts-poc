import { readFileSync } from 'node:fs';
import type { SourceProfile } from './check.js';

/** Selected before measuring; expectations derive from the pinned source's
 * component SCSS, general.scss label mixin and tokens-dark.scss, not screenshots.
 * This is a reference adapter, not automatic organization onboarding. */
export const altitudeRevision = '0639eccd15bfedc4fa9713d9545a64cef2c0f0a5';
const button: SourceProfile = JSON.parse(readFileSync(new URL('./altitude-button.json', import.meta.url),'utf8'));
const source = `Altitude ${altitudeRevision}: components/{button,checkbox,card}/*, styles/core/mixins/general.scss, styles/dist/scss/theme/tokens-dark.scss; actual Storybook dark provider`;
const theme = {'--al-theme-color-body-background':'#101010'};
const checkbox: SourceProfile = {
  id:'checkbox', provenance:source, path:['al-checkbox','.al-c-checkbox'],
  fontPath:['al-checkbox','.al-c-checkbox__label'], fontFamily:'IBM Plex Sans',
  requiredStyles:{display:'flex','flex-direction':'column',gap:'8px'},
  requiredTokens:{...theme,'--al-theme-color-content-default':'#f8f8f6',
    '--al-theme-typography-body-md':'400 1rem/1.5rem IBM Plex Sans, sans-serif'},
};
const card: SourceProfile = {
  id:'card', provenance:source, path:['al-card','.al-c-card'], fontFamily:'IBM Plex Sans',
  requiredStyles:{display:'flex','flex-wrap':'wrap',gap:'8px','padding-top':'16px',
    'border-radius':'8px','background-color':'rgb(24, 24, 24)',color:'rgb(248, 248, 246)'},
  requiredTokens:{...theme,'--al-theme-color-background-default':'#181818','--al-theme-color-content-default':'#f8f8f6'},
};
export type CohortEntry = {story:string; profile:SourceProfile; limitations:string[]};
function cardProbes(state:string): SourceProfile['probes'] {
  if (state === 'default') return {placeholder:{path:['al-card f-po','.f-po']}};
  return {
    image:{path:['al-card img'],properties:{complete:true,naturalWidth:600,naturalHeight:400}},
    title:{path:['al-card al-heading','h3']},
    body:{path:['al-card al-text-passage','.al-c-text-passage']},
  };
}
export const altitudeCohort: CohortEntry[] = [
  ...['default','secondary','default-disabled','default-icon-before'].map<CohortEntry>(state => ({
    story:`atoms-button--${state}`, profile:{...button,id:`altitude-button-${state}`,
      requiredStyles:{...button.requiredStyles,opacity:state === 'default-disabled' ? '0.4' : '1',
        ...(state === 'secondary' ? {'background-color':'rgb(164, 153, 129)',color:'rgb(25, 19, 6)'} : {})},
      requiredTokens:{...button.requiredTokens,...(state === 'secondary' ? {
        '--al-theme-color-background-secondary-default':'#a49981','--al-theme-color-content-secondary-weak':'#191306'} : {})},
      probes:{input:{path:['al-button','button'],properties:{disabled:state === 'default-disabled'}},
        ...(state === 'default-icon-before' ? {icon:{path:['al-button al-icon-success','svg'],styles:{width:'24px',height:'24px'}}} : {})},
    }, limitations:['Source readiness only; activation and keyboard behavior not yet measured.'],
  })),
  ...['default','checked','indeterminate','disabled'].map<CohortEntry>(state => ({
    story:`atoms-checkbox--${state}`, profile:{...checkbox,id:`altitude-checkbox-${state}`,
      probes:{
        // The original Indeterminate.play clicks the input, then restores only
        // isIndeterminate. Its stable post-play checked value is therefore true.
        // We preserve that source behavior, not pretend this is initial args.
        input:{path:['al-checkbox','input'],properties:{checked:['checked','indeterminate'].includes(state),disabled:state === 'disabled'}},
        label:{path:['al-checkbox','.al-c-checkbox__label'],styles:{'font-size':'16px','font-weight':'400','line-height':'24px',opacity:state === 'disabled' ? '0.4' : '1'}},
        mark:{path:['al-checkbox','.al-c-checkbox__custom-check'],styles:{width:'18px',height:'18px',
          'background-color':['checked','indeterminate'].includes(state) ? 'rgb(0, 11, 41)' : 'rgba(0, 0, 0, 0)',
          'border-top-color':['checked','indeterminate'].includes(state) ? 'rgb(67, 117, 255)' : 'rgb(248, 248, 246)'}},
        ...(state === 'indeterminate' ? {mixed:{path:['al-checkbox','.al-is-indeterminate']}} : {}),
      },
    }, limitations:[...(state === 'indeterminate' ? ['Captured after the original Storybook play function: it clicks the input and restores only isIndeterminate, leaving checked=true.', 'Source render sets a mixed-state CSS class but does not set native input.indeterminate. Visual readiness does not establish mixed-state accessibility.'] : []),
      'Interactive transitions and accessibility not yet qualified.'],
  })),
  ...['default','with-content'].map<CohortEntry>(state => ({
    story:`molecules-card--${state}`, profile:{...card,id:`altitude-card-${state}`,
      fontPath:state === 'default' ? ['al-card f-po','.f-po'] : ['al-card al-heading','h3'],
      probes:cardProbes(state),
    }, limitations:[state === 'default' ? 'Default story uses source-authored FPO slot placeholders; the real composition is counted separately.' : 'External image must load; no placeholder substitution.',
      'Slot reuse and popover behavior not yet measured.'],
  })),
];

/** The three declared Button variant values absent from the original cohort.
 * Keep this separate: supplementing evidence must not rewrite the original
 * ten-story denominator or turn an unmeasured state into a passing result.
 * Witnesses follow button.scss's own variant rules and their dark token
 * aliases, resolved through styles/dist/tokens.json before any capture. */
export const altitudeButtonVariants = (['tertiary','bare','danger'] as const).map<CohortEntry>(variant => ({
    story:`atoms-button--${variant}`,
    profile:{
      ...button,
      id:`altitude-button-${variant}`,
      provenance:`Altitude ${altitudeRevision}: components/button/button.stories.ts exports ${variant[0].toUpperCase() + variant.slice(1)} with variant='${variant}'; components/button/button.scss .al-c-button--${variant} and styles/dist/scss/theme/tokens-dark.scss aliases resolved through styles/dist/tokens.json; original Storybook dark provider, not a learned screenshot oracle.`,
      path:['al-button',`button.al-c-button--${variant}`],
      requiredStyles:{
        ...button.requiredStyles,
        opacity:'1',
        'background-color':variant === 'danger' ? 'rgb(240, 87, 53)' : 'rgba(0, 0, 0, 0)',
        color:variant === 'danger' ? 'rgb(31, 6, 0)' : 'rgb(248, 248, 246)',
        'border-top-width':variant === 'tertiary' ? '1px' : '0px',
        'border-top-style':variant === 'tertiary' ? 'solid' : 'none',
        ...(variant === 'tertiary' ? {'border-top-color':'rgb(138, 138, 138)'} : {}),
      },
      requiredTokens:{
        ...button.requiredTokens,
        ...(variant === 'danger' ? {
          '--al-theme-color-background-danger-default':'#f05735',
          '--al-theme-color-content-danger-weak':'#1f0600',
        } : {
          '--al-theme-color-background-transparent-default':'rgba(0, 0, 0, 0)',
          '--al-theme-color-content-default':'#f8f8f6',
        }),
        ...(variant === 'tertiary' ? {
          '--al-theme-border-width':'1px',
          '--al-theme-color-border-default':'#8a8a8a',
        } : {}),
      },
      probes:{input:{path:['al-button',`button.al-c-button--${variant}`],properties:{disabled:false}}},
    },
    limitations:[
      'Supplemental original-story source readiness only; acceptance and code/canvas conversion remain unmeasured.',
      'This observes one declared variant at rest with the original text slot; other props, content, activation and keyboard behavior are not qualified.',
    ],
  }));
