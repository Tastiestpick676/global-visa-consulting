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
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { initializeUserAndApplication } from "@/lib/firebase/db";
import { PreApprovedUser, UserProfile, VisaApplication } from "@/types/visa";

// Políticas de Seguridad de Sesión: Ciclo de 8 horas en milisegundos
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

  // Vigilante de Expiración y Rotación de Token cada 8 Horas
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
        // Pasaron las 8 horas: forzamos renovación de token y cierre de sesión por seguridad bancaria
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

    // Revisión periódica cada 60 segundos + al recuperar el foco de la pestaña
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
        // Verificar si el sello de 8 horas ya expiró antes de hidratar
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

          unsubUser = onSnapshot(doc(db, "users", currentUser.uid), (snap) => {
            if (snap.exists()) {
              const userData = snap.data() as UserProfile;
              if (!userData.role) userData.role = "client";
              setProfile(userData);
            }
          });

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
    const cleanEmail = email.trim().toLowerCase();
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    const isValid = await ensureUserInitialized(cred.user);
    if (!isValid) {
      throw new Error("UNREGISTERED_USER");
    }
    // Forzamos un token fresco al iniciar la ventana de 8 horas
    await cred.user.getIdToken(true);
    stampSessionStart();
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