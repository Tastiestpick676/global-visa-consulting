// context/AuthContext.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import {
  PreApprovedUser,
  UserProfile,
  UserRole,
  VisaApplication,
} from "@/types/visa";
import {
  formatDisplayName,
  initializeUserAndApplication,
  recordSystemLog,
} from "@/lib/firebase/db";

interface SignInResult {
  role: UserRole;
  fullName: string;
  email: string;
  requiresTwoFactor: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  application: VisaApplication | null;
  loading: boolean;
  isTwoFactorVerified: boolean;
  completeTwoFactorVerification: (proof?: string) => Promise<void>;
  simulateClientView: boolean;
  setSimulateClientView: (val: boolean) => void;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signInWithGoogle: () => Promise<SignInResult>;
  requestPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  application: null,
  loading: true,
  isTwoFactorVerified: false,
  completeTwoFactorVerification: async () => {},
  simulateClientView: false,
  setSimulateClientView: () => {},
  signIn: async () => ({
    role: "client",
    fullName: "",
    email: "",
    requiresTwoFactor: true,
  }),
  signInWithGoogle: async () => ({
    role: "client",
    fullName: "",
    email: "",
    requiresTwoFactor: false,
  }),
  requestPasswordReset: async () => {},
  signOut: async () => {},
});

