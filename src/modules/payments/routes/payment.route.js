import express from 'express'
import { protectRoute } from '../../../middlewares/auth.middleware.js'
import { PaymentController } from '../controllers/payment.controller.js'
import { checkisBlocked } from '../../../middlewares/block.middleware.js'
import authorize from '../../../middlewares/authorization.middleware.js'
import { attachBuyer } from '../../buyer/buyer.middleware.js'

const router = express.Router()

/**
 * @route   POST /api/v1/payments/paystack/webhook
 * @desc    Inbound webhook for Paystack payment events (charge.success, etc.)
 * @access  Public (Protected by HMAC SHA512 signature verification in controller)
 */
router.post('/paystack/webhook', PaymentController.handleWebhook)

// --- Authenticated Routes ---
router.use(protectRoute)
router.use(checkisBlocked)
router.use(authorize('admin', 'buyer', 'labeler'))

/**
 * @route   GET /api/v1/payments/success/:reference
 * @desc    Client-side verification endpoint to confirm payment status after redirect
 * @access  Private (Buyer/Admin)
 */
router.get("/success/:reference", PaymentController.success)

/**
 * @route   POST /api/v1/payments/create
 * @desc    Initialize a payment transaction for a dataset purchase or escrow
 * @access  Private (Buyer Only)
 */
router.post('/create', attachBuyer, PaymentController.createPayment)

/**
 * @route   GET /api/v1/payments/verify/verify
 * @desc    Manual trigger for payment verification (fallback for webhooks)
 * @access  Private (Admin/Buyer)
 */
router.get('/verify/verify', PaymentController.verifyPayment)

/**
 * @route   GET /api/v1/payments/history
 * @desc    Retrieve transaction history for the authenticated user
 * @access  Private (User specific)
 */
router.get('/history', PaymentController.getPaymentHistory)

export const paymentRouter = router;
