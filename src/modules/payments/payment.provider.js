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
        callback_url: `${ENV().frontend_url || 'http://localhost:5173'}/payments/success`
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
  },
  createTransferRecipient: async (name, phoneNumber) => {
    try {
      const response = await axios.post('https://api.paystack.co/transferrecipient', {
        type: 'mobile_money',
        name: name,
        account_number: phoneNumber,
        bank_code: 'MPESA',
        currency: 'KES'
      }, {
        headers: {
          Authorization: `Bearer ${ENV().paystack_secret_key}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.data || !response.data.status) {
        throw new Error(response.data?.message || 'Failed to create transfer recipient');
      }
      return response.data.data;
    } catch (err) {
      logger.error(`Error creating transfer recipient: ${err.response?.data?.message || err.message}`);
      throw new Error(err.response?.data?.message || err.message);
    }
  },
  initiateTransfer: async (amount, recipientCode, reference, reason = 'Withdrawal to M-Pesa') => {
    try {
      const response = await axios.post('https://api.paystack.co/transfer', {
        source: 'balance',
        amount: Math.round(Number(amount) * 100), // Paystack uses lowest denomination (e.g. cents)
        recipient: recipientCode,
        reason: reason,
        reference: reference
      }, {
        headers: {
          Authorization: `Bearer ${ENV().paystack_secret_key}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.data || !response.data.status) {
        throw new Error(response.data?.message || 'Failed to initiate transfer');
      }
      return response.data.data;
    } catch (err) {
      logger.error(`Error initiating transfer: ${err.response?.data?.message || err.message}`);
      throw new Error(err.response?.data?.message || err.message);
    }
  }
}
