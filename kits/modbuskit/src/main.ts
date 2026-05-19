import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
  declare global {
    interface Window {
      MB_APP?: {
        resetStorage: () => void;
        printLibraryToConsole: () => void;
        exportLibrary: () => void;
        importLibrary: (json: string) => void;
        importLibraryFromFile: () => void;
        importFromLegacy: () => void;
      };
    }
  }
const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
