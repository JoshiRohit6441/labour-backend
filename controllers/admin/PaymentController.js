import prisma from '../../config/database.js';
import { generatePaginationMeta } from '../../utils/helpers.js';
import { asyncHandler } from '../../middleware/errorHandler.js';

class PaymentController {
  // Get all payments with admin view
  static getAllPayments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status, paymentType, startDate, endDate, search } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (status) where.status = status;
    if (paymentType) where.paymentType = paymentType;
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              role: true
            }
          },
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

  // Get payment analytics
  static getPaymentAnalytics = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [
      totalRevenue,
      completedPayments,
      pendingPayments,
      failedPayments,
      refundedPayments,
      serviceChargeEarned,
      paymentStatsByType,
      dailyRevenue
    ] = await Promise.all([
      // Total revenue
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          ...dateFilter
        },
        _sum: { amount: true },
        _count: { id: true }
      }),
      // Completed payments
      prisma.payment.count({
        where: {
          status: 'COMPLETED',
          ...dateFilter
        }
      }),
      // Pending payments
      prisma.payment.count({
        where: {
          status: 'PENDING',
          ...dateFilter
        }
      }),
      // Failed payments
      prisma.payment.count({
        where: {
          status: 'FAILED',
          ...dateFilter
        }
      }),
      // Refunded payments
      prisma.payment.count({
        where: {
          status: 'REFUNDED',
          ...dateFilter
        }
      }),
      // Service charge earned (platform commission)
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          ...dateFilter
        },
        _sum: { amount: true }
      }),
      // Payment stats by type
      prisma.payment.groupBy({
        by: ['paymentType'],
        where: dateFilter,
        _count: { paymentType: true },
        _sum: { amount: true }
      }),
      // Daily revenue for chart
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          SUM(amount) as total_amount
        FROM payments 
        WHERE status = 'COMPLETED'
        ${startDate && endDate ? `AND created_at BETWEEN '${startDate}' AND '${endDate}'` : ''}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `
    ]);

    const serviceChargeRate = parseFloat(process.env.SERVICE_CHARGE_PERCENT || 5) / 100;
    const totalServiceCharge = (serviceChargeEarned._sum.amount || 0) * serviceChargeRate;

    res.json({
      analytics: {
        totalRevenue: totalRevenue._sum.amount || 0,
        totalTransactions: totalRevenue._count || 0,
        serviceChargeEarned: totalServiceCharge,
        netRevenue: (totalRevenue._sum.amount || 0) - totalServiceCharge,
        completedPayments,
        pendingPayments,
        failedPayments,
        refundedPayments
      },
      paymentStatsByType,
      dailyRevenue
    });
  });

  // Approve refund request
  static approveRefund = asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const { refundAmount, reason, adminNotes } = req.body;
    const adminId = req.user.id;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        job: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found',
        message: 'The requested payment was not found'
      });
    }

    if (payment.status !== 'COMPLETED') {
      return res.status(400).json({
        error: 'Cannot refund payment',
        message: 'Only completed payments can be refunded'
      });
    }

    // Update payment with refund details
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'REFUNDED',
        refundAmount,
        refundReason: reason,
        gatewayResponse: {
          ...payment.gatewayResponse,
          adminApproval: {
            approvedBy: adminId,
            approvedAt: new Date(),
            reason,
            adminNotes
          }
        }
      }
    });

    // TODO: Process actual refund through payment gateway
    // TODO: Send notification to user about refund approval

    res.json({
      message: 'Refund approved successfully',
      payment: updatedPayment
    });
  });

  // Reject refund request
  static rejectRefund = asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found',
        message: 'The requested payment was not found'
      });
    }

    // Update payment with rejection details
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        gatewayResponse: {
          ...payment.gatewayResponse,
          refundRejection: {
            rejectedBy: adminId,
            rejectedAt: new Date(),
            reason
          }
        }
      }
    });

    // TODO: Send notification to user about refund rejection

    res.json({
      message: 'Refund request rejected',
      payment: updatedPayment
    });
  });

  // Get contractor payouts summary
  static getContractorPayouts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, contractorId, status } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (contractorId) {
      where.job = {
        contractorId
      };
    }

    // Get completed jobs with payments
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where: {
          status: 'COMPLETED',
          ...where
        },
        include: {
          contractor: {
            select: {
              id: true,
              businessName: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true
                }
              }
            }
          },
          payments: {
            where: {
              status: 'COMPLETED'
            }
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.job.count({
        where: {
          status: 'COMPLETED',
          ...where
        }
      })
    ]);

    // Calculate payouts
    const payouts = jobs.map(job => {
      const totalEarnings = job.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const serviceChargeRate = parseFloat(process.env.SERVICE_CHARGE_PERCENT || 5) / 100;
      const serviceCharge = totalEarnings * serviceChargeRate;
      const netPayout = totalEarnings - serviceCharge;

      return {
        jobId: job.id,
        jobTitle: job.title,
        contractor: job.contractor,
        customer: job.user,
        totalEarnings,
        serviceCharge,
        netPayout,
        completedAt: job.updatedAt,
        payments: job.payments
      };
    });

    const paginationMeta = generatePaginationMeta(parseInt(page), parseInt(limit), total);

    res.json({
      payouts,
      pagination: paginationMeta
    });
  });

  // Process contractor payout
  static processContractorPayout = asyncHandler(async (req, res) => {
    const { contractorId } = req.params;
    const { jobIds, payoutAmount, notes } = req.body;
    const adminId = req.user.id;

    // Verify contractor exists
    const contractor = await prisma.contractor.findUnique({
      where: { id: contractorId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!contractor) {
      return res.status(404).json({
        error: 'Contractor not found',
        message: 'The requested contractor was not found'
      });
    }

    // TODO: Process actual payout through payment gateway
    // TODO: Create payout record in database
    // TODO: Send notification to contractor

    res.json({
      message: 'Payout processed successfully',
      payout: {
        contractorId,
        contractor: contractor.user,
        amount: payoutAmount,
        jobIds,
        processedBy: adminId,
        processedAt: new Date(),
        notes
      }
    });
  });

  // Get payment disputes
  static getPaymentDisputes = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {
      status: 'DISPUTED'
    };

    const [disputes, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true
            }
          },
          job: {
            include: {
              contractor: {
                select: {
                  id: true,
                  businessName: true,
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true
                    }
                  }
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
      disputes,
      pagination: paginationMeta
    });
  });

  // Resolve payment dispute
  static resolvePaymentDispute = asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const { resolution, resolutionNotes, refundAmount } = req.body;
    const adminId = req.user.id;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        job: true,
        user: true
      }
    });

    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found',
        message: 'The requested payment was not found'
      });
    }

    if (payment.status !== 'DISPUTED') {
      return res.status(400).json({
        error: 'Payment not in dispute',
        message: 'This payment is not currently in dispute'
      });
    }

    // Update payment with resolution
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: resolution === 'REFUND_APPROVED' ? 'REFUNDED' : 'COMPLETED',
        refundAmount: resolution === 'REFUND_APPROVED' ? refundAmount : null,
        gatewayResponse: {
          ...payment.gatewayResponse,
          disputeResolution: {
            resolvedBy: adminId,
            resolvedAt: new Date(),
            resolution,
            resolutionNotes,
            refundAmount: resolution === 'REFUND_APPROVED' ? refundAmount : null
          }
        }
      }
    });

    // TODO: Process refund if approved
    // TODO: Send notifications to both parties

    res.json({
      message: 'Payment dispute resolved successfully',
      payment: updatedPayment
    });
  });
}

export default PaymentController;
