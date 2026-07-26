import { z } from 'zod';
import { isValidCpf, sanitizeCpf } from '../utils/cpf.js';
import { isAdult } from '../utils/age.js';

export const registerSchema = z
  .object({
    cpf: z.string().min(11, 'CPF inválido.'),
    fullName: z.string().min(3, 'Informe o nome completo.'),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento inválida.'),
    email: z.string().email('E-mail inválido.'),
    phone: z.string().min(10, 'Telefone inválido.'),
    password: z
      .string()
      .min(8, 'A senha deve ter no mínimo 8 caracteres.')
      .regex(/[A-Za-z]/, 'A senha deve conter letras.')
      .regex(/\d/, 'A senha deve conter números.'),
    street: z.string().min(2, 'Informe a rua.'),
    number: z.string().min(1, 'Informe o número.'),
    complement: z.string().optional(),
    neighborhood: z.string().min(2, 'Informe o bairro.'),
    city: z.string().min(2, 'Informe a cidade.'),
    state: z.string().length(2, 'Informe a UF (2 letras).'),
    zipCode: z.string().min(8, 'CEP inválido.'),
  })
  .superRefine((data, ctx) => {
    if (!isValidCpf(data.cpf)) {
      ctx.addIssue({ code: 'custom', path: ['cpf'], message: 'CPF inválido.' });
    }
    if (!isAdult(data.birthDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['birthDate'],
        message: 'É necessário ter 18 anos ou mais para abrir conta.',
      });
    }
  })
  .transform((data) => ({
    ...data,
    cpf: sanitizeCpf(data.cpf),
    email: data.email.toLowerCase().trim(),
    fullName: data.fullName.trim(),
    phone: data.phone.replace(/\D/g, ''),
    zipCode: data.zipCode.replace(/\D/g, ''),
    state: data.state.toUpperCase(),
  }));

export const loginSchema = z.object({
  cpfOrEmail: z.string().min(3, 'Informe CPF ou e-mail.'),
  password: z.string().min(1, 'Informe a senha.'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido.'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Token inválido.'),
  password: z
    .string()
    .min(8, 'A senha deve ter no mínimo 8 caracteres.')
    .regex(/[A-Za-z]/, 'A senha deve conter letras.')
    .regex(/\d/, 'A senha deve conter números.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
