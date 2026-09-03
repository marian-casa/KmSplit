/**
 * Lee un archivo de imagen elegido por el usuario, lo redimensiona a un
 * tamaño razonable (max 1200px) y lo convierte a JPEG base64 (data URI),
 * para guardarlo liviano en la base de datos y que funcione en `<img src>`
 * en cualquier navegador incluido iOS/Safari.
 */
export function fileToCompressedDataUri(
  file: File,
  maxSize = 1200,
  quality = 0.82,
  maxBytes = 3 * 1024 * 1024,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No pudimos leer la imagen'));
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('La imagen no es válida'));
      img.onload = () => {
        // no escalamos hacia arriba: si es más chica, la dejamos como está
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        // si aun así quedó pesada, bajamos la calidad una vez más
        if (dataUrl.length > maxBytes) {
          const tighter = canvas.toDataURL('image/jpeg', 0.6);
          resolve(tighter.length < dataUrl.length ? tighter : dataUrl);
        } else {
          resolve(dataUrl);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}