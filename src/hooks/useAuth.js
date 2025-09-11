// src/hooks/useAuth.js
import { useState, useEffect } from "react";
import { auth, db } from "../firebase"; // Make sure db is exported from your firebase config
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { setDoc, doc, getDoc } from "firebase/firestore";

const provider = new GoogleAuthProvider();

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Enhanced mobile detection
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || window.innerWidth <= 768;
  };

  useEffect(() => {
    // Handle redirect result (mobile login)
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("Logged in with redirect:", result.user);
          saveUserToFirestore(result.user);
        }
      })
      .catch((error) => {
        console.error("Redirect login error:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Listen to authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  // Save user details in Firestore
  const saveUserToFirestore = async (user) => {
    try {
      console.log("💾 Saving user details:", user);
      
      // Check if user already exists to preserve creation date
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const existingData = userSnap.exists() ? userSnap.data() : {};
      
      await setDoc(
        userRef,
        {
          uid: user.uid,
          name: user.displayName || "",
          email: user.email || "",
          photoURL: user.photoURL || "",
          createdAt: existingData.createdAt || new Date(), // Preserve original creation date
          lastLogin: new Date(), // Update last login
          isActive: true,
        },
        { merge: true } // Update if already exists
      );
      
      console.log("✅ User saved successfully to Firestore");
    } catch (error) {
      console.error("❌ Error saving user:", error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    setIsSigningIn(true);
    
    try {
      if (isMobile()) {
        // Mobile → use redirect
        console.log("📱 Using redirect flow for mobile");
        await signInWithRedirect(auth, provider);
        // Note: saveUserToFirestore will be called in useEffect after redirect
      } else {
        // Desktop → use popup
        console.log("🖥️ Using popup flow for desktop");
        const result = await signInWithPopup(auth, provider);
        console.log("Logged in with popup:", result.user);
        
        // Save user after successful popup login
        await saveUserToFirestore(result.user);
        return result.user;
      }
    } catch (error) {
      console.error("Google sign-in error:", error);
      
      // Handle specific error cases
      if (error.code === 'auth/popup-closed-by-user') {
        console.log("User closed the popup");
      } else if (error.code === 'auth/cancelled-popup-request') {
        console.log("Popup request was cancelled");
      }
      
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      console.log("✅ User signed out successfully");
    } catch (error) {
      console.error("❌ Error signing out:", error);
      throw error;
    }
  };

  const updateUserProfile = async (updates) => {
    if (!user) {
      throw new Error("No user is currently signed in");
    }

    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        ...updates,
        lastUpdated: new Date(),
      }, { merge: true });
      
      console.log("✅ User profile updated successfully");
    } catch (error) {
      console.error("❌ Error updating user profile:", error);
      throw error;
    }
  };

  const getUserData = async (userId = user?.uid) => {
    if (!userId) {
      throw new Error("No user ID provided");
    }

    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return userSnap.data();
      } else {
        console.log("No user document found");
        return null;
      }
    } catch (error) {
      console.error("❌ Error getting user data:", error);
      throw error;
    }
  };

  // Admin-specific methods
  const checkIsAdmin = (userData = userProfile) => {
    return userData?.isAdmin === true;
  };

  const requireAdmin = () => {
    if (!user) {
      throw new Error("Authentication required");
    }
    if (!checkIsAdmin()) {
      throw new Error("Admin access required");
    }
    return true;
  };

  // Return all the functions and state
  return {
    // State
    user,
    userProfile,
    isLoading,
    isSigningIn,
    isAuthenticated: !!user,
    isAdmin: checkIsAdmin(),
    
    // Authentication methods
    signInWithGoogle,
    signOut,
    
    // User data methods
    saveUserToFirestore,
    updateUserProfile,
    getUserData,
    
    // Admin methods
    checkIsAdmin,
    requireAdmin,
  };
}