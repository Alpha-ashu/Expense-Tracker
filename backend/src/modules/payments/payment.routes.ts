import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import * as PaymentController from './payment.controller';

const router = Router();

// Webhook endpoint (public, no auth)
router.post('/webhook', PaymentController.handleWebhook);

// Protected routes
router.use(authMiddleware);

// Get payments
router.get('/', PaymentController.getPayments);

// Get specific payment
router.get('/:id', PaymentController.getPayment);

// Initiate payment
router.post('/initiate', PaymentController.initiatePayment);

// Complete payment
router.post('/complete', PaymentController.completePayment);

// Handle payment failure
router.post('/fail', PaymentController.failPayment);

// Refund payment
router.post('/refund', PaymentController.refundPayment);

export { router as paymentRoutes };
