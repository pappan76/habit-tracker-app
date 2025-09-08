// src/hooks/useAuth.js
import { useEffect } from "react";
import { auth, db } from "../firebase"; // Make sure db is exported from your firebase config
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { setDoc, doc } from "firebase/firestore"; // ✅ Add missing imports

const provider = new GoogleAuthProvider();

export function useAuth() {
  useEffect(() => {
    // Handle redirect result (mobile login)
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("Logged in with redirect:", result.user);
          // ✅ Save user after successful redirect login
          saveUserToFirestore(result.user);
        }
      })
      .catch((error) => {
        console.error("Redirect login error:", error);
      });
  }, []);

  // ✅ Save user details in Firestore
  const saveUserToFirestore = async (user) => {
    try {
      console.log("💾 Saving user details:", user); // Better logging
      
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          name: user.displayName || "",
          email: user.email || "",
          photoURL: user.photoURL || "",
          createdAt: new Date(), // ✅ Add timestamp
          lastLogin: new Date(), // ✅ Track last login
        },
        { merge: true } // update if already exists
      );
      
      console.log("✅ User saved successfully to Firestore");
    } catch (error) {
      console.error("❌ Error saving user:", error);
      throw error; // Re-throw so calling code can handle it
    }
  };

  const signInWithGoogle = async () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    try {
      if (isMobile) {
        // Mobile → use redirect
        await signInWithRedirect(auth, provider);
        // Note: saveUserToFirestore will be called in useEffect after redirect
      } else {
        // Desktop → use popup
        const result = await signInWithPopup(auth, provider);
        console.log("Logged in with popup:", result.user);
        
        // ✅ Save user after successful popup login
        await saveUserToFirestore(result.user);
      }
    } catch (error) {
      console.error("Google sign-in error:", error);
      throw error;
    }
  };

  // ✅ Return the function so it can be used elsewhere
  return { 
    signInWithGoogle, 
    saveUserToFirestore 
  };
}