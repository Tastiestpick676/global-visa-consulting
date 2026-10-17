// lib/constants.ts

// Reemplaza estos números por tu número real de WhatsApp Business (con código de país, sin el símbolo +)
export const WHATSAPP_NUMBER = "573126823689";

export function getWhatsAppUrl(customMessage?: string): string {
  const defaultMessage =
    "Hola Global Visa Consulting, quiero iniciar mi diagnóstico migratorio para solicitar mi visa.";
  const text = encodeURIComponent(customMessage || defaultMessage);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}