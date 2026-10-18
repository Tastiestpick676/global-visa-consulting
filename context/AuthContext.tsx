// context/AuthContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { initializeUserAndApplication } from "@/lib/firebase/db";
import { PreApprovedUser, UserProfile, VisaApplication } from "@/types/visa";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  application: VisaApplication | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshApplication: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [application, setApplication] = useState<VisaApplication | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (currentUser: User) => {
    try {
      const userSnap = await getDoc(doc(db, "users", currentUser.uid));
      const appSnap = await getDoc(doc(db, "applications", currentUser.uid));

      // 1. Si el usuario ya tiene perfil creado en Firestore, entra directo
      if (userSnap.exists() && appSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        // Retrocompatibilidad por si el documento se creó antes de existir el campo 'role'
        if (!userData.role) {
          userData.role = "client";
        }
        setProfile(userData);
        setApplication(appSnap.data() as VisaApplication);
        return true;
      }

      // 2. Si entra por primera vez, verificamos si fue pre-autorizado en 'allowed_emails'
      const emailLower = (currentUser.email || "").trim().toLowerCase();
      if (!emailLower) {
        await firebaseSignOut(auth);
        return false;
      }

      const allowedSnap = await getDoc(doc(db, "allowed_emails", emailLower));

      if (allowedSnap.exists()) {
        const preData = allowedSnap.data() as PreApprovedUser;
        const initialized = await initializeUserAndApplication(
          currentUser.uid,
          emailLower,
          preData.fullName || currentUser.displayName || "Usuario Autorizado",
          preData.destination || "USA",
          preData.role || "client",
          preData.planTier || "Priority Pro"
        );
        setProfile(initialized.profile);
        setApplication(initialized.application);
        return true;
      }

      // 3. Si no está en 'users' ni en 'allowed_emails', denegamos acceso
      await firebaseSignOut(auth);
      return false;
    } catch {
      await firebaseSignOut(auth);
      return false;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const isValid = await fetchUserData(currentUser);
        if (isValid) {
          setUser(currentUser);
        } else {
          setUser(null);
          setProfile(null);
          setApplication(null);
        }
      } else {
        setUser(null);
        setProfile(null);
        setApplication(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const isValid = await fetchUserData(cred.user);
    if (!isValid) {
      throw new Error("UNREGISTERED_USER");
    }
    setUser(cred.user);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(auth, provider);
    const isValid = await fetchUserData(cred.user);
    if (!isValid) {
      throw new Error("UNREGISTERED_USER");
    }
    setUser(cred.user);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
    setApplication(null);
  };

  const refreshApplication = async () => {
    if (user) {
      await fetchUserData(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        application,
        loading,
        signIn,
        signInWithGoogle,
        signOut,
        refreshApplication,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe utilizarse dentro de un AuthProvider");
  }
  return context;
}