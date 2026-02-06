import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import * as SettingsController from './settings.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', SettingsController.getSettings);
router.put('/', SettingsController.updateSettings);

export { router as settingsRoutes };
