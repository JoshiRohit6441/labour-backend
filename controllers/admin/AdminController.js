import prisma from '../../config/database.js';
import { generatePaginationMeta } from '../../utils/helpers.js';
import { asyncHandler } from '../../middleware/errorHandler.js';

class AdminController {
  // Get dashboard stats
  static getDashboardStats = asyncHandler(async (req, res) => {
    const [
      totalUsers,
      totalContractors,
      totalJobs,
      totalWorkers,
      activeJobs,
      completedJobs,
      pendingVerifications,
      totalRevenue
    ] = await Promise.all([
      prisma.user.count(),
      prisma.contractor.count(),
      prisma.job.count(),
      prisma.worker.count(),
      prisma.job.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.job.count({ where: { status: 'COMPLETED' } }),
      prisma.document.count({ where: { verificationStatus: 'PENDING' } }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
      })
    ]);

    // Get recent activities
    const recentJobs = await prisma.job.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        contractor: {
          select: {
            id: true,
            businessName: true
          }
        }
      }
    });

    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    res.json({
      stats: {
        totalUsers,
        totalContractors,
        totalJobs,
        totalWorkers,
        activeJobs,
        completedJobs,
        pendingVerifications,
        totalRevenue: totalRevenue._sum.amount || 0
      },
      recentActivities: {
        jobs: recentJobs,
        users: recentUsers
      }
    });
  });

  // Get all users
  static getUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, role, status, search } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          contractorProfile: {
            select: {
              id: true,
              businessName: true,
              isActive: true
            }
          },
          _count: {
            select: {
              jobsAsUser: true,
              jobsAsContractor: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.user.count({ where })
    ]);

    const paginationMeta = generatePaginationMeta(parseInt(page), parseInt(limit), total);

    res.json({
      users,
      pagination: paginationMeta
    });
  });

  // Get user details
  static getUserDetails = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        contractorProfile: {
          include: {
            workers: true,
            rateCards: true,
            reviews: {
              include: {
                giver: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        },
        jobsAsUser: {
          include: {
            contractor: {
              select: {
                id: true,
                businessName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        jobsAsContractor: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        documents: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The requested user was not found'
      });
    }

    res.json({ user });
  });

  // Update user status
  static updateUserStatus = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { status } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true
      }
    });

    res.json({
      message: 'User status updated successfully',
      user
    });
  });

  // Get all contractors
  static getContractors = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, isActive, search } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { businessType: { contains: search, mode: 'insensitive' } },
        { businessCity: { contains: search, mode: 'insensitive' } },
        { businessState: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [contractors, total] = await Promise.all([
      prisma.contractor.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              status: true
            }
          },
          workers: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              isActive: true
            }
          },
          _count: {
            select: {
              jobs: true,
              workers: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.contractor.count({ where })
    ]);

    const paginationMeta = generatePaginationMeta(parseInt(page), parseInt(limit), total);

    res.json({
      contractors,
      pagination: paginationMeta
    });
  });

  // Update contractor status
  static updateContractorStatus = asyncHandler(async (req, res) => {
    const { contractorId } = req.params;
    const { isActive } = req.body;

    const contractor = await prisma.contractor.update({
      where: { id: contractorId },
      data: { isActive },
      include: {
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
    });

    res.json({
      message: 'Contractor status updated successfully',
      contractor
    });
  });

  // Get all jobs
  static getJobs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status, jobType, search } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (status) where.status = status;
    if (jobType) where.jobType = jobType;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true
            }
          },
          contractor: {
            select: {
              id: true,
              businessName: true,
              businessPhone: true
            }
          },
          quotes: {
            include: {
              contractor: {
                select: {
                  id: true,
                  businessName: true
                }
              }
            }
          },
          assignments: {
            include: {
              worker: {
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
      prisma.job.count({ where })
    ]);

    const paginationMeta = generatePaginationMeta(parseInt(page), parseInt(limit), total);

    res.json({
      jobs,
      pagination: paginationMeta
    });
  });

  // Get job details
  static getJobDetails = asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true
          }
        },
        contractor: {
          include: {
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
        quotes: {
          include: {
            contractor: {
              select: {
                id: true,
                businessName: true,
                rating: true
              }
            }
          }
        },
        assignments: {
          include: {
            worker: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                skills: true,
                rating: true
              }
            }
          }
        },
        reviews: {
          include: {
            giver: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        payments: true,
        chatRoom: {
          include: {
            messages: {
              include: {
                sender: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    role: true
                  }
                }
              },
              orderBy: { createdAt: 'desc' },
              take: 20
            }
          }
        }
      }
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'The requested job was not found'
      });
    }

    res.json({ job });
  });

  // Get pending verifications
  static getPendingVerifications = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, documentType } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { verificationStatus: 'PENDING' };

    if (documentType) where.documentType = documentType;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
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
          worker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              contractor: {
                select: {
                  id: true,
                  businessName: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.document.count({ where })
    ]);

    const paginationMeta = generatePaginationMeta(parseInt(page), parseInt(limit), total);

    res.json({
      documents,
      pagination: paginationMeta
    });
  });

  // Verify document
  static verifyDocument = asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const { verificationStatus, rejectionReason } = req.body;
    const adminId = req.user.id;

    const document = await prisma.document.update({
      where: { id: documentId },
      data: {
        verificationStatus,
        verifiedAt: verificationStatus === 'VERIFIED' ? new Date() : null,
        verifiedBy: adminId,
        rejectionReason: verificationStatus === 'REJECTED' ? rejectionReason : null
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // If document is verified, check if user/worker should be marked as verified
    if (verificationStatus === 'VERIFIED') {
      if (document.userId) {
        // Check if user has all required documents verified
        const userDocuments = await prisma.document.findMany({
          where: { userId: document.userId }
        });

        const allVerified = userDocuments.every(doc => doc.verificationStatus === 'VERIFIED');
        if (allVerified) {
          await prisma.user.update({
            where: { id: document.userId },
            data: { isVerified: true }
          });
        }
      } else if (document.workerId) {
        // Check if worker has all required documents verified
        const workerDocuments = await prisma.document.findMany({
          where: { workerId: document.workerId }
        });

        const allVerified = workerDocuments.every(doc => doc.verificationStatus === 'VERIFIED');
        if (allVerified) {
          await prisma.worker.update({
            where: { id: document.workerId },
            data: { isVerified: true }
          });
        }
      }
    }

    res.json({
      message: 'Document verification updated successfully',
      document
    });
  });

  // Get payments
  static getPayments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status, paymentType, startDate, endDate } = req.query;

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
              phone: true
            }
          },
          job: {
            select: {
              id: true,
              title: true,
              status: true
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

  // Get reports
  static getReports = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [
      jobStats,
      revenueStats,
      userStats,
      contractorStats
    ] = await Promise.all([
      // Job statistics
      prisma.job.groupBy({
        by: ['status'],
        _count: { status: true },
        where: dateFilter
      }),
      // Revenue statistics
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          ...dateFilter
        },
        _sum: { amount: true },
        _count: { id: true }
      }),
      // User statistics
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true },
        where: dateFilter
      }),
      // Contractor statistics
      prisma.contractor.aggregate({
        where: {
          isActive: true,
          ...dateFilter
        },
        _count: { id: true },
        _avg: { rating: true }
      })
    ]);

    res.json({
      jobStats,
      revenueStats,
      userStats,
      contractorStats
    });
  });

  // Get audit logs
  static getAuditLogs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, action, entityType, userId } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (userId) where.userId = userId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.auditLog.count({ where })
    ]);

    const paginationMeta = generatePaginationMeta(parseInt(page), parseInt(limit), total);

    res.json({
      logs,
      pagination: paginationMeta
    });
  });
}

export default AdminController;
