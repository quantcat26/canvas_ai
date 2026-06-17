/**
 * Request validation helpers for controllers.
 * Keeps validation logic out of controller methods.
 */

export const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseOptionalBoolean = (input) => {
  if (input === null || input === undefined) return null;
  if (typeof input === 'boolean') return input;
  if (typeof input === 'number') return input !== 0;
  if (typeof input === 'string') {
    const normalized = input.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return null;
};

export const parseOptionalNumber = (input, { min, max } = {}) => {
  if (input === null || input === undefined || input === '') return null;
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return null;
  if (min !== undefined && parsed < min) return null;
  if (max !== undefined && parsed > max) return null;
  return parsed;
};

export const trimToNull = (value) =>
  (typeof value === 'string' && value.trim()) ? value.trim() : null;

export const parseName = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  return trimToNull(value);
};
