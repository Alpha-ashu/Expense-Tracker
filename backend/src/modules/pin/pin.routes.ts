import { Router, Response } from 'express';
import { pinService } from './pin.service';
import { authMiddleware, AuthRequest } from '../../middleware/auth';

const router = Router();

// All PIN routes require authentication
router.use(authMiddleware);

/**
 * POST /api/v1/pin/create
 * Create a new PIN for the user
 */
router.post('/create', async (req: AuthRequest, res: Response) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'PIN is required' });
    }

    const result = await pinService.createPin({
      userId: req.user?.id || '',
      pin,
    });

    res.json(result);
  } catch (error) {
    console.error('Create PIN error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/pin/verify
 * Verify a user's PIN
 */
router.post('/verify', async (req: AuthRequest, res: Response) => {
  try {
    const { pin, deviceId } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'PIN is required' });
    }

    const result = await pinService.verifyPin({
      userId: req.user?.id || '',
      pin,
      deviceId,
    });

    res.json(result);
  } catch (error) {
    console.error('Verify PIN error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/pin/update
 * Update an existing PIN
 */
router.post('/update', async (req: AuthRequest, res: Response) => {
  try {
    const { currentPin, newPin } = req.body;

    if (!currentPin || !newPin) {
      return res.status(400).json({ error: 'Current PIN and new PIN are required' });
    }

    const result = await pinService.updatePin({
      userId: req.user?.id || '',
      currentPin,
      newPin,
    });

    res.json(result);
  } catch (error) {
    console.error('Update PIN error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/pin/status
 * Get PIN status and expiry information
 */
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pinService.getPinStatus(req.user?.id || '');
    res.json(result);
  } catch (error) {
    console.error('Get PIN status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/pin/expiring-soon
 * Check if PIN is expiring soon (within 7 days)
 */
router.get('/expiring-soon', async (req: AuthRequest, res: Response) => {
  try {
    const isExpiringSoon = await pinService.isPinExpiringSoon(req.user?.id || '');
    const daysRemaining = await pinService.getPinDaysRemaining(req.user?.id || '');
    
    res.json({
      success: true,
      isExpiringSoon,
      daysRemaining,
    });
  } catch (error) {
    console.error('Check PIN expiry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/pin/reset
 * Force reset PIN (admin only)
 */
router.post('/reset', async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await pinService.forceResetPin(userId);
    res.json(result);
  } catch (error) {
    console.error('Reset PIN error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as pinRoutes };
