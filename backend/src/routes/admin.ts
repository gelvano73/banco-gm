import { Router } from 'express';
import { authMiddleware, adminMiddleware, type AuthRequest } from '../middleware/auth.js';
import { getAdminDashboard } from '../services/adminService.js';

export const adminRouter = Router();

adminRouter.use(authMiddleware, adminMiddleware);

adminRouter.get('/dashboard', (_req: AuthRequest, res) => {
  return res.json({ dashboard: getAdminDashboard() });
});
