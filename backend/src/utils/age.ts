/** Retorna true se a idade for >= 18 anos na data de referência */
export function isAdult(birthDateIso: string, today = new Date()): boolean {
  const birth = new Date(birthDateIso);
  if (Number.isNaN(birth.getTime())) return false;

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  const dayDiff = today.getDate() - birth.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 18;
}
