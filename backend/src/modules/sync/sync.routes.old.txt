import { Router } from 'express';
import { syncService } from './sync.service';
import { authMiddleware, AuthRequest } from '../../middleware/auth';

const router = Router();

// All sync routes require authentication
router.use(authMiddleware);

/**
 * POST /api/v1/sync/pull
 * Pull data from server (source of truth)
 */
router.post('/pull', [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('deviceId').notEmpty().withMessage('Device ID is required'),
  body('lastSyncedAt').optional().isISO8601().withMessage('Invalid timestamp'),
  body('entityTypes').optional().isArray().withMessage('Entity types must be an array'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, deviceId, lastSyncedAt, entityTypes } = req.body;

    // Verify user matches authenticated user
    if (userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized: User mismatch' });
    }

    const result = await syncService.pullData({
      userId,
      deviceId,
      lastSyncedAt,
      entityTypes,
    });

    res.json(result);
  } catch (error) {
    console.error('Sync pull error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/sync/push
 * Push local changes to server
 */
router.post('/push', [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('deviceId').notEmpty().withMessage('Device ID is required'),
  body('entities').isArray().withMessage('Entities must be an array'),
  body('entities.*.entityType').notEmpty().withMessage('Entity type is required'),
  body('entities.*.operation').isIn(['create', 'update', 'delete']).withMessage('Invalid operation'),
  body('entities.*.entityId').notEmpty().withMessage('Entity ID is required'),
  body('entities.*.timestamp').isISO8601().withMessage('Invalid timestamp'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, deviceId, entities } = req.body;

    // Verify user matches authenticated user
    if (userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized: User mismatch' });
    }

    const result = await syncService.pushData({
      userId,
      deviceId,
      entities,
    });

    res.json(result);
  } catch (error) {
    console.error('Sync push error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/sync/register-device
 * Register or update a device
 */
router.post('/register-device', [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('deviceId').notEmpty().withMessage('Device ID is required'),
  body('deviceName').optional().isString(),
  body('deviceType').optional().isIn(['mobile', 'desktop', 'tablet']),
  body('platform').optional().isIn(['ios', 'android', 'windows', 'macos', 'linux', 'web']),
  body('appVersion').optional().isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, deviceId, deviceName, deviceType, platform, appVersion } = req.body;

    // Verify user matches authenticated user
    if (userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized: User mismatch' });
    }

    const device = await syncService.registerDevice(userId, {
      deviceId,
      deviceName,
      deviceType,
      platform,
      appVersion,
    });

    res.json({ success: true, device });
  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/sync/devices
 * Get all devices for the authenticated user
 */
router.get('/devices', async (req, res) => {
  try {
    const devices = await syncService.getUserDevices(req.user.id);
    res.json({ success: true, devices });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/sync/deactivate-device
 * Deactivate a device
 */
router.post('/deactivate-device', [
  body('deviceId').notEmpty().withMessage('Device ID is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId } = req.body;

    await syncService.deactivateDevice(req.user.id, deviceId);
    res.json({ success: true, message: 'Device deactivated' });
  } catch (error) {
    console.error('Deactivate device error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as syncRoutes };
