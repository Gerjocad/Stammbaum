import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Version = Nummer des Pull Requests. In der PR-Vorschau setzt der Workflow
// APP_VERSION, auf main steht die Nummer im Merge-Commit ("Merge pull request #8 …").
function appVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    const subject = execSync('git log -1 --format=%s', { encoding: 'utf8' });
    const match = subject.match(/#(\d+)/);
    if (match) return match[1];
  } catch {
    // Kein git verfügbar.
  }
  return 'dev';
}

// Relative base so the build works on GitHub Pages under /Stammbaum/.
export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
});
