// types/visa.ts
export type DestinationCountry = "USA" | "JAPAN";

export type PlanTier = "Essential" | "Priority Pro" | "VIP";

export type UserRole = "admin" | "advisor" | "client";

export type ApplicationStatus =
  | "onboarding_pending"
  | "in_legal_review"
  | "documents_pending"
  | "ready_for_consulate"
  | "approved";

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  destination: DestinationCountry;
  planTier: PlanTier;
  createdAt: string;
}

export interface PreApprovedUser {
  email: string;
  fullName: string;
  role: UserRole;
  destination: DestinationCountry;
  planTier: PlanTier;
  createdBy: string;
  createdAt: string;
}

export interface SmartIntakeData {
  fullName: string;
  nationalId: string;
  maritalStatus: "Soltero/a" | "Casado/a" | "Unión Libre" | "Divorciado/a" | "Viudo/a";
  homeAddress: string;
  cityAndState: string;
  mobilePhone: string;
  purposeOfTrip: string;
  estimatedArrivalDate: string;
  stayDurationDays: string;
  tripFinancier: "Yo mismo (Recursos propios)" | "Un familiar / Pareja (Con Carta de Garantía)" | "Empresa patrocinadora";
  currentOccupation: string;
  companyOrEmployerName: string;
  monthlyIncomeLocal: string;
  partnerOrParentsOccupation?: string;
  japanPortOfEntry?: string;
  japanAirlineOrFlight?: string;
  japanCitiesToVisit?: string;
  hasGuarantorInJapan?: "no" | "yes";
  guarantorDetails?: string;
  previousStayInJapan?: string;
  socialMediaHandles?: string;
  parentsFullNamesAndDob?: string;
  hasRelativesInUS?: "no" | "yes";
  relativesInUSDetails?: string;
  previousJobsAndEducationSummary?: string;
  hasPreviousVisaRefusal?: "no" | "yes";
  refusalExplanation?: string;
  additionalNotes?: string;
}

export interface VaultDocument {
  docId: string;
  title: string;
  fileName: string;
  fileUrl: string;
  storagePath: string;
  fileSize: number;
  uploadedAt: string;
  status: "uploaded" | "verified" | "rejected";
  advisorFeedback?: string;
}

export interface ConsularSessionData {
  preferredDate?: string;
  preferredTimeSlot?: string;
  focusConcerns?: string;
  status?: "unscheduled" | "requested" | "confirmed" | "completed";
  meetingLink?: string;
  advisorNotes?: string;
}

export interface VisaApplication {
  id: string;
  userId: string;
  clientName?: string;
  clientEmail?: string;
  destination: DestinationCountry;
  visaType: string;
  status: ApplicationStatus;
  currentStep: number;
  progressPercentage: number;
  formData?: Partial<SmartIntakeData>;
  documents?: Record<string, VaultDocument>;
  consularSession?: ConsularSessionData;
  updatedAt: string;
}