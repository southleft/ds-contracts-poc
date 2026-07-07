/**
 * Package entry — the design system as an importable library.
 *
 * JS exports every generated component; the token stylesheets are bundled
 * into one CSS file that consumers import once:
 *
 *   import { Table, TableRow, TableCell } from 'ds-contracts-poc';
 *   import 'ds-contracts-poc/styles.css';
 */
import './styles/tokens.css';
import './styles/tokens.dark.css';
import './styles/tokens.brands.css';

export * from './components';
