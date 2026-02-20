import { Router, Response } from 'express';
import { syncService } from './sync.service';
import { authMiddleware, AuthRequest } from '../../middleware/auth';

const router = Router();

// All sync routes require authentication
router.use(authMiddleware);

/**
 * POST /api/v1/sync/pull
 * Pull data from server (source of truth)
 */
router.post('/pull', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, deviceId, lastSyncedAt, entityTypes } = req.body;

    // Basic validation
    if (!userId || !deviceId) {
      return res.status(400).json({ error: 'User ID and Device ID are required' });
    }

    // Verify user matches authenticated user
    if (userId !== req.user?.id) {
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
router.post('/push', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, deviceId, entities } = req.body;

    // Basic validation
    if (!userId || !deviceId || !entities || !Array.isArray(entities)) {
      return res.status(400).json({ error: 'User ID, Device ID, and entities array are required' });
    }

    // Verify user matches authenticated user
    if (userId !== req.user?.id) {
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
router.post('/register-device', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, deviceId, deviceName, deviceType, platform, appVersion } = req.body;

    // Basic validation
    if (!userId || !deviceId) {
      return res.status(400).json({ error: 'User ID and Device ID are required' });
    }

    // Verify user matches authenticated user
    if (userId !== req.user?.id) {
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
router.get('/devices', async (req: AuthRequest, res: Response) => {
  try {
    const devices = await syncService.getUserDevices(req.user?.id || '');
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
router.post('/deactivate-device', async (req: AuthRequest, res: Response) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    await syncService.deactivateDevice(req.user?.id || '', deviceId);
    res.json({ success: true, message: 'Device deactivated' });
  } catch (error) {
    console.error('Deactivate device error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as syncRoutes };
