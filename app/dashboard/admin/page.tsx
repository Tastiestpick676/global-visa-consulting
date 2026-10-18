// app/dashboard/admin/page.tsx
"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  DestinationCountry,
  PlanTier,
  PreApprovedUser,
  UserRole,
  VisaApplication,
} from "@/types/visa";
import { Input } from "@/components/ui/input";
import {
  UserPlus,
  Users,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  FileText,
} from "lucide-react";

export default function AdminDashboardPage() {
  const { profile } = useAuth();
  const [allowedList, setAllowedList] = useState<PreApprovedUser[]>([]);
  const [applicationsList, setApplicationsList] = useState<VisaApplication[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Formulario para provisionar nuevo usuario
  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("client");
  const [newDestination, setNewDestination] = useState<DestinationCountry>("USA");
  const [newPlanTier, setNewPlanTier] = useState<PlanTier>("Priority Pro");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const isStaff = profile?.role === "admin" || profile?.role === "advisor";

  const fetchAdminData = async () => {
    setLoadingData(true);
    try {
      const allowedSnap = await getDocs(collection(db, "allowed_emails"));
      const allowed: PreApprovedUser[] = [];
      allowedSnap.forEach((d) => allowed.push(d.data() as PreApprovedUser));
      setAllowedList(allowed);

      const appsSnap = await getDocs(collection(db, "applications"));
      const apps: VisaApplication[] = [];
      appsSnap.forEach((d) => apps.push(d.data() as VisaApplication));
      setApplicationsList(apps);
    } catch {
      setErrorMsg("Error al cargar datos. Verifica las reglas de Firestore para Staff.");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isStaff) {
      fetchAdminData();
    }
  }, [isStaff]);

  const handleProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback("");
    setErrorMsg("");

    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    try {
      const payload: PreApprovedUser = {
        email: cleanEmail,
        fullName: newFullName.trim() || "Cliente Autorizado",
        role: profile?.role === "admin" ? newRole : "client",
        destination: newDestination,
        planTier: newPlanTier,
        createdBy: profile?.email || "admin",
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "allowed_emails", cleanEmail), payload);
      setFeedback(`El correo ${cleanEmail} fue autorizado como ${payload.role.toUpperCase()}. Ya puede iniciar sesión con Google o Correo.`);
      setNewEmail("");
      setNewFullName("");
      await fetchAdminData();
    } catch {
      setErrorMsg("No se pudo autorizar el correo. Verifica tus permisos de Administrador.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeEmail = async (emailToDelete: string) => {
    try {
      await deleteDoc(doc(db, "allowed_emails", emailToDelete));
      await fetchAdminData();
    } catch {
      setErrorMsg("No se pudo eliminar el correo.");
    }
  };

  if (!isStaff) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl bg-brand-red/10 border border-brand-red/30 p-8 text-center space-y-3">
          <ShieldAlert className="h-10 w-10 text-brand-red mx-auto" />
          <h2 className="font-display text-2xl font-bold text-brand-charcoal">
            Acceso Restringido
          </h2>
          <p className="text-sm text-brand-charcoal/70">
            Esta sección es exclusiva para Administradores y Asesores Legales de Global Visa Consulting.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Encabezado Admin */}
        <div className="rounded-2xl bg-brand-charcoal p-8 text-brand-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/20 px-3 py-1 text-xs font-semibold text-brand-red">
              <span>Control de Acceso Basado en Roles (RBAC)</span>
            </span>
            <h2 className="font-display text-3xl font-bold">
              Provisionamiento de Clientes y Equipo
            </h2>
            <p className="text-sm text-white/70 max-w-2xl">
              Autoriza correos de clientes que hayan pagado su servicio o agrega asesores legales a tu firma. Cuando inicien sesión con Google, el sistema les creará su expediente automáticamente.
            </p>
          </div>
        </div>

        {feedback && (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-3 rounded-xl bg-brand-red/10 border border-brand-red/30 p-4 text-xs font-semibold text-brand-red">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulario para Autorizar Nuevo Usuario */}
        <form
          onSubmit={handleProvisionUser}
          className="rounded-2xl bg-brand-white p-8 border border-brand-platinum shadow-sm space-y-6"
        >
          <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-4">
            <UserPlus className="h-5 w-5 text-brand-red" />
            <h3 className="font-display text-lg font-bold text-brand-charcoal">
              Dar de Alta Nuevo Usuario (Pre-Autorización)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5 lg:col-span-2">
              <label className="text-xs font-semibold text-brand-charcoal">
                Correo Electrónico (Gmail / Corporativo)
              </label>
              <Input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="cliente@gmail.com"
                className="h-11 rounded-xl bg-brand-platinum/40 border-brand-platinum"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-charcoal">
                Nombre del Titular
              </label>
              <Input
                type="text"
                required
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Ej. Sindy Rubio"
                className="h-11 rounded-xl bg-brand-platinum/40 border-brand-platinum"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-charcoal">
                Rol en Plataforma
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                disabled={profile?.role !== "admin"}
                className="h-11 w-full rounded-xl bg-brand-platinum/40 border border-brand-platinum px-3 text-sm text-brand-charcoal"
              >
                <option value="client">Cliente</option>
                <option value="advisor">Asesor Legal</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-charcoal">
                Destino y Plan
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={newDestination}
                  onChange={(e) => setNewDestination(e.target.value as DestinationCountry)}
                  className="h-11 rounded-xl bg-brand-platinum/40 border border-brand-platinum px-2 text-xs text-brand-charcoal"
                >
                  <option value="USA">🇺🇸 USA</option>
                  <option value="JAPAN">🇯🇵 JP</option>
                </select>
                <select
                  value={newPlanTier}
                  onChange={(e) => setNewPlanTier(e.target.value as PlanTier)}
                  className="h-11 rounded-xl bg-brand-platinum/40 border border-brand-platinum px-2 text-xs text-brand-charcoal"
                >
                  <option value="Essential">Essential</option>
                  <option value="Priority Pro">Pro</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-brand-red px-7 py-3 text-sm font-semibold text-brand-white shadow-md hover:bg-brand-red/90 disabled:opacity-50 transition-all"
            >
              <UserPlus className="h-4 w-4" />
              <span>{submitting ? "Autorizando..." : "Autorizar Correo en Sistema"}</span>
            </button>
          </div>
        </form>

        {/* Tabla de Correos Pre-Autorizados y Expedientes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lista de Correos Autorizados */}
          <div className="rounded-2xl bg-brand-white p-6 border border-brand-platinum shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-brand-platinum pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-brand-red" />
                <h4 className="font-display text-base font-bold text-brand-charcoal">
                  Correos Pre-Autorizados ({allowedList.length})
                </h4>
              </div>
            </div>

            {loadingData ? (
              <p className="text-xs text-brand-charcoal/50">Cargando lista...</p>
            ) : allowedList.length === 0 ? (
              <p className="text-xs text-brand-charcoal/50">No hay correos pre-autorizados aún.</p>
            ) : (
              <div className="space-y-2.5">
                {allowedList.map((item) => (
                  <div
                    key={item.email}
                    className="flex items-center justify-between rounded-xl bg-brand-platinum/30 p-3.5 border border-brand-platinum"
                  >
                    <div>
                      <p className="text-xs font-bold text-brand-charcoal">
                        {item.fullName}{" "}
                        <span className="ml-1 rounded bg-brand-charcoal px-1.5 py-0.5 text-[10px] text-white uppercase">
                          {item.role}
                        </span>
                      </p>
                      <p className="text-[11px] text-brand-charcoal/60">{item.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-semibold text-brand-red">
                        {item.destination === "JAPAN" ? "🇯🇵 JP" : "🇺🇸 USA"} • {item.planTier}
                      </span>
                      {profile?.role === "admin" && (
                        <button
                          onClick={() => handleRevokeEmail(item.email)}
                          className="text-brand-charcoal/40 hover:text-brand-red transition-colors"
                          title="Revocar autorización"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lista de Expedientes Activos */}
          <div className="rounded-2xl bg-brand-white p-6 border border-brand-platinum shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-brand-platinum pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-red" />
                <h4 className="font-display text-base font-bold text-brand-charcoal">
                  Expedientes Activos en Firestore ({applicationsList.length})
                </h4>
              </div>
            </div>

            {loadingData ? (
              <p className="text-xs text-brand-charcoal/50">Cargando expedientes...</p>
            ) : applicationsList.length === 0 ? (
              <p className="text-xs text-brand-charcoal/50">Ningún usuario ha iniciado sesión aún.</p>
            ) : (
              <div className="space-y-2.5">
                {applicationsList.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-xl bg-brand-platinum/30 p-3.5 border border-brand-platinum space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-brand-charcoal">
                        {app.formData?.fullName || app.clientName || "Cliente Titular"}
                      </p>
                      <span className="text-xs font-bold text-brand-red">
                        {app.progressPercentage}%
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-charcoal/60">
                      {app.visaType} • Estado: <strong className="uppercase">{app.status}</strong>
                    </p>
                    {app.formData?.mobilePhone && (
                      <p className="text-[11px] text-brand-charcoal/70">
                        Tel: {app.formData.mobilePhone} | Cédula: {app.formData.nationalId}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}