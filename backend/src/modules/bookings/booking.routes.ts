import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { requireFeature, requireRole, requireApproved } from '../../middleware/rbac';
import * as BookingController from './booking.controller';

const router = Router();

// All booking routes require authentication
router.use(authMiddleware);

// Create booking (users only)
router.post(
  '/',
  requireFeature('bookAdvisor'),
  BookingController.createBooking
);

// Get bookings (both client and advisor)
router.get('/', BookingController.getBookings);

// Get specific booking
router.get('/:id', BookingController.getBooking);

// Accept booking (advisor only)
router.put(
  '/:id/accept',
  requireRole('advisor'),
  requireApproved,
  BookingController.acceptBooking
);

// Reject booking (advisor only)
router.put(
  '/:id/reject',
  requireRole('advisor'),
  requireApproved,
  BookingController.rejectBooking
);

// Cancel booking (client only - but any authenticated user can call)
router.put(
  '/:id/cancel',
  BookingController.cancelBooking
);

export { router as bookingRoutes };
