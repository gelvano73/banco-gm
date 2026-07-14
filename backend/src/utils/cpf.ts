/** Remove caracteres não numéricos do CPF */
export function sanitizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/** Valida dígitos verificadores do CPF (algoritmo oficial) */
export function isValidCpf(cpfInput: string): boolean {
  const cpf = sanitizeCpf(cpfInput);

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) {
      sum += Number(base[i]) * (factor - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const d1 = calcDigit(cpf.slice(0, 9), 10);
  const d2 = calcDigit(cpf.slice(0, 10), 11);

  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

export function formatCpf(cpf: string): string {
  const digits = sanitizeCpf(cpf);
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
