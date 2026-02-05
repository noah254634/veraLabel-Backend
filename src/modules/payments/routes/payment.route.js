import express from 'express'
import { protectRoute } from '../../../middlewares/auth.middleware.js'
import { PaymentController } from '../controllers/payment.controller.js'

const router = express.Router()

router.use(protectRoute)

router.post('/create', PaymentController.createPayment)
router.get('/verify/:reference', PaymentController.verifyPayment)
router.get('/history', PaymentController.getPaymentHistory)

export const paymentRouter = router;

