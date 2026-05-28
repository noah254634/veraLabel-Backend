import { ENV } from '../../config/env.js'
import axios from 'axios'
import logger from '../../config/logger.js';
import Paystack from 'paystack'
const paystack = new Paystack(ENV().paystack_secret_key)

export const PaymentProvider = {
  initiatePayment: async ({ email, amount, reference, redirectUrl, currency, user }) => {
    try {
      const response = await paystack.transaction.initialize({
        reference,
        email: email || user?.email,
        amount: Math.round(Number(amount) * 100), // Paystack expects amount in kobo/cents
        currency: currency,
        metadata: {
          custom_fields: [
            {
              display_name: 'Name',
              variable_name: 'name',
              value: user?.name || ''
            },
            {
              display_name: 'Email',
              variable_name: 'email',
              value: user?.email
            }
          ]
        },
        callback_url: `http://localhost:5173/payments/success`
      })
      if (!response || !response.status) {
        const message = response?.message || 'Paystack payment initialization failed';
        throw new Error(message);
      }
      return response.data;
    } catch (err) {
      logger.error(`Error initializing Paystack transaction: ${err.message}`);
      throw err;
    }
  },
  verifyPayment: async (ref) => {
    try {
      const response = await paystack.transaction.verify(ref);
      if (!response || !response.status) {
        const message = response?.message || 'Paystack payment verification failed';
        throw new Error(message);
      }
      return response.data;
    } catch (err) {
      logger.error(`Error verifying Paystack transaction: ${err.message}`);
      throw err;
    }
  }
}
