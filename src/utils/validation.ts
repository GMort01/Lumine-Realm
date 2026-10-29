import DOMPurify from 'dompurify';

const IMAGE_HOSTS_WITHOUT_EXTENSIONS = new Set([
  'images.unsplash.com',
  'lh3.googleusercontent.com',
  'i.imgur.com',
]);

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputValidationError';
  }
}

export function sanitizePlainText(value: string, label: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new InputValidationError(`${label} no tiene un formato válido.`);
  }

  const sanitized = Array.from(DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  }))
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return !(codePoint <= 0x08 || codePoint === 0x0B || codePoint === 0x0C || (codePoint >= 0x0E && codePoint <= 0x1F) || codePoint === 0x7F);
    })
    .join('')
    .replace(/\b(?:javascript|vbscript)\s*:/gi, '')
    .replace(/\bdata\s*:\s*text\/html/gi, '')
    .trim();

  if (sanitized.length > maxLength) {
    throw new InputValidationError(`${label} no puede superar los ${maxLength} caracteres.`);
  }

  return sanitized;
}

export function validateUuid(value: string, label = 'El identificador'): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new InputValidationError(`${label} no es válido.`);
  }
  return value;
}

export function validateEmail(value: string): string {
  const email = sanitizePlainText(value, 'El correo electrónico', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new InputValidationError('Escribe un correo electrónico válido.');
  }
  return email;
}

export function validateHttpsUrl(value: string, label: string, maxLength = 2048): string | null {
  const sanitized = sanitizePlainText(value, label, maxLength);
  if (!sanitized) return null;

  let url: URL;
  try {
    url = new URL(sanitized);
  } catch {
    throw new InputValidationError(`${label} debe ser una URL HTTPS válida.`);
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new InputValidationError(`${label} debe comenzar con https:// y no incluir credenciales.`);
  }

  return url.toString();
}

export function validateImageUrl(value: string, label: string): string | null {
  const url = validateHttpsUrl(value, label);
  if (!url) return null;

  const parsedUrl = new URL(url);
  const hasImageExtension = /\.(?:avif|gif|jpe?g|png|webp)$/i.test(parsedUrl.pathname);
  const recognizedImageHost = IMAGE_HOSTS_WITHOUT_EXTENSIONS.has(parsedUrl.hostname.toLowerCase());
  if (!hasImageExtension && !recognizedImageHost) {
    throw new InputValidationError(`${label} debe apuntar a una imagen HTTPS JPG, PNG, GIF, WebP o AVIF.`);
  }

  return url;
}

export function safeUiError(error: unknown, fallback: string): string {
  return error instanceof InputValidationError ? error.message : fallback;
}

export function validateAudience(
  scope: string,
  recipientUserId: string | null | undefined,
  relationshipId: string | null | undefined,
) {
  if (!['realm', 'individual', 'relationship'].includes(scope)) {
    throw new InputValidationError('La audiencia seleccionada no es válida.');
  }
  if (scope === 'individual') {
    if (!recipientUserId || relationshipId) throw new InputValidationError('Selecciona un miembro como destinatario.');
    validateUuid(recipientUserId, 'El destinatario');
  }
  if (scope === 'relationship') {
    if (!relationshipId || recipientUserId) throw new InputValidationError('Selecciona un vínculo de pareja.');
    validateUuid(relationshipId, 'El vínculo de pareja');
  }
  if (scope === 'realm' && (recipientUserId || relationshipId)) {
    throw new InputValidationError('La audiencia del Realm no puede tener un destinatario individual.');
  }
}
