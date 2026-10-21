// context/AuthContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { initializeUserAndApplication } from "@/lib/firebase/db";
import { PreApprovedUser, UserProfile, VisaApplication } from "@/types/visa";

const SESSION_MAX_DURATION_MS = 8 * 60 * 60 * 1000; // 8 Horas
const SESSION_STORAGE_KEY = "gvc_session_issued_at";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  application: VisaApplication | null;
  loading: boolean;
  simulateClientView: boolean;
  setSimulateClientView: (val: boolean) => void;
  signIn: (email: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
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
    // Garantizar persistencia local de sesión en todas las rutas del navegador
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  }, []);

  const setSimulateClientView = (val: boolean) => {
    setSimulateClientViewState(val);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("gvc_simulate_client", String(val));
    }
  };

  const stampSessionStart = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(SESSION_STORAGE_KEY, String(Date.now()));
    }
  };

  const clearSessionStamp = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem("gvc_simulate_client");
    }
  };

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

  // Vigilante de Expiración y Renovación de Token cada 8 Horas
  useEffect(() => {
    if (!user || typeof window === "undefined") return;

    const checkAndRotateToken = async () => {
      const issuedRaw = localStorage.getItem(SESSION_STORAGE_KEY);
      const now = Date.now();

      if (!issuedRaw) {
        stampSessionStart();
        return;
      }

      const elapsed = now - Number(issuedRaw);

      if (elapsed >= SESSION_MAX_DURATION_MS) {
        try {
          await user.getIdToken(true);
        } catch {}
        clearSessionStamp();
        setSimulateClientViewState(false);
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        setApplication(null);
        window.location.href = "/login?reason=session_expired";
      }
    };

    checkAndRotateToken();

    const interval = setInterval(checkAndRotateToken, 60 * 1000);
    window.addEventListener("focus", checkAndRotateToken);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", checkAndRotateToken);
    };
  }, [user]);

  useEffect(() => {
    let unsubUser: (() => void) | null = null;
    let unsubApp: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (unsubUser) unsubUser();
      if (unsubApp) unsubApp();

      if (currentUser) {
        if (typeof window !== "undefined") {
          const issuedRaw = localStorage.getItem(SESSION_STORAGE_KEY);
          if (
            issuedRaw &&
            Date.now() - Number(issuedRaw) >= SESSION_MAX_DURATION_MS
          ) {
            clearSessionStamp();
            await firebaseSignOut(auth);
            setUser(null);
            setProfile(null);
            setApplication(null);
            setLoading(false);
            return;
          }
          if (!issuedRaw) {
            stampSessionStart();
          }
        }

        const isValid = await ensureUserInitialized(currentUser);
        if (isValid) {
          setUser(currentUser);

          let userReady = false;
          let appReady = false;

          unsubUser = onSnapshot(doc(db, "users", currentUser.uid), (snap) => {
            if (snap.exists()) {
              const userData = snap.data() as UserProfile;
              if (!userData.role) userData.role = "client";
              setProfile(userData);
            }
            userReady = true;
            if (userReady && appReady) setLoading(false);
          });

          unsubApp = onSnapshot(
            doc(db, "applications", currentUser.uid),
            (snap) => {
              if (snap.exists()) {
                setApplication(snap.data() as VisaApplication);
              }
              appReady = true;
              if (userReady && appReady) setLoading(false);
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
    const cleanEmail = email.trim().toLowerCase();
    await setPersistence(auth, browserLocalPersistence);
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    const isValid = await ensureUserInitialized(cred.user);
    if (!isValid) {
      throw new Error("UNREGISTERED_USER");
    }
    await cred.user.getIdToken(true);
    stampSessionStart();
    setUser(cred.user);
  };

  const signInWithGoogle = async () => {
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(auth, provider);
    const isValid = await ensureUserInitialized(cred.user);
    if (!isValid) {
      throw new Error("UNREGISTERED_USER");
    }
    await cred.user.getIdToken(true);
    stampSessionStart();
    setUser(cred.user);
  };

  const requestPasswordReset = async (rawEmail: string) => {
    const cleanEmail = rawEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    const actionCodeSettings = {
      url:
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : "http://localhost:3000/reset-password",
      handleCodeInApp: false,
    };

    try {
      const allowedSnap = await getDoc(doc(db, "allowed_emails", cleanEmail));
      if (!allowedSnap.exists()) {
        return;
      }

      try {
        await sendPasswordResetEmail(auth, cleanEmail, actionCodeSettings);
      } catch (err: any) {
        if (
          err?.code === "auth/user-not-found" ||
          err?.code === "auth/invalid-email"
        ) {
          const randomEntropy = `Gvc#${crypto.randomUUID()}!9a`;
          const newCred = await createUserWithEmailAndPassword(
            auth,
            cleanEmail,
            randomEntropy
          );
          await ensureUserInitialized(newCred.user);
          await firebaseSignOut(auth);
          await sendPasswordResetEmail(auth, cleanEmail, actionCodeSettings);
        }
      }
    } catch {}
  };

  const signOut = async () => {
    clearSessionStamp();
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
        requestPasswordReset,
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