// lib/utils/imageOptimizer.ts

/**
 * Comprime imágenes en el navegador, las convierte a WebP y elimina metadatos EXIF/GPS.
 * Si el archivo es un PDF, lo devuelve intacto sin modificarlo.
 */
export async function optimizeImageForVault(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<File> {
  // Si es PDF u otro documento que no sea imagen rasterizada, devolver original
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }

  const maxWidth = options.maxWidth ?? 1200;
  const maxHeight = options.maxHeight ?? 1200;
  const quality = options.quality ?? 0.82;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      // Al dibujar en canvas se purgan todos los metadatos EXIF (GPS, dispositivo, serie)
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          const cleanBaseName = file.name.replace(/\.[^/.]+$/, "");
          const optimizedFile = new File([blob], `${cleanBaseName}.webp`, {
            type: "image/webp",
            lastModified: Date.now(),
          });
          resolve(optimizedFile);
        },
        "image/webp",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}