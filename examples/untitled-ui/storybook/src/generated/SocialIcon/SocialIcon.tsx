/**
 * GENERATED FILE — DO NOT EDIT.
 * Source of truth: contracts/social-icon.contract.json (ds.social-icon v0.1.0)
 * Regenerate with: npm run generate
 */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import styles from './SocialIcon.module.css';

const ICONS: Record<string, string> = {
  facebook:
    '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n<g clip-path="url(#clip0_1027_1579)">\n<path d="M24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 17.9895 4.3882 22.954 10.125 23.8542V15.4688H7.07812V12H10.125V9.35625C10.125 6.34875 11.9166 4.6875 14.6576 4.6875C15.9701 4.6875 17.3438 4.92188 17.3438 4.92188V7.875H15.8306C14.34 7.875 13.875 8.80008 13.875 9.75V12H17.2031L16.6711 15.4688H13.875V23.8542C19.6118 22.954 24 17.9895 24 12Z" fill="white"/>\n</g>\n<defs>\n<clipPath id="clip0_1027_1579">\n<rect width="24" height="24" fill="white"/>\n</clipPath>\n</defs>\n</svg>',
  google:
    '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n<g clip-path="url(#clip0_1027_1528)">\n<path d="M23.7663 12.2764C23.7663 11.4607 23.7001 10.6406 23.559 9.83807H12.2402V14.4591H18.722C18.453 15.9494 17.5888 17.2678 16.3233 18.1056V21.1039H20.1903C22.4611 19.0139 23.7663 15.9274 23.7663 12.2764Z" fill="#4285F4"/>\n<path d="M12.2401 24.0008C15.4766 24.0008 18.2059 22.9382 20.1945 21.1039L16.3276 18.1055C15.2517 18.8375 13.8627 19.252 12.2445 19.252C9.11388 19.252 6.45946 17.1399 5.50705 14.3003H1.5166V17.3912C3.55371 21.4434 7.7029 24.0008 12.2401 24.0008Z" fill="#34A853"/>\n<path d="M5.50277 14.3003C5.00011 12.8099 5.00011 11.1961 5.50277 9.70575V6.61481H1.51674C-0.185266 10.0056 -0.185266 14.0004 1.51674 17.3912L5.50277 14.3003Z" fill="#FBBC04"/>\n<path d="M12.2401 4.74966C13.9509 4.7232 15.6044 5.36697 16.8434 6.54867L20.2695 3.12262C18.1001 1.0855 15.2208 -0.034466 12.2401 0.000808666C7.7029 0.000808666 3.55371 2.55822 1.5166 6.61481L5.50264 9.70575C6.45064 6.86173 9.10947 4.74966 12.2401 4.74966Z" fill="#EA4335"/>\n</g>\n<defs>\n<clipPath id="clip0_1027_1528">\n<rect width="24" height="24" fill="white"/>\n</clipPath>\n</defs>\n</svg>',
  apple:
    '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n<path d="M20.8428 17.1449C20.5101 17.9135 20.1163 18.6211 19.66 19.2715C19.0381 20.1583 18.5288 20.7721 18.1364 21.113C17.528 21.6724 16.8762 21.959 16.1782 21.9753C15.6771 21.9753 15.0728 21.8327 14.3693 21.5434C13.6636 21.2555 13.015 21.113 12.422 21.113C11.8 21.113 11.133 21.2555 10.4195 21.5434C9.70493 21.8327 9.12928 21.9834 8.68916 21.9984C8.01981 22.0269 7.35264 21.7322 6.68668 21.113C6.26164 20.7422 5.72999 20.1067 5.09309 19.2063C4.40976 18.2449 3.84796 17.13 3.40784 15.8589C2.93648 14.486 2.7002 13.1565 2.7002 11.8694C2.7002 10.3951 3.01878 9.12345 3.65689 8.05784C4.1584 7.20191 4.82557 6.52672 5.66059 6.03105C6.49562 5.53539 7.39786 5.2828 8.36949 5.26664C8.90114 5.26664 9.59833 5.43109 10.4647 5.75429C11.3287 6.07858 11.8834 6.24303 12.1266 6.24303C12.3085 6.24303 12.9247 6.05074 13.9694 5.66738C14.9573 5.31186 15.7911 5.16466 16.4742 5.22264C18.3251 5.37202 19.7157 6.10167 20.6405 7.41619C18.9851 8.4192 18.1662 9.82403 18.1825 11.6262C18.1975 13.03 18.7067 14.1981 19.7076 15.1256C20.1611 15.5561 20.6676 15.8888 21.2312 16.1251C21.109 16.4795 20.98 16.819 20.8428 17.1449ZM16.5978 0.440369C16.5978 1.54062 16.1958 2.56792 15.3946 3.51878C14.4277 4.64917 13.2582 5.30236 11.99 5.19929C11.9738 5.06729 11.9645 4.92837 11.9645 4.78239C11.9645 3.72615 12.4243 2.59576 13.2408 1.67152C13.6485 1.20356 14.167 0.814453 14.7957 0.504058C15.4231 0.198295 16.0166 0.0292007 16.5747 0.000244141C16.591 0.147331 16.5978 0.294426 16.5978 0.440355V0.440369Z" fill="white"/>\n</svg>',
  figma:
    '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n<g clip-path="url(#clip0_1027_1544)">\n<path d="M8.00006 24C10.2081 24 12.0001 22.208 12.0001 20V15.9999H8.00006C5.79205 15.9999 4 17.792 4 20C4 22.208 5.79205 24 8.00006 24Z" fill="#24CB71"/>\n<path d="M4 12C4 9.79197 5.79205 7.99994 8.00006 7.99994H12.0001V15.9999H8.00006C5.79205 16 4 14.208 4 12Z" fill="#874FFF"/>\n<path d="M4 4.00003C4 1.79203 5.79205 0 8.00006 0H12.0001V7.99997H8.00006C5.79205 7.99997 4 6.20803 4 4.00003Z" fill="#FF3737"/>\n<path d="M12 0H16.0001C18.2081 0 20.0001 1.79203 20.0001 4.00003C20.0001 6.20803 18.2081 7.99997 16.0001 7.99997H12V0Z" fill="#FF7237"/>\n<path d="M20.0001 12C20.0001 14.208 18.2081 16 16.0001 16C13.792 16 12 14.208 12 12C12 9.79197 13.792 7.99994 16.0001 7.99994C18.2081 7.99994 20.0001 9.79197 20.0001 12Z" fill="#00B6FF"/>\n</g>\n<defs>\n<clipPath id="clip0_1027_1544">\n<rect width="24" height="24" fill="white"/>\n</clipPath>\n</defs>\n</svg>',
  dribbble:
    '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n<path fill-rule="evenodd" clip-rule="evenodd" d="M12 0C5.37527 0 0 5.37527 0 12C0 18.6248 5.37527 24 12 24C18.6117 24 24 18.6248 24 12C24 5.37527 18.6117 0 12 0ZM19.9262 5.53145C21.3579 7.27549 22.217 9.50107 22.243 11.9089C21.9046 11.8439 18.5206 11.154 15.1106 11.5835C15.0325 11.4143 14.9675 11.2321 14.8894 11.0499C14.6811 10.5554 14.4469 10.0477 14.2126 9.56618C17.9869 8.0304 19.705 5.81779 19.9262 5.53145ZM12 1.77007C14.603 1.77007 16.9848 2.74621 18.7939 4.34707C18.6117 4.60738 17.0629 6.67679 13.4186 8.04338C11.7397 4.95878 9.87855 2.43384 9.5922 2.04338C10.3601 1.86117 11.1671 1.77007 12 1.77007ZM7.63995 2.73319C7.91325 3.09761 9.73538 5.63558 11.4404 8.65508C6.65076 9.9306 2.42083 9.90458 1.96529 9.90458C2.62907 6.72885 4.77657 4.08676 7.63995 2.73319ZM1.74404 12.0131C1.74404 11.9089 1.74404 11.8048 1.74404 11.7007C2.18655 11.7136 7.15835 11.7787 12.2733 10.243C12.5727 10.8156 12.846 11.4013 13.1063 11.9869C12.9761 12.026 12.8329 12.0651 12.7028 12.1041C7.41865 13.8091 4.60738 18.4685 4.3731 18.859C2.7462 17.0499 1.74404 14.6421 1.74404 12.0131ZM12 22.256C9.6312 22.256 7.44469 21.449 5.71367 20.0954C5.89588 19.718 7.97827 15.7094 13.757 13.692C13.783 13.679 13.7961 13.679 13.8221 13.666C15.2668 17.4013 15.8525 20.5379 16.0087 21.436C14.7722 21.9696 13.4186 22.256 12 22.256ZM17.7136 20.4989C17.6096 19.8742 17.0629 16.8807 15.7223 13.1974C18.9371 12.6898 21.7484 13.5228 22.0998 13.6399C21.6573 16.4902 20.0173 18.9501 17.7136 20.4989Z" fill="white"/>\n</svg>',
  xtwitter:
    '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n<path fill-rule="evenodd" clip-rule="evenodd" d="M15.9455 23L10.396 15.0901L3.44886 23H0.509766L9.09209 13.2311L0.509766 1H8.05571L13.286 8.45502L19.8393 1H22.7784L14.5943 10.3165L23.4914 23H15.9455ZM19.2185 20.77H17.2398L4.71811 3.23H6.6971L11.7121 10.2532L12.5793 11.4719L19.2185 20.77Z" fill="white"/>\n</svg>',
};

