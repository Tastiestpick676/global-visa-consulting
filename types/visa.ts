// types/visa.ts

export type DestinationCountry = "USA" | "JAPAN";

export type PlanTier = "Essential" | "Priority Pro" | "VIP";

export type UserRole = "client" | "advisor" | "admin";

export type ApplicationStatus =
  | "onboarding"
  | "form_in_progress"
  | "documents_pending"
  | "legal_review"
  | "ready_for_consulate"
  | "approved"
  | "rejected";

export type DocumentStatus = "pending" | "uploaded" | "verified" | "rejected";

export interface PreApprovedUser {
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  destination: DestinationCountry;
  planTier: PlanTier;
  createdBy?: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  phone?: string;
  photoUrl?: string;
  photoURL?: string;
  role: UserRole;
  destination?: DestinationCountry;
  planTier?: PlanTier;
  bookingUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface VaultDocumentItem {
  id: string;
  title: string;
  description: string;
  required: boolean;
  status: DocumentStatus;
  fileName?: string;
  fileUrl?: string;
  storagePath?: string;
  feedback?: string;
  uploadedAt?: string;
  reviewedBy?: string;
}

export interface OfficialDeliverableItem {
  id: string;
  label: string;
  description?: string;
  fileName: string;
  fileUrl: string;
  storagePath?: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface ScheduledMeetingItem {
  id: string;
  title: string;
  dateTime: string;
  meetUrl: string;
  advisorName: string;
  notes?: string;
  completed?: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  details: string;
  actorName: string;
  actorRole: UserRole;
  timestamp: string;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface SmartFormData {
  fullName?: string;
  nationalId?: string;
  birthDate?: string;
  maritalStatus?: string;
  mobilePhone?: string;
  homeAddress?: string;
  city?: string;
  passportNumber?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  intendedArrivalDate?: string;
  intendedStayDuration?: string;
  destinationCities?: string;
  accommodationDetails?: string;
  tripPayer?: string;
  travelCompanions?: string;
  currentOccupation?: string;
  employerOrBusinessName?: string;
  jobTitle?: string;
  monthlyIncomeCop?: string;
  yearsInCurrentActivity?: string;
  workDescription?: string;
  previousUsaVisa?: string;
  previousVisaRefusal?: string;
  refusalExplanation?: string;
  internationalTravelHistory?: string;
  relativesInDestination?: string;
  securityBackgroundDeclaration?: string;
  japanEntryPort?: string;
  japanAirlineOrFlight?: string;
  japanDailyItinerarySummary?: string;
  japanGuarantorOrInviter?: string;
  [key: string]: any;
}

export interface VisaApplication {
  id: string;
  userId: string;
  clientName?: string;
  clientEmail?: string;
  destination: DestinationCountry;
  visaType: string;
  planTier: PlanTier;
  status: ApplicationStatus;
  currentStep: number;
  progressPercentage: number;
  assignedAdvisorId?: string;
  assignedAdvisorName?: string;
  assignedAdvisorEmail?: string;
  assignedAdvisorPhotoUrl?: string;
  assignedAdvisorBookingUrl?: string;
  consularAttempt?: number;
  archivedAttempts?: {
    attemptNumber: number;
    archivedAt: string;
    finalStatus: ApplicationStatus;
    summaryNote?: string;
  }[];
  formData: SmartFormData;
  documents: VaultDocumentItem[];
  officialDeliverables?: OfficialDeliverableItem[];
  meetings?: ScheduledMeetingItem[];
  auditLogs?: AuditLogEntry[];
  notifications?: AppNotification[];
  advisorNotes?: string;
  updatedAt: string;
  createdAt: string;
}

export type ReactionType = "helpful" | "fire" | "clap" | "bulb";

export interface ConsularResourceItem {
  id: string;
  title: string;
  description: string;
  category: "Video YouTube" | "Instagram / Post" | "Guia" | "Tip Consular";
  destination: DestinationCountry | "ALL";
  url?: string;
  storagePath?: string;
  upvotedBy?: string[];
  reactions?: Partial<Record<ReactionType, string[]>>;
  updatedAt: string;
}

export type SystemLogCategory =
  | "SECURITY_AUTH"
  | "CASE_TRACEABILITY"
  | "PII_VAULT"
  | "IAM_GOVERNANCE";

export type SystemLogOutcome = "SUCCESS" | "WARNING" | "CRITICAL" | "INFO";

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  category: SystemLogCategory;
  eventType: string;
  outcome: SystemLogOutcome;
  actorEmail: string;
  actorName: string;
  actorRole: UserRole | "anonymous";
  targetResource?: string;
  details: string;
  metadata?: string;
}