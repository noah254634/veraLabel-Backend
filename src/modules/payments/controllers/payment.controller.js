import { PaymentService } from '../services/payment.service.js'

export const PaymentController = {
  createPayment: async (req, res) => {
    try {
      const { amount, currency, redirectUrl } = req.body
      const result = await PaymentService.createPayment({user: req.user._id, amount, currency, redirectUrl })
      return res.json(result)
    } catch (err) {
      return res.status(400).json({ message: err })
    }
  },

  verifyPayment: async (req, res) => {
    try {
      const { reference } = req.params
      const payment = await PaymentService.verifyPayment(reference)
      return res.json(payment)
    } catch (err) {
      return res.status(400).json({ message: err.message })
    }
  },

  getPaymentHistory: async (req, res) => {
    try {
      const payments = await PaymentService.getPaymentHistory(req.user._id)
      return res.json(payments)
    } catch (err) {
      return res.status(400).json({ message: err.message })
    }
  }
}
