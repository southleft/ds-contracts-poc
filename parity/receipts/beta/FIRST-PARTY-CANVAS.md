# First-party both-sides — canvas vs authored contracts

Recorded 2026-08-16 on `BMjUA2ue5CaZXU4kufxL0z` (Latest DS Contracts Tests).
Read-only inventory. This is the system that already has **both** a contract
catalog (`contracts/*.contract.json`, 56 stems) and a live canvas.

## On the canvas (13 sets)

Avatar, Badge, Button, Banner, Checkbox, Divider, Switch, TextField, Token,
BentoGrid, Toolbar, TopNavItem, plus a Slots Recon probe.

## Authored and not on this file (named gap)

43 of 56 first-party contracts have no set on this file. That is coverage,
not drift. The 13 that are present carry the expected Figma property kinds
(VARIANT / BOOLEAN / TEXT / SLOT).

## Standing

- Events live on the contract (Switch `onToggle`, Checkbox, AccordionItem).
  The canvas shows value/state as variants. Same rule as Flowbite.
- Do not write `Y8Jhw6R49wTLuXZ0is2GmV`.
- Switch both-sides dump → propose is done: [SWITCH-BOTH-SIDES.md](./SWITCH-BOTH-SIDES.md).
  Props and token-bound paints align. Events, host, native input, and some
  spacing/type tokens do not. Re-apply from the authored contract is the next
  close (stamps), not inventing `onToggle` from the canvas.
