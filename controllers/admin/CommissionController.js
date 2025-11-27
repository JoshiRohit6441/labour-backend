import prisma from '../../config/database.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import handleResponse from '../../utils/handleResponse.js';

class CommissionController {
  // Get all commissions with filters
  static getCommissions = asyncHandler(async (req, res) => {
    const { status, approvalStatus, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const where = {};
    if (status) where.status = status;
    if (approvalStatus) where.approvalStatus = approvalStatus;

    const commissions = await prisma.commission.findMany({
      where,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              }
            },
            contractor: {
              select: {
                businessName: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  }
                }
              }
            }
          }
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            paymentType: true,
          }
        },
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.commission.count({ where });

    const formattedCommissions = commissions.map(c => ({
      id: c.id,
      jobId: c.jobId,
      paymentId: c.paymentId,
      amount: c.amount,
      status: c.status,
      approvalStatus: c.approvalStatus,
      rejectionReason: c.rejectionReason,
      adminNotes: c.adminNotes,
      createdAt: c.createdAt,
      approvedAt: c.approvedAt,
      job: {
        id: c.job?.id,
        title: c.job?.title,
        status: c.job?.status,
        clientName: c.job?.user ? `${c.job.user.firstName} ${c.job.user.lastName}` : 'Unknown',
        clientEmail: c.job?.user?.email,
        contractorName: c.job?.contractor?.businessName || `${c.job?.contractor?.user?.firstName} ${c.job?.contractor?.user?.lastName}`,
        contractorEmail: c.job?.contractor?.user?.email,
      },
      payment: c.payment,
      approver: c.approver ? `${c.approver.firstName} ${c.approver.lastName}` : null,
    }));

    return handleResponse(200, 'Commissions retrieved successfully', {
      commissions: formattedCommissions,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    }, res);
  });

  // Get commission by ID
  static getCommissionById = asyncHandler(async (req, res) => {
    const { commissionId } = req.params;

    const commission = await prisma.commission.findUnique({
      where: { id: commissionId },
      include: {
        job: {
          include: {
            user: true,
            contractor: {
              include: {
                user: true
              }
            }
          }
        },
        payment: true,
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });

    if (!commission) {
      return handleResponse(404, 'Commission not found', {}, res);
    }

    return handleResponse(200, 'Commission retrieved successfully', { commission }, res);
  });

  // Approve commission
  static approveCommission = asyncHandler(async (req, res) => {
    const { commissionId } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.id;

    const commission = await prisma.commission.findUnique({
      where: { id: commissionId },
      include: {
        job: {
          select: {
            contractorId: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              }
            }
          }
        }
      }
    });

    if (!commission) {
      return handleResponse(404, 'Commission not found', {}, res);
    }

    if (commission.approvalStatus !== 'PENDING') {
      return handleResponse(400, `Commission already ${commission.approvalStatus.toLowerCase()}`, {}, res);
    }

    // Validate amount
    if (commission.amount < 0) {
      return handleResponse(400, 'Invalid commission amount', {}, res);
    }

    const updatedCommission = await prisma.commission.update({
      where: { id: commissionId },
      data: {
        approvalStatus: 'APPROVED',
        status: 'PROCESSED',
        approvedBy: adminId,
        approvedAt: new Date(),
        adminNotes: adminNotes || null,
      },
      include: {
        job: {
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              }
            }
          }
        }
      }
    });

    // Notify contractor about commission approval
    const socketService = req.app.get('socketService');
    if (socketService && socketService.sendNotificationToUsers) {
      await socketService.sendNotificationToUsers(
        [commission.job.contractorId],
        'COMMISSION_APPROVED',
        'Commission Approved',
        `Your commission of ₹${commission.amount} has been approved`,
        { commissionId: commission.id }
      );
    }

    return handleResponse(200, 'Commission approved successfully', { commission: updatedCommission }, res);
  });

  // Reject commission
  static rejectCommission = asyncHandler(async (req, res) => {
    const { commissionId } = req.params;
    const { rejectionReason, adminNotes } = req.body;
    const adminId = req.user.id;

    if (!rejectionReason) {
      return handleResponse(400, 'Rejection reason is required', {}, res);
    }

    const commission = await prisma.commission.findUnique({
      where: { id: commissionId },
      include: {
        job: {
          select: {
            contractorId: true,
            title: true,
          }
        }
      }
    });

    if (!commission) {
      return handleResponse(404, 'Commission not found', {}, res);
    }

    if (commission.approvalStatus !== 'PENDING') {
      return handleResponse(400, `Commission already ${commission.approvalStatus.toLowerCase()}`, {}, res);
    }

    const updatedCommission = await prisma.commission.update({
      where: { id: commissionId },
      data: {
        approvalStatus: 'REJECTED',
        approvedBy: adminId,
        approvedAt: new Date(),
        rejectionReason,
        adminNotes: adminNotes || null,
      },
      include: {
        job: {
          select: {
            contractorId: true,
            title: true,
          }
        }
      }
    });

    // Notify contractor about rejection
    const socketService = req.app.get('socketService');
    if (socketService && socketService.sendNotificationToUsers) {
      await socketService.sendNotificationToUsers(
        [commission.job.contractorId],
        'COMMISSION_REJECTED',
        'Commission Rejected',
        `Your commission for "${commission.job.title}" has been rejected. Reason: ${rejectionReason}`,
        { commissionId: commission.id }
      );
    }

    return handleResponse(200, 'Commission rejected successfully', { commission: updatedCommission }, res);
  });

  // Get commission stats
  static getCommissionStats = asyncHandler(async (req, res) => {
    const pending = await prisma.commission.count({
      where: { approvalStatus: 'PENDING' }
    });

    const approved = await prisma.commission.count({
      where: { approvalStatus: 'APPROVED' }
    });

    const rejected = await prisma.commission.count({
      where: { approvalStatus: 'REJECTED' }
    });

    const totalAmount = await prisma.commission.aggregate({
      _sum: { amount: true }
    });

    const approvedAmount = await prisma.commission.aggregate({
      where: { approvalStatus: 'APPROVED' },
      _sum: { amount: true }
    });

    return handleResponse(200, 'Commission stats retrieved successfully', {
      stats: {
        pending,
        approved,
        rejected,
        totalAmount: totalAmount._sum.amount || 0,
        approvedAmount: approvedAmount._sum.amount || 0,
      }
    }, res);
  });
}

export default CommissionController;