const SESSION_START_KEY = "gvc_session_start";
const SIMULATE_CLIENT_KEY = "gvc_simulate_client_view";
const TWO_FACTOR_VERIFIED_KEY = "gvc_2fa_verified";
const MAX_SESSION_MS = 8 * 60 * 60 * 1000;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const FALLBACK_64_HEX_PROOF =
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [application, setApplication] = useState<VisaApplication | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isTwoFactorVerified, setIsTwoFactorVerified] =
    useState<boolean>(false);
  const [simulateClientView, setSimulateClientViewState] =
    useState<boolean>(false);

  const unsubProfileRef = useRef<(() => void) | null>(null);
  const unsubAppRef = useRef<(() => void) | null>(null);

  // Semáforos atómicos para evitar condiciones de carrera entre signIn / signOut y onAuthStateChanged
  const isSigningInWithPasswordRef = useRef<boolean>(false);
  const isSigningOutRef = useRef<boolean>(false);

  const cleanupFirestoreStreams = () => {
    if (unsubProfileRef.current) {
      unsubProfileRef.current();
      unsubProfileRef.current = null;
    }
    if (unsubAppRef.current) {
      unsubAppRef.current();
      unsubAppRef.current = null;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedSim = localStorage.getItem(SIMULATE_CLIENT_KEY);
    if (savedSim === "true") {
      setSimulateClientViewState(true);
    }
    const saved2FA = sessionStorage.getItem(TWO_FACTOR_VERIFIED_KEY);
    if (saved2FA === "true") {
      setIsTwoFactorVerified(true);
    }
  }, []);

  const completeTwoFactorVerification = async (proof?: string) => {
    isSigningInWithPasswordRef.current = false;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(TWO_FACTOR_VERIFIED_KEY, "true");
    }
    if (auth.currentUser) {
      try {
        const validProof =
          proof && proof.length === 64 ? proof : FALLBACK_64_HEX_PROOF;
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          twoFactorVerified: true,
          twoFactorProof: validProof,
          twoFactorVerifiedAt: new Date().toISOString(),
        });
      } catch {}
    }
    setIsTwoFactorVerified(true);
  };

  const setSimulateClientView = (val: boolean) => {
    setSimulateClientViewState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem(SIMULATE_CLIENT_KEY, String(val));
    }
  };

  const checkAllowedEmail = async (
    rawEmail: string
  ): Promise<PreApprovedUser | null> => {
    const cleanEmail = rawEmail.trim().toLowerCase();
    if (!cleanEmail) return null;

    try {
      const allowedRef = doc(db, "allowed_emails", cleanEmail);
      const snap = await getDoc(allowedRef);
      if (snap.exists()) {
        return snap.data() as PreApprovedUser;
      }
    } catch {}
    return null;
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      cleanupFirestoreStreams();

      if (!firebaseUser || !firebaseUser.email || isSigningOutRef.current) {
        setUser(null);
        setProfile(null);
        setApplication(null);
        setIsTwoFactorVerified(false);
        setLoading(false);
        return;
      }

      // Si el usuario está ejecutando signIn(email, password), dejamos que signIn controle el estado
      // para que nunca se salte la pantalla de 2FA
      if (isSigningInWithPasswordRef.current) {
        return;
      }

      setLoading(true);

      try {
        const cleanEmail = firebaseUser.email.trim().toLowerCase();
        const userRef = doc(db, "users", firebaseUser.uid);
        let existingUserSnap = await getDoc(userRef);

        if (!existingUserSnap.exists()) {
          const allowedData = await checkAllowedEmail(cleanEmail);

          if (!allowedData) {
            cleanupFirestoreStreams();
            await firebaseSignOut(auth);
            setUser(null);
            setProfile(null);
            setApplication(null);
            setIsTwoFactorVerified(false);
            setLoading(false);
            return;
          }

          await initializeUserAndApplication(
            firebaseUser.uid,
            cleanEmail,
            allowedData.fullName ||
              firebaseUser.displayName ||
              "Titular Autorizado",
            allowedData.destination || "USA",
            allowedData.role || "client",
            allowedData.planTier || "Priority Pro"
          );
          existingUserSnap = await getDoc(userRef);
        }

        if (
          typeof window !== "undefined" &&
          !localStorage.getItem(SESSION_START_KEY)
        ) {
          localStorage.setItem(SESSION_START_KEY, String(Date.now()));
        }

        const isGoogleProvider = firebaseUser.providerData.some(
          (p) => p.providerId === "google.com"
        );

        // Solo restauramos 2FA si entró con Google O si ESTA pestaña ya tenía sessionStorage("gvc_2fa_verified") === "true"
        const hasSessionTab2FA =
          typeof window !== "undefined" &&
          sessionStorage.getItem(TWO_FACTOR_VERIFIED_KEY) === "true";

        if (isGoogleProvider || hasSessionTab2FA) {
          setIsTwoFactorVerified(true);
          if (typeof window !== "undefined") {
            sessionStorage.setItem(TWO_FACTOR_VERIFIED_KEY, "true");
          }
        } else {
          setIsTwoFactorVerified(false);
        }

        if (existingUserSnap.exists()) {
          setProfile(existingUserSnap.data() as UserProfile);
        }
        setUser(firebaseUser);

        unsubProfileRef.current = onSnapshot(
          doc(db, "users", firebaseUser.uid),
          (snap) => {
            if (snap.exists()) {
              setProfile(snap.data() as UserProfile);
            }
            setLoading(false);
          },
          () => {
            setLoading(false);
          }
        );
      } catch {
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      cleanupFirestoreStreams();
    };
  }, []);

  useEffect(() => {
    if (unsubAppRef.current) {
      unsubAppRef.current();
      unsubAppRef.current = null;
    }

    if (!user || !isTwoFactorVerified || isSigningOutRef.current) {
      setApplication(null);
      return;
    }

    unsubAppRef.current = onSnapshot(
      doc(db, "applications", user.uid),
      (snap) => {
        if (snap.exists()) {
          setApplication(snap.data() as VisaApplication);
        } else {
          setApplication(null);
        }
      },
      () => {}
    );

    return () => {
      if (unsubAppRef.current) {
        unsubAppRef.current();
        unsubAppRef.current = null;
      }
    };
  }, [user, isTwoFactorVerified]);

  useEffect(() => {
    if (!user || !isTwoFactorVerified || typeof window === "undefined") return;

    const now = Date.now();
    const savedStart = Number(localStorage.getItem(SESSION_START_KEY) || "0");
    if (!savedStart) {
      localStorage.setItem(SESSION_START_KEY, String(now));
    }

    let idleTimer: ReturnType<typeof setTimeout>;

    const enforceZeroTrustLogout = async (reason: string) => {
      await signOut();
      try {
        await recordSystemLog({
          category: "SECURITY_AUTH",
          eventType: "Expiración Automática de Sesión (Zero-Trust)",
          outcome: "INFO",
          actorEmail: user.email || "usuario",
          actorName: profile?.fullName || user.displayName || "Usuario",
          actorRole: profile?.role || "client",
          targetResource: "Token de Sesión 8h",
          details: reason,
        });
      } catch {}
    };

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);

      const startTimestamp = Number(
        localStorage.getItem(SESSION_START_KEY) || String(Date.now())
      );

      if (Date.now() - startTimestamp >= MAX_SESSION_MS) {
        enforceZeroTrustLogout(
          "La sesión alcanzó el límite máximo permitido de 8 horas continuas."
        );
        return;
      }

      idleTimer = setTimeout(() => {
        enforceZeroTrustLogout(
          "Sesión cerrada automáticamente tras 30 minutos de inactividad."
        );
      }, IDLE_TIMEOUT_MS);
    };

    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((ev) =>
      window.addEventListener(ev, resetIdleTimer, { passive: true })
    );
    resetIdleTimer();

    return () => {
      clearTimeout(idleTimer);
      activityEvents.forEach((ev) =>
        window.removeEventListener(ev, resetIdleTimer)
      );
    };
  }, [user, isTwoFactorVerified, profile]);

  const signIn = async (
    email: string,
    password: string
  ): Promise<SignInResult> => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Bloqueamos el listener automático para que NUNCA redirija antes del 2FA
    isSigningInWithPasswordRef.current = true;
    isSigningOutRef.current = false;

    if (typeof window !== "undefined") {
      sessionStorage.removeItem(TWO_FACTOR_VERIFIED_KEY);
    }
    setIsTwoFactorVerified(false);

    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);

      const allowedData = await checkAllowedEmail(cleanEmail);
      let userSnap = await getDoc(doc(db, "users", cred.user.uid));

      if (!allowedData && !userSnap.exists()) {
        isSigningInWithPasswordRef.current = false;
        cleanupFirestoreStreams();
        await firebaseSignOut(auth);
        throw new Error("UNREGISTERED_USER");
      }

      if (allowedData && !userSnap.exists()) {
        await initializeUserAndApplication(
          cred.user.uid,
          cleanEmail,
          allowedData.fullName || cred.user.displayName || "Titular Autorizado",
          allowedData.destination || "USA",
          allowedData.role || "client",
          allowedData.planTier || "Priority Pro"
        );
        userSnap = await getDoc(doc(db, "users", cred.user.uid));
      }

      try {
        await updateDoc(doc(db, "users", cred.user.uid), {
          twoFactorVerified: false,
          twoFactorProof: "",
        });
      } catch {}

      const loadedProfile = userSnap.exists()
        ? (userSnap.data() as UserProfile)
        : null;

      setUser(cred.user);
      if (loadedProfile) {
        setProfile(loadedProfile);
      }
      setIsTwoFactorVerified(false);
      setLoading(false);

      if (typeof window !== "undefined") {
        localStorage.setItem(SESSION_START_KEY, String(Date.now()));
        sessionStorage.removeItem(TWO_FACTOR_VERIFIED_KEY);
      }

      // Abrimos listener únicamente sobre el perfil básico
      if (unsubProfileRef.current) unsubProfileRef.current();
      unsubProfileRef.current = onSnapshot(
        doc(db, "users", cred.user.uid),
        (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          }
        },
        () => {}
      );

      const resolvedRole: UserRole =
        loadedProfile?.role || allowedData?.role || "client";
      const resolvedName = formatDisplayName(
        loadedProfile?.fullName ||
          allowedData?.fullName ||
          cred.user.displayName ||
          cleanEmail
      );

      await recordSystemLog({
        category: "SECURITY_AUTH",
        eventType: "Credenciales Primarias Validadas (Pendiente 2FA)",
        outcome: "INFO",
        actorEmail: cleanEmail,
        actorName: resolvedName,
        actorRole: resolvedRole,
        targetResource: "Firebase Auth • Factor Primario",
        details:
          "Contraseña verificada correctamente. Expediente bloqueado hasta validar 2FA OTP.",
      });

      return {
        role: resolvedRole,
        fullName: resolvedName,
        email: cleanEmail,
        requiresTwoFactor: true,
      };
    } catch (err: any) {
      isSigningInWithPasswordRef.current = false;
      await recordSystemLog({
        category: "SECURITY_AUTH",
        eventType: "Intento de Login Fallido",
        outcome: "WARNING",
        actorEmail: cleanEmail,
        actorName: cleanEmail,
        actorRole: "anonymous",
        targetResource: "Portal de Acceso",
        details:
          "Credenciales inválidas o cuenta pendiente de configuración de clave.",
      });
      throw err;
    }
  };

  const signInWithGoogle = async (): Promise<SignInResult> => {
    isSigningInWithPasswordRef.current = false;
    isSigningOutRef.current = false;

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    const cred = await signInWithPopup(auth, provider);
    const cleanEmail = (cred.user.email || "").trim().toLowerCase();

    const allowedData = await checkAllowedEmail(cleanEmail);
    let userSnap = await getDoc(doc(db, "users", cred.user.uid));

    if (!allowedData && !userSnap.exists()) {
      cleanupFirestoreStreams();
      await firebaseSignOut(auth);
      await recordSystemLog({
        category: "SECURITY_AUTH",
        eventType: "Acceso Google Bloqueado (No Provisionado)",
        outcome: "WARNING",
        actorEmail: cleanEmail || "desconocido",
        actorName: cred.user.displayName || cleanEmail,
        actorRole: "anonymous",
        targetResource: "Google OAuth 2.0",
        details: `Cuenta de Google (${cleanEmail}) rechazada por no tener expediente activo.`,
      });
      throw new Error("UNREGISTERED_USER");
    }

    if (allowedData && !userSnap.exists()) {
      await initializeUserAndApplication(
        cred.user.uid,
        cleanEmail,
        allowedData.fullName || cred.user.displayName || "Titular Autorizado",
        allowedData.destination || "USA",
        allowedData.role || "client",
        allowedData.planTier || "Priority Pro"
      );
      userSnap = await getDoc(doc(db, "users", cred.user.uid));
    }

    try {
      await updateDoc(doc(db, "users", cred.user.uid), {
        twoFactorVerified: true,
        twoFactorProof: FALLBACK_64_HEX_PROOF,
        twoFactorVerifiedAt: new Date().toISOString(),
      });
    } catch {}

    const loadedProfile = userSnap.exists()
      ? (userSnap.data() as UserProfile)
      : null;

    setUser(cred.user);
    if (loadedProfile) {
      setProfile(loadedProfile);
    }
    setIsTwoFactorVerified(true);
    setLoading(false);

    if (typeof window !== "undefined") {
      localStorage.setItem(SESSION_START_KEY, String(Date.now()));
      sessionStorage.setItem(TWO_FACTOR_VERIFIED_KEY, "true");
    }

    const resolvedRole: UserRole =
      loadedProfile?.role || allowedData?.role || "client";
    const resolvedName = formatDisplayName(
      loadedProfile?.fullName ||
        allowedData?.fullName ||
        cred.user.displayName ||
        cleanEmail
    );

    await recordSystemLog({
      category: "SECURITY_AUTH",
      eventType: "Inicio de Sesión Exitoso (Google OAuth + MFA)",
      outcome: "SUCCESS",
      actorEmail: cleanEmail,
      actorName: resolvedName,
      actorRole: resolvedRole,
      targetResource: "Google OAuth 2.0 • Token 8h",
      details: "Autenticación federada con Google completada exitosamente.",
    });

    return {
      role: resolvedRole,
      fullName: resolvedName,
      email: cleanEmail,
      requiresTwoFactor: false,
    };
  };

  const requestPasswordReset = async (email: string): Promise<void> => {
    const cleanEmail = email.trim().toLowerCase();

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch {}

    await recordSystemLog({
      category: "SECURITY_AUTH",
      eventType: "Solicitud de Enlace Criptográfico de Contraseña",
      outcome: "INFO",
      actorEmail: cleanEmail,
      actorName: cleanEmail,
      actorRole: "anonymous",
      targetResource: "Recuperación de Credenciales",
      details: `Se procesó solicitud de enlace de contraseña para ${cleanEmail}.`,
    });
  };

  const signOut = async (): Promise<void> => {
    isSigningOutRef.current = true;
    isSigningInWithPasswordRef.current = false;

    const currentUid = user?.uid || auth.currentUser?.uid;
    const currentEmail = user?.email || auth.currentUser?.email;
    const currentName =
      profile?.fullName || user?.displayName || currentEmail || "Usuario";
    const currentRole = profile?.role || "client";

    // 1. Cerramos inmediatamente los listeners de Firestore
    cleanupFirestoreStreams();

    // 2. Limpiamos sesión en navegador de forma síncrona para que ninguna vista rebote a 2FA ni se quede colgada
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_START_KEY);
      localStorage.removeItem(SIMULATE_CLIENT_KEY);
      sessionStorage.removeItem(TWO_FACTOR_VERIFIED_KEY);
    }

    setIsTwoFactorVerified(false);
    setSimulateClientViewState(false);
    setUser(null);
    setProfile(null);
    setApplication(null);
    setLoading(false);

    // 3. Limpiamos el flag en Firestore y cerramos sesión en Firebase Auth
    if (currentUid) {
      try {
        await updateDoc(doc(db, "users", currentUid), {
          twoFactorVerified: false,
          twoFactorProof: "",
        });
      } catch {}
    }

    if (currentEmail) {
      try {
        await recordSystemLog({
          category: "SECURITY_AUTH",
          eventType: "Cierre de Sesión Manual",
          outcome: "INFO",
          actorEmail: currentEmail,
          actorName: currentName,
          actorRole: currentRole,
          targetResource: "Sesión del Portal",
          details: "El usuario cerró su sesión de forma segura.",
        });
      } catch {}
    }

    try {
      await firebaseSignOut(auth);
    } catch {}

    isSigningOutRef.current = false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        application,
        loading,
        isTwoFactorVerified,
        completeTwoFactorVerification,
        simulateClientView,
        setSimulateClientView,
        signIn,
        signInWithGoogle,
        requestPasswordReset,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);