/**
 * UI Entry Point
 *
 * Initializes the Preact application and sets up plugin messaging.
 */

import { render } from 'preact';
import { App } from './App';

// Render the app
render(<App />, document.getElementById('app')!);
