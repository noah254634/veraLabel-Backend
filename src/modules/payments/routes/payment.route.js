import express from 'express'
import { protectRoute } from '../../../middlewares/auth.middleware.js'
import { PaymentController } from '../controllers/payment.controller.js'
import { checkisBlocked } from '../../../middlewares/block.middleware.js'
import authorize from '../../../middlewares/authorization.middleware.js'

const router = express.Router()

router.post('/paystack/webhook', PaymentController.verifyPayment)

router.use(protectRoute)
router.use(checkisBlocked)
router.use(authorize('admin', 'buyer', 'labeler'))
router.post('/create', PaymentController.createPayment)
router.get('/verify/verify', PaymentController.verifyPayment)
router.get('/history', PaymentController.getPaymentHistory)

export const paymentRouter = router;
