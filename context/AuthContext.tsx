// context/AuthContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { initializeUserAndApplication } from "@/lib/firebase/db";
import { DestinationCountry, UserProfile, VisaApplication } from "@/types/visa";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  application: VisaApplication | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (
    email: string,
    pass: string,
    fullName: string,
    destination: DestinationCountry
  ) => Promise<void>;
  signInWithGoogle: (destination?: DestinationCountry) => Promise<void>;
  signOut: () => Promise<void>;
  refreshApplication: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [application, setApplication] = useState<VisaApplication | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (currentUser: User, defaultDestination: DestinationCountry = "USA") => {
    try {
      const userSnap = await getDoc(doc(db, "users", currentUser.uid));
      const appSnap = await getDoc(doc(db, "applications", currentUser.uid));

      if (userSnap.exists() && appSnap.exists()) {
        setProfile(userSnap.data() as UserProfile);
        setApplication(appSnap.data() as VisaApplication);
      } else {
        const initialized = await initializeUserAndApplication(
          currentUser.uid,
          currentUser.email || "",
          currentUser.displayName || "Cliente Titular",
          defaultDestination
        );
        setProfile(initialized.profile);
        setApplication(initialized.application);
      }
    } catch {
      // Cero console.log de datos sensibles en producción (Directiva 5.1)
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchUserData(currentUser);
      } else {
        setProfile(null);
        setApplication(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUp = async (
    email: string,
    pass: string,
    fullName: string,
    destination: DestinationCountry
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const initialized = await initializeUserAndApplication(
      cred.user.uid,
      email,
      fullName,
      destination
    );
    setProfile(initialized.profile);
    setApplication(initialized.application);
  };

  const signInWithGoogle = async (destination: DestinationCountry = "USA") => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(auth, provider);
    await fetchUserData(cred.user, destination);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
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
        signUp,
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