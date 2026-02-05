import { ENV } from '../../config/env.js'   
import axios from 'axios'

export const PaymentProvider = {
  initiatePayment: async ({ amount, currency, user, redirectUrl }) => {
    // Call Flutterwave API
    const response = await axios.post('https://api.flutterwave.com/v3/payments', {
      amount,
      currency,
      customer: { id: user._id, email: user.email },
      redirect_url: redirectUrl
    }, {
      headers: { Authorization: `Bearer ${ENV().FLUTTERWAVE_KEY}` }
    })

    return response.data
  },

  verifyPayment: async (reference) => {
    const response = await axios.get(`https://api.flutterwave.com/v3/transactions/${reference}/verify`, {
      headers: { Authorization: `Bearer ${ENV().FLUTTERWAVE_KEY}` }
    })
    return response.data
  }
}
