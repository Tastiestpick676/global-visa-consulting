// types/visa.ts
export type DestinationCountry = "USA" | "JAPAN";

export type PlanTier = "Essential" | "Priority Pro" | "VIP";

export type UserRole = "admin" | "advisor" | "client";

export type ApplicationStatus =
  | "onboarding_pending"
  | "in_legal_review"
  | "documents_pending"
  | "ready_for_consulate"
  | "approved"
  | "rejected";

export interface UserProfile {
  uid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  phone?: string;
  photoUrl?: string;
  bioOrTitle?: string;
  role: UserRole;
  destination: DestinationCountry;
  planTier: PlanTier;
  bookingUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PreApprovedUser {
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  destination: DestinationCountry;
  planTier: PlanTier;
  bookingUrl?: string;
  assignedAdvisorId?: string;
  assignedAdvisorName?: string;
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

export interface ConsularResourceItem {
  id: string;
  title: string;
  description: string;
  category:
    | "Guia"
    | "Documento Oficial"
    | "Checklist"
    | "Tip Consular"
    | "Video YouTube"
    | "Instagram / Post";
  url?: string;
  storagePath?: string; // Para eliminar el archivo físico de Firebase Storage cuando se borra el post
  destination: DestinationCountry | "ALL";
  updatedAt: string;
}

// Registro de Meetings / Sesiones realizadas con el cliente
export interface CaseMeetingRecord {
  id: string;
  date: string;
  title: string;
  notes: string;
  advisorName: string;
  attachmentName?: string;
  attachmentUrl?: string;
  attachmentStoragePath?: string;
  createdAt: string;
}

export interface ConsularSessionData {
  preferredDate?: string;
  preferredTimeSlot?: string;
  focusConcerns?: string;
  status?: "unscheduled" | "requested" | "confirmed" | "completed";
  bookingUrl?: string;
  meetingLink?: string;
  calendarEventId?: string;
  calendarHtmlLink?: string;
  confirmedDateTime?: string;
  advisorNotes?: string;
  officialDeliverableUrl?: string;
  officialDeliverableTitle?: string;
}

export interface HistoricalCaseSummary {
  caseId: string;
  visaType: string;
  destination: DestinationCountry;
  status: ApplicationStatus;
  closedAt: string;
  advisorName?: string;
}

export interface VisaApplication {
  id: string;
  userId: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  destination: DestinationCountry;
  planTier?: PlanTier;
  visaType: string;
  status: ApplicationStatus;
  currentStep: number;
  progressPercentage: number;
  assignedAdvisorId?: string;
  assignedAdvisorName?: string;
  assignedAdvisorEmail?: string;
  assignedAdvisorBookingUrl?: string;
  isDecommissioned?: boolean;
  decommissionedAt?: string;
  meetings?: CaseMeetingRecord[];
  historicalCases?: HistoricalCaseSummary[];
  formData?: Partial<SmartIntakeData>;
  documents?: Record<string, VaultDocument>;
  consularSession?: ConsularSessionData;
  updatedAt: string;
}