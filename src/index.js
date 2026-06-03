import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ── Mobile viewport height fix ──────────────────────────────────────────
// Android WebView (and mobile Safari) report 100vh as the full screen height
// including system bars, which pushes full-screen layouts off-screen.
// window.innerHeight always returns the correct VISIBLE height, so we
// expose it as a CSS variable --vh (1/100th of visible height) and use
// calc(var(--vh) * 100) instead of 100vh throughout the app.
function setVh() {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
}
setVh();
window.addEventListener('resize', setVh);
window.addEventListener('orientationchange', setVh);
// ────────────────────────────────────────────────────────────────────────

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
