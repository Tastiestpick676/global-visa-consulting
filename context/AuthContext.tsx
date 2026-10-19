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
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { initializeUserAndApplication } from "@/lib/firebase/db";
import { PreApprovedUser, UserProfile, VisaApplication } from "@/types/visa";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  application: VisaApplication | null;
  loading: boolean;
  simulateClientView: boolean;
  setSimulateClientView: (val: boolean) => void;
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
  const [simulateClientView, setSimulateClientViewState] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("gvc_simulate_client");
      if (saved === "true") {
        setSimulateClientViewState(true);
      }
    }
  }, []);

  const setSimulateClientView = (val: boolean) => {
    setSimulateClientViewState(val);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("gvc_simulate_client", String(val));
    }
  };

  // Verifica o inicializa el usuario en su primer login
  const ensureUserInitialized = async (currentUser: User): Promise<boolean> => {
    try {
      const userSnap = await getDoc(doc(db, "users", currentUser.uid));
      const appSnap = await getDoc(doc(db, "applications", currentUser.uid));

      if (userSnap.exists() && appSnap.exists()) {
        return true;
      }

      const emailLower = (currentUser.email || "").trim().toLowerCase();
      if (!emailLower) {
        await firebaseSignOut(auth);
        return false;
      }

      const allowedSnap = await getDoc(doc(db, "allowed_emails", emailLower));

      if (allowedSnap.exists()) {
        const preData = allowedSnap.data() as PreApprovedUser;
        await initializeUserAndApplication(
          currentUser.uid,
          emailLower,
          preData.fullName || currentUser.displayName || "Usuario Autorizado",
          preData.destination || "USA",
          preData.role || "client",
          preData.planTier || "Priority Pro"
        );
        return true;
      }

      await firebaseSignOut(auth);
      return false;
    } catch {
      await firebaseSignOut(auth);
      return false;
    }
  };

  useEffect(() => {
    let unsubUser: (() => void) | null = null;
    let unsubApp: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (unsubUser) unsubUser();
      if (unsubApp) unsubApp();

      if (currentUser) {
        const isValid = await ensureUserInitialized(currentUser);
        if (isValid) {
          setUser(currentUser);

          // Escucha en TIEMPO REAL el perfil del usuario
          unsubUser = onSnapshot(doc(db, "users", currentUser.uid), (snap) => {
            if (snap.exists()) {
              const userData = snap.data() as UserProfile;
              if (!userData.role) userData.role = "client";
              setProfile(userData);
            }
          });

          // Escucha en TIEMPO REAL el expediente (cualquier cambio del Admin actualiza la vista del cliente al instante)
          unsubApp = onSnapshot(
            doc(db, "applications", currentUser.uid),
            (snap) => {
              if (snap.exists()) {
                setApplication(snap.data() as VisaApplication);
              }
              setLoading(false);
            }
          );
        } else {
          setUser(null);
          setProfile(null);
          setApplication(null);
          setLoading(false);
        }
      } else {
        setUser(null);
        setProfile(null);
        setApplication(null);
        setLoading(false);
      }
    });

    return () => {
      if (unsubUser) unsubUser();
      if (unsubApp) unsubApp();
      unsubscribeAuth();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const isValid = await ensureUserInitialized(cred.user);
    if (!isValid) {
      throw new Error("UNREGISTERED_USER");
    }
    setUser(cred.user);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(auth, provider);
    const isValid = await ensureUserInitialized(cred.user);
    if (!isValid) {
      throw new Error("UNREGISTERED_USER");
    }
    setUser(cred.user);
  };

  const signOut = async () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("gvc_simulate_client");
    }
    setSimulateClientViewState(false);
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
    setApplication(null);
  };

  const refreshApplication = async () => {
    if (user) {
      const appSnap = await getDoc(doc(db, "applications", user.uid));
      if (appSnap.exists()) {
        setApplication(appSnap.data() as VisaApplication);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        application,
        loading,
        simulateClientView,
        setSimulateClientView,
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