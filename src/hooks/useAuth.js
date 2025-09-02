// src/hooks/useAuth.js
import { useEffect } from "react";
import { auth } from "../firebase"; // your firebase config
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";

const provider = new GoogleAuthProvider();

export function useAuth() {
  useEffect(() => {
    // Handle redirect result (mobile login)
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("Logged in with redirect:", result.user);
        }
      })
      .catch((error) => {
        console.error("Redirect login error:", error);
      });
  }, []);

  const signInWithGoogle = async () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    try {
      if (isMobile) {
        // Mobile → use redirect
        await signInWithRedirect(auth, provider);
      } else {
        // Desktop → use popup
        const result = await signInWithPopup(auth, provider);
        console.log("Logged in with popup:", result.user);
      }
    } catch (error) {
      console.error("Google sign-in error:", error);
    }
  };

  return { signInWithGoogle };
}
