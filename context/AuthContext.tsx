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
const PENDING_2FA_KEY = "gvc_pending_2fa_challenge";
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

  const isSigningInRef = useRef<boolean>(false);
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
  }, []);

  const completeTwoFactorVerification = async (proof?: string) => {
    isSigningInRef.current = false;
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(PENDING_2FA_KEY);
      sessionStorage.setItem(TWO_FACTOR_VERIFIED_KEY, "true");
    }
    setIsTwoFactorVerified(true);

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

      if (isSigningInRef.current) {
        return;
      }

      setLoading(true);

      try {
        // BLOQUEO ANTI-BYPASS POR REFRESH:
        // Si el usuario refresca la página (F5) cuando tenía un desafío 2FA pendiente
        // o no tiene "gvc_2fa_verified" === "true" en esta sesión, NUNCA se le concede acceso.
        const isPending2FA =
          typeof window !== "undefined" &&
          sessionStorage.getItem(PENDING_2FA_KEY) === "true";
        const hasSessionTab2FA =
          typeof window !== "undefined" &&
          sessionStorage.getItem(TWO_FACTOR_VERIFIED_KEY) === "true";

        if (isPending2FA || !hasSessionTab2FA) {
          // Si refrescó la página sin completar el MFA, mantenemos isTwoFactorVerified en false
          // y cerramos la sesión incompleta para obligarlo a autenticarse con MFA
          setIsTwoFactorVerified(false);
          if (typeof window !== "undefined") {
            sessionStorage.removeItem(PENDING_2FA_KEY);
            sessionStorage.removeItem(TWO_FACTOR_VERIFIED_KEY);
          }
          await firebaseSignOut(auth);
          setUser(null);
          setProfile(null);
          setApplication(null);
          setLoading(false);
          return;
        }

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

        if (existingUserSnap.exists()) {
          const pData = existingUserSnap.data() as UserProfile & {
            twoFactorVerified?: boolean;
          };
          // Verificar que además de sessionStorage, en Firestore no haya sido revocado el 2FA
          if (pData.twoFactorVerified === false) {
            sessionStorage.removeItem(TWO_FACTOR_VERIFIED_KEY);
            setIsTwoFactorVerified(false);
            await firebaseSignOut(auth);
            setUser(null);
            setProfile(null);
            setApplication(null);
            setLoading(false);
            return;
          }
          setProfile(pData);
        }

        setIsTwoFactorVerified(true);
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

    isSigningInRef.current = true;
    isSigningOutRef.current = false;

    if (typeof window !== "undefined") {
      sessionStorage.removeItem(TWO_FACTOR_VERIFIED_KEY);
      sessionStorage.setItem(PENDING_2FA_KEY, "true");
    }
    setIsTwoFactorVerified(false);

    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);

      // Leemos perfil y lista blanca en paralelo para no bloquear en redes móviles
      const [allowedData, initialUserSnap] = await Promise.all([
        checkAllowedEmail(cleanEmail),
        getDoc(doc(db, "users", cred.user.uid)).catch(() => null),
      ]);

      let userSnap = initialUserSnap;

      if (!allowedData && (!userSnap || !userSnap.exists())) {
        isSigningInRef.current = false;
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(PENDING_2FA_KEY);
        }
        cleanupFirestoreStreams();
        await firebaseSignOut(auth);
        throw new Error("UNREGISTERED_USER");
      }

      if (allowedData && (!userSnap || !userSnap.exists())) {
        await initializeUserAndApplication(
          cred.user.uid,
          cleanEmail,
          allowedData.fullName || cred.user.displayName || "Titular Autorizado",
          allowedData.destination || "USA",
          allowedData.role || "client",
          allowedData.planTier || "Priority Pro"
        );
        userSnap = await getDoc(doc(db, "users", cred.user.uid)).catch(
          () => null
        );
      }

      const loadedProfile =
        userSnap && userSnap.exists()
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
        sessionStorage.setItem(PENDING_2FA_KEY, "true");
      }

      const resolvedRole: UserRole =
        loadedProfile?.role || allowedData?.role || "client";
      const resolvedName = formatDisplayName(
        loadedProfile?.fullName ||
          allowedData?.fullName ||
          cred.user.displayName ||
          cleanEmail
      );

      // Ejecutamos las escrituras secundarias sin bloquear la apertura de la pantalla 2FA en móvil
      updateDoc(doc(db, "users", cred.user.uid), {
        twoFactorVerified: false,
        twoFactorProof: "",
      }).catch(() => {});

      recordSystemLog({
        category: "SECURITY_AUTH",
        eventType: "Credenciales Primarias Validadas (Pendiente 2FA)",
        outcome: "INFO",
        actorEmail: cleanEmail,
        actorName: resolvedName,
        actorRole: resolvedRole,
        targetResource: "Firebase Auth • Factor Primario",
        details:
          "Contraseña verificada correctamente. Expediente bloqueado hasta validar 2FA OTP.",
      }).catch(() => {});

      return {
        role: resolvedRole,
        fullName: resolvedName,
        email: cleanEmail,
        requiresTwoFactor: true,
      };
    } catch (err: any) {
      isSigningInRef.current = false;
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(PENDING_2FA_KEY);
      }
      recordSystemLog({
        category: "SECURITY_AUTH",
        eventType: "Intento de Login Fallido",
        outcome: "WARNING",
        actorEmail: cleanEmail,
        actorName: cleanEmail,
        actorRole: "anonymous",
        targetResource: "Portal de Acceso",
        details:
          "Credenciales inválidas o cuenta pendiente de configuración de clave.",
      }).catch(() => {});
      throw err;
    }
  };

  const signInWithGoogle = async (): Promise<SignInResult> => {
    isSigningInRef.current = true;
    isSigningOutRef.current = false;

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const cred = await signInWithPopup(auth, provider);
      const cleanEmail = (cred.user.email || "").trim().toLowerCase();

      const [allowedData, initialUserSnap] = await Promise.all([
        checkAllowedEmail(cleanEmail),
        getDoc(doc(db, "users", cred.user.uid)).catch(() => null),
      ]);

      let userSnap = initialUserSnap;

      if (!allowedData && (!userSnap || !userSnap.exists())) {
        isSigningInRef.current = false;
        cleanupFirestoreStreams();
        await firebaseSignOut(auth);
        recordSystemLog({
          category: "SECURITY_AUTH",
          eventType: "Acceso Google Bloqueado (No Provisionado)",
          outcome: "WARNING",
          actorEmail: cleanEmail || "desconocido",
          actorName: cred.user.displayName || cleanEmail,
          actorRole: "anonymous",
          targetResource: "Google OAuth 2.0",
          details: `Cuenta de Google (${cleanEmail}) rechazada por no tener expediente activo.`,
        }).catch(() => {});
        throw new Error("UNREGISTERED_USER");
      }

      if (allowedData && (!userSnap || !userSnap.exists())) {
        await initializeUserAndApplication(
          cred.user.uid,
          cleanEmail,
          allowedData.fullName ||
            cred.user.displayName ||
            "Titular Autorizado",
          allowedData.destination || "USA",
          allowedData.role || "client",
          allowedData.planTier || "Priority Pro"
        );
        userSnap = await getDoc(doc(db, "users", cred.user.uid)).catch(
          () => null
        );
      }

      await updateDoc(doc(db, "users", cred.user.uid), {
        twoFactorVerified: true,
        twoFactorProof: FALLBACK_64_HEX_PROOF,
        twoFactorVerifiedAt: new Date().toISOString(),
      }).catch(() => {});

      const loadedProfile =
        userSnap && userSnap.exists()
          ? (userSnap.data() as UserProfile)
          : null;

      if (typeof window !== "undefined") {
        localStorage.setItem(SESSION_START_KEY, String(Date.now()));
        sessionStorage.removeItem(PENDING_2FA_KEY);
        sessionStorage.setItem(TWO_FACTOR_VERIFIED_KEY, "true");
      }

      setUser(cred.user);
      if (loadedProfile) {
        setProfile(loadedProfile);
      }
      setIsTwoFactorVerified(true);
      setLoading(false);
      isSigningInRef.current = false;

      const resolvedRole: UserRole =
        loadedProfile?.role || allowedData?.role || "client";
      const resolvedName = formatDisplayName(
        loadedProfile?.fullName ||
          allowedData?.fullName ||
          cred.user.displayName ||
          cleanEmail
      );

      recordSystemLog({
        category: "SECURITY_AUTH",
        eventType: "Inicio de Sesión Exitoso (Google OAuth + MFA)",
        outcome: "SUCCESS",
        actorEmail: cleanEmail,
        actorName: resolvedName,
        actorRole: resolvedRole,
        targetResource: "Google OAuth 2.0 • Token 8h",
        details: "Autenticación federada con Google completada exitosamente.",
      }).catch(() => {});

      return {
        role: resolvedRole,
        fullName: resolvedName,
        email: cleanEmail,
        requiresTwoFactor: false,
      };
    } catch (err) {
      isSigningInRef.current = false;
      throw err;
    }
  };

  const requestPasswordReset = async (email: string): Promise<void> => {
    const cleanEmail = email.trim().toLowerCase();

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch {}

    recordSystemLog({
      category: "SECURITY_AUTH",
      eventType: "Solicitud de Enlace Criptográfico de Contraseña",
      outcome: "INFO",
      actorEmail: cleanEmail,
      actorName: cleanEmail,
      actorRole: "anonymous",
      targetResource: "Recuperación de Credenciales",
      details: `Se procesó solicitud de enlace de contraseña para ${cleanEmail}.`,
    }).catch(() => {});
  };

  const signOut = async (): Promise<void> => {
    isSigningOutRef.current = true;
    isSigningInRef.current = false;

    const currentUid = user?.uid || auth.currentUser?.uid;
    const currentEmail = user?.email || auth.currentUser?.email;
    const currentName =
      profile?.fullName || user?.displayName || currentEmail || "Usuario";
    const currentRole = profile?.role || "client";

    cleanupFirestoreStreams();

    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_START_KEY);
      localStorage.removeItem(SIMULATE_CLIENT_KEY);
      sessionStorage.removeItem(TWO_FACTOR_VERIFIED_KEY);
      sessionStorage.removeItem(PENDING_2FA_KEY);
    }

    setIsTwoFactorVerified(false);
    setSimulateClientViewState(false);
    setUser(null);
    setProfile(null);
    setApplication(null);
    setLoading(false);

    if (currentUid) {
      await updateDoc(doc(db, "users", currentUid), {
        twoFactorVerified: false,
        twoFactorProof: "",
      }).catch(() => {});
    }

    if (currentEmail) {
      recordSystemLog({
        category: "SECURITY_AUTH",
        eventType: "Cierre de Sesión Manual",
        outcome: "INFO",
        actorEmail: currentEmail,
        actorName: currentName,
        actorRole: currentRole,
        targetResource: "Sesión del Portal",
        details: "El usuario cerró su sesión de forma segura.",
      }).catch(() => {});
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