import { router } from 'expo-router';
import { useEffect } from 'react';

/**
 * Google sign-in returns to aisec://auth-callback. The browser session in `googleSignIn` reads that URL;
 * this route only stops the router from showing "page not found" and returns to where the learner was.
 */
export default function AuthCallback() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/account');
  }, []);
  return null;
}
