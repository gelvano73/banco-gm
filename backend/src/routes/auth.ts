import { Router, type Request, type Response } from 'express';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../utils/validators.js';
import {
  AppError,
  authenticateClient,
  createPasswordReset,
  findClientById,
  registerClient,
  resetPassword,
} from '../services/clientService.js';
import { authenticateAdmin, findAdminByEmail } from '../services/adminService.js';
import { signToken } from '../utils/jwt.js';
import {
  createMfaChallenge,
  listAccessLogs,
  listDevices,
  setMfaEnabled,
  upsertDevice,
  verifyMfaChallenge,
  writeAccessLog,
} from '../services/securityService.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { toPublicClient } from '../db/database.js';
import { z } from 'zod';

export const authRouter = Router();

function meta(req: { ip?: string; headers: Record<string, unknown> }) {
  return {
    ip: req.ip || (req.headers['x-forwarded-for'] as string) || null,
    userAgent: String(req.headers['user-agent'] || ''),
  };
}

export async function handleRegister(req: Request, res: Response) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const client = await registerClient(parsed.data);
    const token = signToken({
      sub: client.id,
      email: client.email,
      role: 'client',
    });
    const m = meta(req);
    upsertDevice(client.id, m.userAgent, m.ip);
    writeAccessLog({
      clientId: client.id,
      action: 'auth.register',
      ip: m.ip,
      userAgent: m.userAgent,
      success: true,
    });

    return res.status(201).json({
      message: 'Conta criada com sucesso.',
      client,
      token,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro interno ao cadastrar cliente.' });
  }
}

export async function handleLogin(req: Request, res: Response) {
  const m = meta(req);
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    // Admin em tabela usuarios_admin
    if (parsed.data.cpfOrEmail.includes('@') && findAdminByEmail(parsed.data.cpfOrEmail)) {
      const admin = await authenticateAdmin(parsed.data.cpfOrEmail, parsed.data.password);
      const token = signToken({
        sub: admin.id,
        email: admin.email,
        role: 'admin',
      });
      writeAccessLog({
        clientId: null,
        action: 'auth.login.admin',
        ip: m.ip,
        userAgent: m.userAgent,
        success: true,
        details: { adminId: admin.id, email: admin.email },
      });
      return res.json({
        message: 'Login admin realizado com sucesso.',
        client: admin,
        token,
        requiresMfa: false,
      });
    }

    const client = await authenticateClient(parsed.data.cpfOrEmail, parsed.data.password);
    const row = findClientById(client.id)!;

    if (row.mfa_enabled) {
      const challenge = createMfaChallenge(client.id);
      writeAccessLog({
        clientId: client.id,
        action: 'auth.login.mfa_required',
        ip: m.ip,
        userAgent: m.userAgent,
        success: true,
      });
      return res.json({
        message: 'MFA necessário. Informe o código de 6 dígitos.',
        requiresMfa: true,
        challengeId: challenge.challengeId,
        mfaCode: challenge.code,
      });
    }

    const token = signToken({
      sub: client.id,
      email: client.email,
      role: 'client',
    });
    upsertDevice(client.id, m.userAgent, m.ip);
    writeAccessLog({
      clientId: client.id,
      action: 'auth.login',
      ip: m.ip,
      userAgent: m.userAgent,
      success: true,
    });

    return res.json({
      message: 'Login realizado com sucesso.',
      client,
      token,
      requiresMfa: false,
    });
  } catch (err) {
    writeAccessLog({
      action: 'auth.login',
      ip: m.ip,
      userAgent: m.userAgent,
      success: false,
      details: { error: err instanceof Error ? err.message : 'erro' },
    });
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro interno ao autenticar.' });
  }
}

authRouter.post('/register', handleRegister);
authRouter.post('/login', handleLogin);
authRouter.post('/mfa/verify', async (req, res) => {
  const m = meta(req);
  try {
    const parsed = z
      .object({
        challengeId: z.string().uuid(),
        code: z.string().regex(/^\d{6}$/),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados MFA inválidos.' });
    }

    const clientId = verifyMfaChallenge(parsed.data.challengeId, parsed.data.code);
    const clientRow = findClientById(clientId);
    if (!clientRow) throw new AppError('Cliente não encontrado.', 404);

    const client = toPublicClient(clientRow);
    const token = signToken({
      sub: client.id,
      email: client.email,
      role: 'client',
    });
    upsertDevice(client.id, m.userAgent, m.ip);
    writeAccessLog({
      clientId: client.id,
      action: 'auth.mfa.verify',
      ip: m.ip,
      userAgent: m.userAgent,
      success: true,
    });

    return res.json({
      message: 'MFA validado com sucesso.',
      client,
      token,
    });
  } catch (err) {
    writeAccessLog({
      action: 'auth.mfa.verify',
      ip: m.ip,
      userAgent: m.userAgent,
      success: false,
    });
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao validar MFA.' });
  }
});

authRouter.post('/forgot-password', async (req, res) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await createPasswordReset(parsed.data.email);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao solicitar recuperação de senha.' });
  }
});

authRouter.post('/reset-password', async (req, res) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await resetPassword(parsed.data.token, parsed.data.password);
    return res.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao redefinir senha.' });
  }
});

authRouter.get('/security/logs', authMiddleware, (req: AuthRequest, res) => {
  return res.json({ logs: listAccessLogs(req.clientId!) });
});

authRouter.get('/security/devices', authMiddleware, (req: AuthRequest, res) => {
  return res.json({ devices: listDevices(req.clientId!) });
});

authRouter.post('/security/mfa', authMiddleware, (req: AuthRequest, res) => {
  const parsed = z.object({ enabled: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Informe enabled true/false.' });
  }
  setMfaEnabled(req.clientId!, parsed.data.enabled);
  const client = findClientById(req.clientId!);
  writeAccessLog({
    clientId: req.clientId!,
    action: parsed.data.enabled ? 'security.mfa.enable' : 'security.mfa.disable',
    success: true,
  });
  return res.json({
    message: parsed.data.enabled ? 'MFA ativado.' : 'MFA desativado.',
    mfaEnabled: Boolean(client?.mfa_enabled),
  });
});
