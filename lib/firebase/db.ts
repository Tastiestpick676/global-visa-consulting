// lib/firebase/db.ts
import { doc, setDoc } from "firebase/firestore";
import { db } from "./config";
import {
  DestinationCountry,
  PlanTier,
  UserProfile,
  UserRole,
  VisaApplication,
} from "@/types/visa";

export async function initializeUserAndApplication(
  uid: string,
  email: string,
  fullName: string,
  destination: DestinationCountry = "USA",
  role: UserRole = "client",
  planTier: PlanTier = "Priority Pro"
): Promise<{ profile: UserProfile; application: VisaApplication }> {
  const now = new Date().toISOString();

  const profile: UserProfile = {
    uid,
    email: email.toLowerCase(),
    fullName,
    role,
    destination,
    planTier,
    createdAt: now,
  };

  const application: VisaApplication = {
    id: uid,
    userId: uid,
    clientName: fullName,
    clientEmail: email.toLowerCase(),
    destination,
    visaType:
      destination === "JAPAN"
        ? "Visa de Turismo Japón (Estancia Corta)"
        : "Visa B1/B2 Estados Unidos",
    status: "onboarding_pending",
    currentStep: 2,
    progressPercentage: 25,
    updatedAt: now,
  };

  await setDoc(doc(db, "users", uid), profile);
  await setDoc(doc(db, "applications", uid), application);

  return { profile, application };
}