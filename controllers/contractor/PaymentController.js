import prisma from '../../config/database.js';
import { generatePaginationMeta } from '../../utils/helpers.js';
import { asyncHandler } from '../../middleware/errorHandler.js';

class PaymentController {
  // Get contractor's payment history
  static getPaymentHistory = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get contractor
    const contractor = await prisma.contractor.findUnique({
      where: { userId }
    });

    if (!contractor) {
      return res.status(404).json({
        error: 'Contractor profile not found',
        message: 'Please create a contractor profile first'
      });
    }

    const where = {
      job: {
        contractorId: contractor.id
      }
    };

    if (status) where.status = status;
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
          job: {
            select: {
              id: true,
              title: true,
              status: true,
              jobType: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
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

  // Get contractor earnings summary
  static getEarningsSummary = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    // Get contractor
    const contractor = await prisma.contractor.findUnique({
      where: { userId }
    });

    if (!contractor) {
      return res.status(404).json({
        error: 'Contractor profile not found',
        message: 'Please create a contractor profile first'
      });
    }

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [
      completedJobs,
      totalEarnings,
      totalCommissions,
      pendingPayouts,
      monthlyEarnings
    ] = await Promise.all([
      // Completed jobs
      prisma.job.findMany({
        where: {
          contractorId: contractor.id,
          status: 'COMPLETED',
          ...dateFilter
        },
        include: {
          payments: {
            where: {
              status: 'COMPLETED'
            },
            include: {
              commissions: true
            }
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }),
      // Total earnings
      prisma.payment.aggregate({
        where: {
          job: {
            contractorId: contractor.id
          },
          status: 'COMPLETED',
          ...dateFilter
        },
        _sum: { amount: true },
        _count: { id: true }
      }),
      // Total commissions deducted
      prisma.commission.aggregate({
        where: {
          payment: {
            job: {
              contractorId: contractor.id
            },
            status: 'COMPLETED'
          },
          ...dateFilter
        },
        _sum: { amount: true }
      }),
      // Pending payouts
      prisma.payment.aggregate({
        where: {
          job: {
            contractorId: contractor.id
          },
          status: 'PENDING',
          ...dateFilter
        },
        _sum: { amount: true }
      }),
      // Monthly earnings breakdown
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', p.created_at) as month,
          COUNT(*) as job_count,
          SUM(p.amount) as total_earnings,
          SUM(COALESCE(c.amount, 0)) as commissions,
          SUM(p.amount) - SUM(COALESCE(c.amount, 0)) as net_earnings
        FROM payments p
        LEFT JOIN commissions c ON p.id = c.payment_id
        JOIN jobs j ON p.job_id = j.id
        WHERE j.contractor_id = ${contractor.id}
        AND p.status = 'COMPLETED'
        ${startDate && endDate ? `AND p.created_at BETWEEN '${startDate}' AND '${endDate}'` : ''}
        GROUP BY DATE_TRUNC('month', p.created_at)
        ORDER BY month DESC
        LIMIT 12
      `
    ]);

    const totalCommissionAmount = totalCommissions._sum.amount || 0;
    const netEarningsAmount = (totalEarnings._sum.amount || 0) - totalCommissionAmount;

    // Calculate earnings per job
    const jobEarnings = completedJobs.map(job => {
      const jobTotal = job.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const jobCommission = job.payments.reduce((sum, payment) => {
        return sum + (payment.commissions?.reduce((s, c) => s + c.amount, 0) || 0);
      }, 0);
      const jobNetEarnings = jobTotal - jobCommission;

      return {
        jobId: job.id,
        jobTitle: job.title,
        customer: job.user,
        totalEarnings: jobTotal,
        commission: jobCommission,
        netEarnings: jobNetEarnings,
        completedAt: job.updatedAt
      };
    });

    res.json({
      summary: {
        totalJobs: completedJobs.length,
        totalEarnings: totalEarnings._sum.amount || 0,
        totalTransactions: totalEarnings._count || 0,
        commissions: totalCommissionAmount,
        netEarnings: netEarningsAmount,
        pendingPayouts: pendingPayouts._sum.amount || 0

      },
      jobEarnings,
      monthlyEarnings
    });
  });

  // Get contractor payout details
  static getPayoutDetails = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { payoutId } = req.params;

    // Get contractor
    const contractor = await prisma.contractor.findUnique({
      where: { userId }
    });

    if (!contractor) {
      return res.status(404).json({
        error: 'Contractor profile not found',
        message: 'Please create a contractor profile first'
      });
    }

    // TODO: Implement payout details when payout system is added
    // For now, return a placeholder response
    res.json({
      message: 'Payout details endpoint - to be implemented',
      contractor: {
        id: contractor.id,
        businessName: contractor.businessName
      }
    });
  });

  // Request payout
  static requestPayout = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { amount, bankAccountId, notes } = req.body;

    // Get contractor
    const contractor = await prisma.contractor.findUnique({
      where: { userId }
    });

    if (!contractor) {
      return res.status(404).json({
        error: 'Contractor profile not found',
        message: 'Please create a contractor profile first'
      });
    }

    // Check if contractor has sufficient balance
    const totalEarnings = await prisma.payment.aggregate({
      where: {
        job: {
          contractorId: contractor.id
        },
        status: 'COMPLETED'
      },
      _sum: { amount: true }
    });

    const serviceChargeRate = parseFloat(process.env.SERVICE_CHARGE_PERCENT || 5) / 100;
    const totalServiceCharges = (totalEarnings._sum.amount || 0) * serviceChargeRate;
    const availableBalance = (totalEarnings._sum.amount || 0) - totalServiceCharges;

    if (amount > availableBalance) {
      return res.status(400).json({
        error: 'Insufficient balance',
        message: `Available balance: ₹${availableBalance.toFixed(2)}`
      });
    }

    // TODO: Create payout request record
    // TODO: Send notification to admin for approval
    // TODO: Process payout through payment gateway

    res.json({
      message: 'Payout request submitted successfully',
      payout: {
        contractorId: contractor.id,
        amount,
        availableBalance,
        requestedAt: new Date(),
        status: 'PENDING_APPROVAL'
      }
    });
  });

  // Get payment analytics for contractor
  static getPaymentAnalytics = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Get contractor
    const contractor = await prisma.contractor.findUnique({
      where: { userId }
    });

    if (!contractor) {
      return res.status(404).json({
        error: 'Contractor profile not found',
        message: 'Please create a contractor profile first'
      });
    }

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    let groupByClause;
    switch (groupBy) {
      case 'hour':
        groupByClause = `DATE_TRUNC('hour', p.created_at)`;
        break;
      case 'day':
        groupByClause = `DATE(p.created_at)`;
        break;
      case 'week':
        groupByClause = `DATE_TRUNC('week', p.created_at)`;
        break;
      case 'month':
        groupByClause = `DATE_TRUNC('month', p.created_at)`;
        break;
      default:
        groupByClause = `DATE(p.created_at)`;
    }

    const analytics = await prisma.$queryRaw`
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as transaction_count,
        SUM(p.amount) as total_earnings,
        SUM(p.amount) * ${parseFloat(process.env.SERVICE_CHARGE_PERCENT || 5) / 100} as service_charges,
        SUM(p.amount) * (1 - ${parseFloat(process.env.SERVICE_CHARGE_PERCENT || 5) / 100}) as net_earnings,
        AVG(p.amount) as avg_transaction_value
      FROM payments p
      JOIN jobs j ON p.job_id = j.id
      WHERE j.contractor_id = ${contractor.id}
      AND p.status = 'COMPLETED'
      ${startDate && endDate ? `AND p.created_at BETWEEN '${startDate}' AND '${endDate}'` : ''}
      GROUP BY ${groupByClause}
      ORDER BY period DESC
      LIMIT 30
    `;

    res.json({ analytics });
  });

  // Get contractor's bank account details
  static getBankAccountDetails = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Get contractor
    const contractor = await prisma.contractor.findUnique({
      where: { userId },
      select: {
        id: true,
        businessName: true,
        bankAccountNumber: true,
        bankIfscCode: true,
        bankAccountName: true
      }
    });

    if (!contractor) {
      return res.status(404).json({
        error: 'Contractor profile not found',
        message: 'Please create a contractor profile first'
      });
    }

    // Mask bank account number for security
    const maskedAccountNumber = contractor.bankAccountNumber 
      ? contractor.bankAccountNumber.replace(/(\d{4})\d{8}(\d{4})/, '$1********$2')
      : null;

    res.json({
      bankAccount: {
        accountName: contractor.bankAccountName,
        accountNumber: maskedAccountNumber,
        ifscCode: contractor.bankIfscCode,
        businessName: contractor.businessName
      }
    });
  });

  // Update bank account details
  static updateBankAccountDetails = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { bankAccountNumber, bankIfscCode, bankAccountName } = req.body;

    // Get contractor
    const contractor = await prisma.contractor.findUnique({
      where: { userId }
    });

    if (!contractor) {
      return res.status(404).json({
        error: 'Contractor profile not found',
        message: 'Please create a contractor profile first'
      });
    }

    const updatedContractor = await prisma.contractor.update({
      where: { id: contractor.id },
      data: {
        bankAccountNumber,
        bankIfscCode,
        bankAccountName
      },
      select: {
        id: true,
        businessName: true,
        bankAccountNumber: true,
        bankIfscCode: true,
        bankAccountName: true
      }
    });

    // Mask bank account number for response
    const maskedAccountNumber = updatedContractor.bankAccountNumber 
      ? updatedContractor.bankAccountNumber.replace(/(\d{4})\d{8}(\d{4})/, '$1********$2')
      : null;

    res.json({
      message: 'Bank account details updated successfully',
      bankAccount: {
        accountName: updatedContractor.bankAccountName,
        accountNumber: maskedAccountNumber,
        ifscCode: updatedContractor.bankIfscCode,
        businessName: updatedContractor.businessName
      }
    });
  });

  // Get commission details
  static getCommissionDetails = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 10, startDate, endDate } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get contractor
    const contractor = await prisma.contractor.findUnique({
      where: { userId }
    });

    if (!contractor) {
      return res.status(404).json({
        error: 'Contractor profile not found',
        message: 'Please create a contractor profile first'
      });
    }

    const where = {
      payment: {
        job: {
          contractorId: contractor.id
        }
      }
    };

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [commissions, total] = await Promise.all([
      prisma.commission.findMany({
        where,
        include: {
          payment: {
            select: {
              id: true,
              amount: true,
              status: true,
              createdAt: true
            }
          },
          job: {
            select: {
              id: true,
              title: true,
              jobType: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.commission.count({ where })
    ]);

    const paginationMeta = generatePaginationMeta(parseInt(page), parseInt(limit), total);

    res.json({
      commissions: commissions.map(c => ({
        id: c.id,
        jobId: c.jobId,
        jobTitle: c.job.title,
        jobType: c.job.jobType,
        amount: c.amount,
        paymentId: c.payment.id,
        paymentAmount: c.payment.amount,
        paymentStatus: c.payment.status,
        netAmount: c.payment.amount - c.amount,
        createdAt: c.createdAt
      })),
      pagination: paginationMeta
    });
  });
}

export default PaymentController;

