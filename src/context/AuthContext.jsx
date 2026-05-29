/**
 * AuthContext.jsx
 *
 * Technician identity and session state via Firebase Auth.
 *
 * login()  — signs in with email + password via Firebase
 * logout() — signs out and clears local session
 *
 * Firebase persists the session automatically (indexedDB),
 * so technicians stay logged in across page reloads.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebaseService';
import { decryptAuthParam } from '../utils/urlAuth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // If the URL has an ?auth= param, we must keep loading=true until
  // the async decrypt + Firebase sign-in completes. Otherwise
  // onAuthStateChanged fires first (user=null) and briefly shows the login screen.
  const hasUrlAuth = new URLSearchParams(window.location.search).has('auth');
  const [urlAuthInProgress, setUrlAuthInProgress] = useState(hasUrlAuth);

  // ── URL-parameter auto-login (from mobile app) ─────────────────
  // Expected URL: https://rehantamang-a11y.github.io/Garuda/?auth=<ENCRYPTED_PAYLOAD>
  // The mobile app encrypts { email, password, ts } with AES-256-GCM and
  // encodes as base64url(iv) + '.' + base64url(ciphertext).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encryptedAuth = params.get('auth');
    if (!encryptedAuth) return;

    // Strip from address bar immediately so it never appears in browser history
    window.history.replaceState(null, '', window.location.pathname);

    const secretKey = process.env.REACT_APP_URL_AUTH_SECRET;
    if (!secretKey) {
      console.warn('[urlAuth] REACT_APP_URL_AUTH_SECRET is not configured.');
      setUrlAuthInProgress(false);
      return;
    }

    decryptAuthParam(encryptedAuth, secretKey)
      .then(({ email, password }) => {
        console.log('[urlAuth] Decryption successful, signing in:', email);
        return signInWithEmailAndPassword(auth, email, password);
      })
      .then(() => console.log('[urlAuth] Firebase sign-in successful.'))
      .catch(err => console.error('[urlAuth] Auto-login failed:', err.message))
      .finally(() => setUrlAuthInProgress(false)); // allow onAuthStateChanged to unlock loading
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore session on reload — only unlocks loading once URL auth is done
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, firebaseUser => {
      if (firebaseUser) {
        setUser({ email: firebaseUser.email, name: firebaseUser.displayName || firebaseUser.email });
      } else {
        setUser(null);
      }
      // Only stop the loading spinner once URL-auth is no longer in flight.
      // This prevents the login screen flashing before Firebase sign-in resolves.
      if (!urlAuthInProgress) {
        setLoading(false);
      }
    });
    return unsub;
  }, [urlAuthInProgress]);

  // When URL auth finishes (urlAuthInProgress → false), unlock loading.
  // onAuthStateChanged may not re-fire, so we force-unlock here.
  useEffect(() => {
    if (!urlAuthInProgress) {
      setLoading(false);
    }
  }, [urlAuthInProgress]);

  /**
   * Sign in with email + password.
   * Returns { success: true } or { success: false, error: string }.
   */
  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (err) {
      const msg =
        err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
          ? 'Incorrect email or password.'
          : err.code === 'auth/user-not-found'
          ? 'No account found with that email.'
          : err.code === 'auth/too-many-requests'
          ? 'Too many attempts. Try again later.'
          : 'Sign in failed. Please try again.';
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  if (loading) return null; // wait for Firebase to restore session

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
