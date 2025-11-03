import prisma from '../../config/database.js';
import razorpay from '../../config/razorpayConfig.js';
import { generatePaginationMeta } from '../../utils/helpers.js';
import { asyncHandler } from '../../middleware/errorHandler.js';

class PaymentController {
  // Razorpay webhook handler (public)
  static handleWebhook = asyncHandler(async (req, res) => {
    // For now, acknowledge receipt to avoid retries. Implement signature verification if needed.
    try {
      const event = req.body;
      await prisma.webhookEvent?.create?.({
        data: {
          provider: 'razorpay',
          eventType: event?.event || 'unknown',
          payload: event,
        }
      }).catch(() => {});
    } catch (e) {
      // ignore persistence errors for now
    }
    res.status(200).json({ received: true });
  });
  // Create payment order
  static createOrder = asyncHandler(async (req, res) => {
    const { jobId, amount, paymentType } = req.body;
    const userId = req.user.id;

    const job = await prisma.job.findFirst({
      where: { id: jobId, userId },
      include: { quotes: { where: { id: { equals: prisma.job.fields.acceptedQuoteId } } } }
    });

    if (!job) {
      return handleResponse(404, 'Job not found or you do not have permission to make payments', null, res);
    }

    let finalAmount = amount;

    if (paymentType === 'ADVANCE') {
      const acceptedQuote = job.quotes[0];
      if (!acceptedQuote || !acceptedQuote.advanceRequested) {
        return handleResponse(400, 'Advance payment has not been requested for this job.', null, res);
      }
      if (amount !== acceptedQuote.advanceAmount) {
        return handleResponse(400, `Advance payment amount must be exactly ₹${acceptedQuote.advanceAmount}.`, null, res);
      }
      if (job.advancePaid > 0) {
        return handleResponse(400, 'An advance payment has already been made for this job.', null, res);
      }
      finalAmount = acceptedQuote.advanceAmount;
    }

    const serviceChargeRate = parseFloat(process.env.SERVICE_CHARGE_PERCENT || 5) / 100;
    const serviceCharge = finalAmount * serviceChargeRate;
    const totalAmount = finalAmount + serviceCharge;

    const orderOptions = {
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: `job_${jobId}_${paymentType}_${Date.now()}`,
      notes: {
        jobId,
        userId,
        paymentType,
        serviceCharge,
        netAmount: finalAmount
      }
    };

    try {
      const order = await razorpay.orders.create(orderOptions);

      const payment = await prisma.payment.create({
        data: {
          jobId,
          userId,
          amount: totalAmount,
          paymentType,
          gateway: 'razorpay',
          gatewayId: order.id,
          status: 'PENDING'
        }
      });

      res.json({
        message: 'Payment order created successfully',
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          receipt: order.receipt
        },
        payment: {
          id: payment.id,
          amount: payment.amount,
          paymentType: payment.paymentType,
          status: payment.status,
          serviceCharge,
          netAmount: finalAmount
        }
      });
    } catch (error) {
      console.error('Razorpay order creation failed:', error);
      res.status(500).json({
        error: 'Payment order creation failed',
        message: 'Unable to create payment order. Please try again.'
      });
    }
  });

  // Verify payment
  static verifyPayment = asyncHandler(async (req, res) => {
    const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    // Get payment record
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        job: true
      }
    });

    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found',
        message: 'Payment record not found'
      });
    }

    if (payment.status !== 'PENDING') {
      return res.status(400).json({
        error: 'Payment already processed',
        message: 'This payment has already been processed'
      });
    }

    // Verify Razorpay signature
    const crypto = require('crypto');
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({
        error: 'Invalid signature',
        message: 'Payment verification failed'
      });
    }

    try {
      // Fetch payment details from Razorpay
      const razorpayPayment = await razorpay.payments.fetch(razorpayPaymentId);

      // Update payment record
      const updatedPayment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'COMPLETED',
          gatewayId: razorpayPaymentId,
          gatewayResponse: razorpayPayment,
          processedAt: new Date()
        }
      });

      // Update job payment status
      if (payment.paymentType === 'advance') {
        await prisma.job.update({
          where: { id: payment.jobId },
          data: {
            advancePaid: payment.amount,
            totalPaid: { increment: payment.amount }
          }
        });
      } else if (payment.paymentType === 'final') {
        await prisma.job.update({
          where: { id: payment.jobId },
          data: {
            totalPaid: { increment: payment.amount }
          }
        });
      }

      res.json({
        message: 'Payment verified successfully',
        payment: updatedPayment
      });
    } catch (error) {
      console.error('Payment verification failed:', error);
      
      // Update payment as failed
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          gatewayResponse: { error: error.message }
        }
      });

      res.status(500).json({
        error: 'Payment verification failed',
        message: 'Unable to verify payment. Please try again.'
      });
    }
  });

  // Get user's payment history
  static getPaymentHistory = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 10, status, paymentType } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { userId };

    if (status) where.status = status;
    if (paymentType) where.paymentType = paymentType;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              status: true,
              jobType: true,
              contractor: {
                select: {
                  id: true,
                  businessName: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.payment.count({ where })
    ]);

    const paginationMeta = generatePaginationMeta(parseInt(page), parseInt(limit), total);

    res.json({
      payments,
      pagination: paginationMeta
    });
  });

  // Get payment details
  static getPaymentDetails = asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const userId = req.user.id;

    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        userId
      },
      include: {
        job: {
          include: {
            contractor: {
              select: {
                id: true,
                businessName: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    phone: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found',
        message: 'Payment not found or you do not have permission to view it'
      });
    }

    res.json({ payment });
  });

  // Initiate refund request
  static initiateRefund = asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const { refundAmount, reason } = req.body;
    const userId = req.user.id;

    // Get payment record
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        userId
      }
    });

    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found',
        message: 'Payment not found or you do not have permission to refund it'
      });
    }

    if (payment.status !== 'COMPLETED') {
      return res.status(400).json({
        error: 'Cannot refund payment',
        message: 'Only completed payments can be refunded'
      });
    }

    if (!payment.gatewayId) {
      return res.status(400).json({
        error: 'Cannot refund payment',
        message: 'Payment gateway information not available'
      });
    }

    // Update payment with refund request
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'REFUND_REQUESTED',
        refundAmount,
        refundReason: reason,
        gatewayResponse: {
          ...payment.gatewayResponse,
          refundRequest: {
            requestedAt: new Date(),
            reason,
            amount: refundAmount
          }
        }
      }
    });

    // TODO: Send notification to admin for refund approval
    // TODO: Send notification to user about refund request submission

    res.json({
      message: 'Refund request submitted successfully',
      payment: updatedPayment
    });
  });

  // Get user's payment analytics
  static getPaymentAnalytics = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [
      totalSpent,
      paymentsByType,
      paymentsByStatus,
      serviceChargesPaid,
      monthlySpending
    ] = await Promise.all([
      // Total spent
      prisma.payment.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          ...dateFilter
        },
        _sum: { amount: true },
        _count: { id: true }
      }),
      // Payments by type
      prisma.payment.groupBy({
        by: ['paymentType'],
        where: {
          userId,
          ...dateFilter
        },
        _count: { paymentType: true },
        _sum: { amount: true }
      }),
      // Payments by status
      prisma.payment.groupBy({
        by: ['status'],
        where: {
          userId,
          ...dateFilter
        },
        _count: { status: true }
      }),
      // Service charges paid
      prisma.payment.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          ...dateFilter
        },
        _sum: { amount: true }
      }),
      // Monthly spending
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as payment_count,
          SUM(amount) as total_spent,
          SUM(amount) * ${parseFloat(process.env.SERVICE_CHARGE_PERCENT || 5) / 100} as service_charges,
          SUM(amount) * (1 - ${parseFloat(process.env.SERVICE_CHARGE_PERCENT || 5) / 100}) as net_spent
        FROM payments 
        WHERE user_id = ${userId}
        AND status = 'COMPLETED'
        ${startDate && endDate ? `AND created_at BETWEEN '${startDate}' AND '${endDate}'` : ''}
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month DESC
        LIMIT 12
      `
    ]);

    const serviceChargeRate = parseFloat(process.env.SERVICE_CHARGE_PERCENT || 5) / 100;
    const totalServiceCharges = (serviceChargesPaid._sum.amount || 0) * serviceChargeRate;
    const netSpent = (totalSpent._sum.amount || 0) - totalServiceCharges;

    res.json({
      analytics: {
        totalSpent: totalSpent._sum.amount || 0,
        totalTransactions: totalSpent._count || 0,
        serviceChargesPaid: totalServiceCharges,
        netSpent,
        serviceChargeRate: serviceChargeRate * 100
      },
      paymentsByType,
      paymentsByStatus,
      monthlySpending
    });
  });

  // Get payment methods (placeholder for future implementation)
  static getPaymentMethods = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // TODO: Implement saved payment methods when needed
    // For now, return empty array
    res.json({
      paymentMethods: []
    });
  });

  // Add payment method (placeholder for future implementation)
  static addPaymentMethod = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const paymentMethodData = req.body;

    // TODO: Implement adding payment methods when needed
    res.status(501).json({
      error: 'Not implemented',
      message: 'Payment method management is not yet implemented'
    });
  });

  // Remove payment method (placeholder for future implementation)
  static removePaymentMethod = asyncHandler(async (req, res) => {
    const { methodId } = req.params;
    const userId = req.user.id;

    // TODO: Implement removing payment methods when needed
    res.status(501).json({
      error: 'Not implemented',
      message: 'Payment method management is not yet implemented'
    });
  });
}

export default PaymentController;

