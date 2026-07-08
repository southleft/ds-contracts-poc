# Proposed contracts — design-side extraction report

1 component set(s) extracted from the canvas dump. Every proposal parses against the contract schema. A proposal is a STARTING POINT: unbound values are NAMED below (never silently tokenized), and each note is a review line item.

## Alert

- proposed: 4 props
- semantics.element defaulted to "div" — element/role/ARIA are not drawn on the canvas; set the real host element
- Alert:root/container: visibility bound to BOOLEAN "hasIcon" — proposed as prop `hasicon` (default not recoverable from dump v1, review)
- Alert:root/container/Icon: nested instance of "check circle" has no known contract — component ref proposed as "ds.check-circle", review
- Alert:root/container/Icon: fixed prop values of the nested "check circle" instance are not captured in dump v1 — declared fidelity limit, author them if the instance is configured
- Alert:root/horizontal stack itemSpacing: variable name "spacing/0․5" contains characters outside the token-ref grammar ([a-z0-9.-]) — binding not proposed; rename the variable or map it manually
- Alert:root/horizontal stack/horizontal stack/Title: rides text style "body/md-bold" which is not a token-derived style — typography not proposed
- Alert:root/horizontal stack/horizontal stack/Description: rides text style "body/sm" which is not a token-derived style — typography not proposed
- Alert:root/horizontal stack/Text link: nested instance of "Text link" has no known contract — component ref proposed as "ds.text-link", review
- Alert:root/horizontal stack/Text link: fixed prop values of the nested "Text link" instance are not captured in dump v1 — declared fidelity limit, author them if the instance is configured

