/** Baseline-diff simulation: render the stage EMPTY, snapshot document.body's
 *  children, then mount one overlay component and snapshot again. This is the
 *  shape `portalSweep` uses to discover portaled roots. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  FluentProvider,
  webLightTheme,
  Button,
  Tooltip,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
} from '@fluentui/react-components';

type Which = 'none' | 'tooltip' | 'dialog' | 'popover' | 'menu' | 'plain';

function Stage() {
  const [which, setWhich] = useState<Which>('none');
  (window as unknown as { setWhich: (w: Which) => void }).setWhich = setWhich;
  return (
    <FluentProvider theme={webLightTheme}>
      <div id="stage">
        {which === 'plain' && <Button appearance="primary">Button</Button>}
        {which === 'tooltip' && (
          <Tooltip content="Tooltip content" relationship="label" visible>
            <Button>trigger</Button>
          </Tooltip>
        )}
        {which === 'dialog' && (
          <Dialog open modalType="modal">
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Dialog title</DialogTitle>
                <DialogContent>Dialog content</DialogContent>
                <DialogActions>
                  <Button appearance="primary">OK</Button>
                </DialogActions>
              </DialogBody>
            </DialogSurface>
          </Dialog>
        )}
        {which === 'popover' && (
          <Popover open>
            <PopoverTrigger disableButtonEnhancement>
              <Button>pop</Button>
            </PopoverTrigger>
            <PopoverSurface>popover content</PopoverSurface>
          </Popover>
        )}
        {which === 'menu' && (
          <Menu open>
            <MenuTrigger disableButtonEnhancement>
              <Button>menu</Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem>One</MenuItem>
                <MenuItem>Two</MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
      </div>
    </FluentProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Stage />);
