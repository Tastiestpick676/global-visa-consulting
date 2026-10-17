// types/visa.ts

export type DestinationCountry = "USA" | "JAPAN";

export type ApplicationStep = 
  | 1 // Diagnóstico & Activación
  | 2 // Recolección Inteligente (Formulario DS-160 / Japón)
  | 3 // Bóveda de Documentos & Auditoría Legal
  | 4; // Sala de Entrenamiento Consular & Cita

export type ApplicationStatus = 
  | "action_required" // Requiere acción del cliente (Rojo Acelerador)
  | "in_review"       // En revisión por especialista
  | "approved_ready"; // Expediente listo para entrevista

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  phone?: string;
  destination: DestinationCountry;
  planTier: "Essential" | "Priority Pro" | "VIP & Familia";
  createdAt: string;
}

// Datos sensibles (PII) - NUNCA hacer console.log de esta interfaz en producción
export interface VisaFormData {
  // 1. Datos Personales
  givenNames: string;
  surnames: string;
  birthDate: string;
  nationality: string;
  maritalStatus: string;
  // 2. Pasaporte
  passportNumber: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  // 3. Viaje
  purposeOfTrip: string;
  intendedArrivalDate: string;
  intendedStayDuration: string;
  usAddressOrHotel: string;
  // 4. Trabajo e Ingresos
  currentOccupation: string;
  employerOrCompanyName: string;
  monthlyIncomeUSD: string;
  hasPreviousVisaRefusal: "no" | "yes";
  refusalExplanation?: string;
}

export interface VisaApplication {
  id: string;
  userId: string; // Regla de seguridad Firestore: request.auth.uid == resource.data.userId
  destination: DestinationCountry;
  visaType: string; // Ej: "B1/B2 Turismo y Negocios" o "Turismo Corta Estancia"
  currentStep: ApplicationStep;
  progressPercentage: number;
  status: ApplicationStatus;
  formCompleted: boolean;
  formData: Partial<VisaFormData>;
  updatedAt: string;
}