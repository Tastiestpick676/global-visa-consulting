// app/terminos/page.tsx
"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { ArrowLeft, ShieldCheck, Lock } from "lucide-react";

export default function TerminosPrivacidadPage() {
  return (
    <main className="min-h-screen bg-brand-white text-brand-charcoal font-sans selection:bg-brand-red selection:text-white">
      {/* BARRA DE NAVEGACIÓN SUPERIOR */}
      <header className="sticky top-0 z-50 bg-brand-white/90 backdrop-blur-md border-b border-brand-platinum py-4 px-6 sm:px-12 flex items-center justify-between">
        <Link href="/" className="inline-block focus:outline-none">
          <BrandLogo theme="light" size="sm" />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-brand-charcoal/15 bg-brand-white px-5 py-2 text-xs font-semibold text-brand-charcoal hover:bg-brand-platinum/60 transition-all cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-brand-red" />
          <span>Volver al Inicio</span>
        </Link>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <div className="max-w-4xl mx-auto px-6 py-12 sm:py-16 space-y-10">
        
        {/* ENCABEZADO DE LA VISTA */}
        <div className="space-y-4 text-center sm:text-left border-b border-brand-platinum pb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-red/10 px-3.5 py-1.5 text-xs font-semibold text-brand-red">
            <Lock className="h-3.5 w-3.5" />
            <span>Marco Legal & Ciberseguridad Zero-Trust</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-brand-charcoal tracking-tight">
            Términos, Condiciones y Política de Privacidad
          </h1>
          <p className="text-sm text-brand-charcoal/75 max-w-2xl leading-relaxed">
            Global Visa Consulting — LegalTech Migratoria y Consultoría Consular de Alta Precisión.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-brand-charcoal/60">
            <span>Jurisdicción: República de Colombia</span>
            <span>•</span>
            <span>Última actualización: 2026</span>
          </div>
        </div>

        {/* CUERPO LEGAL */}
        <div className="rounded-3xl bg-brand-platinum/30 border border-brand-charcoal/10 p-6 sm:p-10 shadow-xl space-y-8 text-sm text-brand-charcoal/85 leading-relaxed">
          
          {/* SECCIÓN 1 */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-brand-charcoal flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-red text-white text-xs font-mono">01</span>
              Preámbulo y Naturaleza del Servicio
            </h2>
            <p>
              Bienvenido a <strong>Global Visa Consulting</strong> (globalvisaconsult.com). Al acceder a nuestra plataforma digital, utilizar nuestros servicios de estructuración documental, o interactuar con nuestros canales oficiales, usted acepta regirse por los presentes Términos y Condiciones, así como por nuestra Política de Privacidad y Tratamiento de Datos (Bóveda Criptográfica Zero-Trust PII).
            </p>
            <div className="rounded-2xl bg-brand-white p-4 border border-brand-charcoal/10 space-y-2">
              <strong className="text-brand-red font-display text-xs uppercase tracking-wider block">
                Aviso de Independencia Institucional:
              </strong>
              <p className="text-xs text-brand-charcoal/75 leading-relaxed">
                Global Visa Consulting opera como una firma privada de consultoría independiente. No somos una agencia gubernamental, embajada ni consulado de los Estados Unidos (Departamento de Estado - CEAC), ni del Japón (Ministerio de Asuntos Exteriores - MOFA). Las tarifas abonadas a nuestra plataforma corresponden exclusivamente a los honorarios por servicios profesionales de ingeniería documental, auditoría técnica, asesoría estratégica y acceso al portal tecnológico. Las tasas consulares oficiales (tales como las tarifas MRV o tasas MOFA) son derechos gubernamentales independientes que el usuario debe sufragar directamente ante las autoridades correspondientes.
              </p>
            </div>
          </section>

          {/* SECCIÓN 2 */}
          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-brand-charcoal flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-red text-white text-xs font-mono">02</span>
              Condiciones del Servicio
            </h2>
            
            <div className="space-y-2">
              <h3 className="font-bold text-brand-charcoal text-xs uppercase tracking-wider">2.1. Alcance y Niveles de Plan</h3>
              <p>Nuestros servicios se estructuran bajo una escalera de valor por solicitante (Planes Essential, Priority Pro y VIP Concierge para las rutas de Estados Unidos y Japón):</p>
              <ul className="list-disc pl-5 space-y-2 text-xs text-brand-charcoal/80">
                <li><strong>Precisión Consular (Cero Improvisación):</strong> Cada respuesta en formularios oficiales (DS-160 / Schedule of Stay) y cada soporte probatorio es auditado bajo criterios de coherencia jurídica y normativa migratoria antes de su radicación o entrega final.</li>
                <li><strong>Autonomía y Responsabilidad del Solicitante:</strong> La decisión soberana de aprobación o negación de una visa recae de forma exclusiva e inapelable en el Oficial Consular de la respectiva embajada. Global Visa Consulting optimiza la solidez técnica del perfil, el arraigo y la preparación del solicitante, pero no garantiza de forma absoluta la emisión de la visa.</li>
              </ul>
            </div>

            <div className="space-y-2 pt-2">
              <h3 className="font-bold text-brand-charcoal text-xs uppercase tracking-wider">2.2. Seguridad de Acceso y Autenticación Multicapa (Zero-Trust Auth)</h3>
              <ul className="list-disc pl-5 space-y-2 text-xs text-brand-charcoal/80">
                <li>El acceso a la plataforma está protegido mediante verificación de identidad y sistemas de autenticación de doble factor (2FA OTP).</li>
                <li>El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso. Cualquier actividad realizada bajo su sesión autenticada se presumirá efectuada por el titular.</li>
                <li>Las sesiones cuentan con un sistema de seguridad que incluye cierre por inactividad y expiración automática para proteger la integridad del expediente.</li>
              </ul>
            </div>
          </section>

          {/* SECCIÓN 3 */}
          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-brand-charcoal flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-red text-white text-xs font-mono">03</span>
              Política de Privacidad y Protección de Datos (Bóveda Criptográfica)
            </h2>
            <p>
              En cumplimiento de la normativa de protección de datos aplicable, en Global Visa Consulting garantizamos la máxima seguridad mediante un estándar de aislamiento de información sensible (Zero-Trust PII).
            </p>

            <div className="space-y-2">
              <h3 className="font-bold text-brand-charcoal text-xs uppercase tracking-wider">3.1. Recolección y Clasificación de la Información</h3>
              <p className="text-xs">Para estructurar su expediente migratorio, recopilamos información de manera segregada:</p>
              <ol className="list-decimal pl-5 space-y-1.5 text-xs text-brand-charcoal/80">
                <li><strong>Metadatos Operativos:</strong> Información general de seguimiento, estado de planes y fechas para el control del expediente.</li>
                <li><strong>Datos Personales Sensibles (PII):</strong> Copias de documentos de identidad, pasaportes, extractos bancarios, soportes laborales y familiares, los cuales se almacenan estrictamente de forma cifrada, aislada y protegida.</li>
              </ol>
            </div>

            <div className="space-y-2 pt-2">
              <h3 className="font-bold text-brand-charcoal text-xs uppercase tracking-wider">3.2. Uso de la Información</h3>
              <p className="text-xs">Los datos suministrados son utilizados exclusivamente para:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-brand-charcoal/80">
                <li>El diligenciamiento técnico y automatizado de formularios consulares (DS-160 y MOFA).</li>
                <li>La auditoría de coherencia y verificación documental en tiempo real por parte de nuestros asesores especializados.</li>
                <li>La gestión de citas y notificaciones transaccionales a través de canales seguros respaldados con protocolos DKIM, SPF y DMARC (@globalvisaconsult.com).</li>
              </ul>
            </div>

            <div className="rounded-2xl bg-brand-white p-4 border border-brand-charcoal/10 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                <span>3.3. Purga Criptográfica Definitiva</span>
              </div>
              <p className="text-xs text-brand-charcoal/75 leading-relaxed">
                Bajo nuestro principio de seguridad y privacidad estricta, una vez concluido formalmente el trámite migratorio y entregados los documentos oficiales al cliente, se ejecuta un proceso automatizado de Purga Criptográfica PII, eliminando de forma definitiva e irreversible los documentos sensibles almacenados en nuestra bóveda digital.
              </p>
            </div>
          </section>

          {/* SECCIÓN 4 & 5 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <section className="space-y-2">
              <h3 className="font-display font-bold text-brand-charcoal text-xs uppercase tracking-wider">04. Propiedad Intelectual</h3>
              <p className="text-xs text-brand-charcoal/75 leading-relaxed">
                Todo el contenido alojado en la plataforma de Global Visa Consulting (incluyendo software, arquitectura de código, diseño de interfaz, sistemas de simulación consular, textos, logotipos y manuales de marca) es propiedad exclusiva de la firma y se encuentra protegido por las leyes de propiedad intelectual.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-display font-bold text-brand-charcoal text-xs uppercase tracking-wider">05. Limitación de Responsabilidad</h3>
              <p className="text-xs text-brand-charcoal/75 leading-relaxed">
                Global Visa Consulting no se hace responsable por interrupciones en los portales gubernamentales oficiales (CEAC / MOFA) ni por cambios imprevistos en las políticas migratorias de los gobiernos de Estados Unidos o Japón.
              </p>
            </section>
          </div>

          {/* SECCIÓN 6 & CONTACTO */}
          <section className="space-y-3 pt-4 border-t border-brand-platinum">
            <h2 className="font-display text-base font-bold text-brand-charcoal">
              06. Legislación Aplicable y Jurisdicción
            </h2>
            <p className="text-xs text-brand-charcoal/75 leading-relaxed">
              Estos Términos y Condiciones y la Política de Privacidad se rigen por las leyes de la República de Colombia. Cualquier controversia derivada de la prestación de nuestros servicios será resuelta ante los jueces competentes de las sedes de operación de la firma en las ciudades de Barranquilla o Bogotá, renunciando el usuario a cualquier otro fuero que pudiera corresponderle.
            </p>
            <div className="pt-2 text-xs text-brand-charcoal/80">
              Si tiene dudas sobre el tratamiento de sus datos o el funcionamiento de su expediente migratorio, puede contactarnos a través de nuestros canales oficiales en globalvisaconsult.com o mediante el correo institucional <a href="mailto:info@globalvisaconsult.com" className="text-brand-red font-semibold hover:underline">info@globalvisaconsult.com</a>.
            </div>
          </section>

        </div>

        {/* PIE DE PÁGINA INTERNO */}
        <div className="text-center pb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-brand-charcoal hover:bg-brand-red px-6 py-3 text-xs font-bold text-white transition-all shadow-md cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 text-brand-red group-hover:text-white" />
            <span>Regresar a la Página Principal</span>
          </Link>
        </div>

      </div>
    </main>
  );
}