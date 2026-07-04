import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

addons.setConfig({
  theme: create({
    base: 'light',
    brandTitle: 'Design System Contracts',
    brandImage: 'logo-lockup.svg',
    brandUrl: 'https://github.com/southleft/ds-contracts-poc',
    brandTarget: '_blank',
  }),
});
