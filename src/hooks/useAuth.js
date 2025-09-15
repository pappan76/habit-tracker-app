// src/hooks/useAuth.js
import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
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
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Enhanced mobile detection
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || window.innerWidth <= 768;
  };

  // Ensure user document exists with all required fields for game planning
  const ensureUserDocumentExists = async (user) => {
    if (!user?.uid) return null;
    
    try {
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      
      let userData;
      
      if (!userDoc.exists()) {
        // Create new user document with all required fields
        userData = {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "",
          name: user.displayName || user.name || "",
          photoURL: user.photoURL || "",
          // Game planning specific fields
          selectedUplines: [],
          partnerId: null,
          role: "User",
          isActive: true,
          // Timestamps
          createdAt: new Date(),
          lastLogin: new Date(),
          lastUpdated: new Date()
        };
        
        await setDoc(userRef, userData);
        console.log("User document created with game planning fields:", user.uid);
        
        return userData;
      } else {
        // Update existing document to ensure all required fields exist
        const existingData = userDoc.data();
        
        const updatedData = {
          // Preserve existing data
          ...existingData,
          // Ensure auth fields are current
          email: user.email || existingData.email || "",
          displayName: user.displayName || existingData.displayName || "",
          name: user.displayName || user.name || existingData.name || "",
          photoURL: user.photoURL || existingData.photoURL || "",
          // Ensure game planning fields exist with defaults
          selectedUplines: existingData.selectedUplines || [],
          partnerId: existingData.partnerId || null,
          role: existingData.role || "User",
          isActive: existingData.isActive !== undefined ? existingData.isActive : true,
          // Update timestamps
          lastLogin: new Date(),
          lastUpdated: new Date(),
          // Preserve creation date
          createdAt: existingData.createdAt || new Date()
        };
        
        await setDoc(userRef, updatedData, { merge: true });
        console.log("User document updated with required fields:", user.uid);
        
        return updatedData;
      }
    } catch (error) {
      console.error("Error ensuring user document exists:", error);
      return null;
    }
  };

  useEffect(() => {
    // Handle redirect result (mobile login)
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          console.log("Logged in with redirect:", result.user);
          const userData = await ensureUserDocumentExists(result.user);
          setUserProfile(userData);
        }
      })
      .catch((error) => {
        console.error("Redirect login error:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Listen to authentication state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // Ensure user document exists and get the complete profile
        const userData = await ensureUserDocumentExists(user);
        setUserProfile(userData);
      } else {
        setUserProfile(null);
      }
      
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  // Legacy function maintained for backward compatibility
  const saveUserToFirestore = async (user) => {
    return await ensureUserDocumentExists(user);
  };

  const signInWithGoogle = async () => {
    setIsSigningIn(true);
    
    try {
      if (isMobile()) {
        // Mobile → use redirect
        console.log("Using redirect flow for mobile");
        await signInWithRedirect(auth, provider);
        // Note: ensureUserDocumentExists will be called in useEffect after redirect
      } else {
        // Desktop → use popup
        console.log("Using popup flow for desktop");
        const result = await signInWithPopup(auth, provider);
        console.log("Logged in with popup:", result.user);
        
        // Ensure user document exists after successful popup login
        const userData = await ensureUserDocumentExists(result.user);
        setUserProfile(userData);
        
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
      setUserProfile(null);
      console.log("User signed out successfully");
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  const updateUserProfile = async (updates) => {
    if (!user) {
      throw new Error("No user is currently signed in");
    }

    try {
      const userRef = doc(db, "users", user.uid);
      const updatedData = {
        ...updates,
        lastUpdated: new Date(),
      };
      
      await setDoc(userRef, updatedData, { merge: true });
      
      // Update local profile state
      setUserProfile(prev => ({ ...prev, ...updatedData }));
      
      console.log("User profile updated successfully");
      return updatedData;
    } catch (error) {
      console.error("Error updating user profile:", error);
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
      console.error("Error getting user data:", error);
      throw error;
    }
  };

  // Refresh user profile from Firestore
  const refreshUserProfile = async () => {
    if (!user?.uid) return null;
    
    try {
      const userData = await getUserData(user.uid);
      setUserProfile(userData);
      return userData;
    } catch (error) {
      console.error("Error refreshing user profile:", error);
      return null;
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

  // Game planning specific helper methods
  const hasPartner = () => {
    return userProfile?.partnerId != null;
  };

  const getPartnerInfo = async () => {
    if (!hasPartner()) return null;
    
    try {
      return await getUserData(userProfile.partnerId);
    } catch (error) {
      console.error("Error getting partner info:", error);
      return null;
    }
  };

  const getUplines = () => {
    return userProfile?.selectedUplines || [];
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
    saveUserToFirestore, // Legacy - now calls ensureUserDocumentExists
    ensureUserDocumentExists,
    updateUserProfile,
    getUserData,
    refreshUserProfile,
    
    // Game planning specific methods
    hasPartner,
    getPartnerInfo,
    getUplines,
    
    // Admin methods
    checkIsAdmin,
    requireAdmin,
  };
}