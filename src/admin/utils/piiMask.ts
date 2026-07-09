export function maskVehiclePlate(plate: string): string {
  if (!plate || plate.length < 4) return '****';
  return plate.slice(0, 2) + '*'.repeat(plate.length - 4) + plate.slice(-2);
}

export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 7) return '***-****-****';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.slice(0, 3) + '-****-' + digits.slice(-4);
  }
  return digits.slice(0, 3) + '-***-' + digits.slice(-4);
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.***';
  const [local, domain] = email.split('@');
  const maskedLocal = local.length <= 2 ? '*'.repeat(local.length) : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${maskedLocal}@${domain}`;
}

export function maskName(name: string): string {
  if (!name || name.length < 2) return '*';
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

export type PiiField = 'plate' | 'phone' | 'email' | 'name';

export function maskPii(value: string, field: PiiField): string {
  switch (field) {
    case 'plate': return maskVehiclePlate(value);
    case 'phone': return maskPhoneNumber(value);
    case 'email': return maskEmail(value);
    case 'name': return maskName(value);
  }
}
