import Payment from '../models/payment.model.js'
import { PaymentProvider } from '../payment.provider.js'

export const PaymentService = {
  createPayment: async ({ user, amount, currency, redirectUrl }) => {
    const payment = await Payment.create({
      payerUserId: user._id,
      amount,
      currency,
      provider: 'flutterwave',
      status: 'pending',
      reference: `PAY_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    })

    const providerResponse = await PaymentProvider.initiatePayment({
      amount,
      currency,
      user,
      redirectUrl
    })

    return { payment, providerResponse }
  },

  verifyPayment: async (reference) => {
    const providerResult = await PaymentProvider.verifyPayment(reference)

    const payment = await Payment.findOne({ reference })
    if (!payment) throw new Error('Payment not found')

    payment.status = providerResult.status === 'successful' ? 'success' : 'failed'
    await payment.save()

    return payment
  },

  getPaymentHistory: async (userId) => {
    return Payment.find({ user: userId }).sort({ createdAt: -1 })
  }
}