export interface SocialIconProps extends HTMLAttributes<HTMLSpanElement> {
  platform?: 'facebook' | 'google' | 'apple' | 'figma' | 'dribbble' | 'xtwitter';
  state?: 'default';
  style?: 'white' | 'brand';
}

/** STUB contract auto-proposed for the nested "Social icon" instances of Social button — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries); the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry; the root renders the source component's exported vector glyph (SVG, iteration 8) in place of witness paints. Import the child set to replace this stub. */
export const SocialIcon = forwardRef<HTMLSpanElement, SocialIconProps>(function SocialIcon(
  { platform = 'facebook', state = 'default', style = 'white', className, children, ...rest },
  ref,
) {
  // axis-inert (ledgered, not a throw): platform, state, style — no `.<axis>-*` rule
  // exists in SocialIcon.module.css, so no class is composed for them. A reference
  // to an unemitted class resolves to `undefined` and is filtered out, so emitting
  // one only made a style-less axis LOOK styled. Whatever these axes carry rides
  // structure (a gated part, a per-value text/icon lookup, a child's own props) —
  // or, where the source drew no difference at all, nothing.
  const classes = [styles.root, className].filter(Boolean).join(' ');
  return (
    <span ref={ref} className={classes} {...rest}>
      <span
        className={styles.glyph}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: ICONS[platform] }}
      />
    </span>
  );
});
