// lib/firebase/db.ts
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./config";
import { DestinationCountry, UserProfile, VisaApplication } from "@/types/visa";

/**
 * Crea el perfil del usuario y su expediente inicial en Firestore
 * respetando la regla: request.auth.uid == resource.data.userId
 */
export async function initializeUserAndApplication(
  uid: string,
  email: string,
  fullName: string,
  destination: DestinationCountry = "USA"
): Promise<{ profile: UserProfile; application: VisaApplication }> {
  const userRef = doc(db, "users", uid);
  const appRef = doc(db, "applications", uid); // Usamos el mismo uid como ID del expediente principal

  const userSnap = await getDoc(userRef);
  const appSnap = await getDoc(appRef);

  let profile: UserProfile;
  let application: VisaApplication;

  if (!userSnap.exists()) {
    profile = {
      uid,
      email,
      fullName,
      destination,
      planTier: "Priority Pro",
      createdAt: new Date().toISOString(),
    };
    await setDoc(userRef, profile);
  } else {
    profile = userSnap.data() as UserProfile;
  }

  if (!appSnap.exists()) {
    application = {
      id: uid,
      userId: uid,
      destination,
      visaType:
        destination === "USA"
          ? "Visa B1/B2 — Turismo y Negocios"
          : "Visa Turismo — Estancia Corta Japón",
      currentStep: 2,
      progressPercentage: 25,
      status: "action_required",
      formCompleted: false,
      formData: {},
      updatedAt: new Date().toISOString(),
    };
    await setDoc(appRef, application);
  } else {
    application = appSnap.data() as VisaApplication;
  }

  return { profile, application };
}