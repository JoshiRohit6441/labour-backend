import prisma from '../../config/database.js';
import { generatePaginationMeta } from '../../utils/helpers.js';
import { asyncHandler } from '../../middleware/errorHandler.js';

class JobController {
  // Get all jobs with admin view
  static getAllJobs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status, jobType, search, startDate, endDate } = req.query;

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
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
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
              email: true,
              phone: true,
              role: true
            }
          },
          contractor: {
            select: {
              id: true,
              businessName: true,
              businessPhone: true,
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
          payments: {
            select: {
              id: true,
              amount: true,
              paymentType: true,
              status: true,
              createdAt: true
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

  // Get job analytics
  static getJobAnalytics = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [
      totalJobs,
      jobsByStatus,
      jobsByType,
      averageJobValue,
      topContractors,
      topSkills,
      dailyJobStats
    ] = await Promise.all([
      // Total jobs
      prisma.job.count({
        where: dateFilter
      }),
      // Jobs by status
      prisma.job.groupBy({
        by: ['status'],
        where: dateFilter,
        _count: { status: true }
      }),
      // Jobs by type
      prisma.job.groupBy({
        by: ['jobType'],
        where: dateFilter,
        _count: { jobType: true }
      }),
      // Average job value
      prisma.job.aggregate({
        where: {
          status: 'COMPLETED',
          ...dateFilter
        },
        _avg: { acceptedQuote: true }
      }),
      // Top contractors by job count
      prisma.job.groupBy({
        by: ['contractorId'],
        where: {
          status: 'COMPLETED',
          ...dateFilter
        },
        _count: { contractorId: true },
        _avg: { acceptedQuote: true }
      }),
      // Top skills
      prisma.$queryRaw`
        SELECT 
          unnest(required_skills) as skill,
          COUNT(*) as job_count
        FROM jobs 
        WHERE created_at BETWEEN ${startDate || '2020-01-01'} AND ${endDate || new Date()}
        GROUP BY skill
        ORDER BY job_count DESC
        LIMIT 10
      `,
      // Daily job stats
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_jobs,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_jobs,
          AVG(accepted_quote) as avg_value
        FROM jobs 
        WHERE created_at BETWEEN ${startDate || '2020-01-01'} AND ${endDate || new Date()}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `
    ]);

    // Get contractor details for top contractors
    const contractorIds = topContractors.map(c => c.contractorId).filter(Boolean);
    const contractorDetails = await prisma.contractor.findMany({
      where: {
        id: { in: contractorIds }
      },
      select: {
        id: true,
        businessName: true,
        rating: true,
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    const topContractorsWithDetails = topContractors.map(contractor => {
      const details = contractorDetails.find(c => c.id === contractor.contractorId);
      return {
        ...contractor,
        contractor: details
      };
    });

    res.json({
      analytics: {
        totalJobs,
        averageJobValue: averageJobValue._avg.acceptedQuote || 0
      },
      jobsByStatus,
      jobsByType,
      topContractors: topContractorsWithDetails,
      topSkills,
      dailyJobStats
    });
  });

  // Get job details with admin view
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
            state: true,
            pincode: true,
            role: true,
            status: true,
            isVerified: true,
            createdAt: true
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
                rating: true,
                totalJobs: true,
                completedJobs: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        assignments: {
          include: {
            worker: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                skills: true,
                rating: true,
                experience: true,
                contractor: {
                  select: {
                    id: true,
                    businessName: true
                  }
                }
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
        payments: {
          orderBy: { createdAt: 'desc' }
        },
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
        },
        locationUpdates: {
          orderBy: { timestamp: 'desc' },
          take: 10
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

  // Update job status (admin override)
  static updateJobStatus = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const { status, reason, adminNotes } = req.body;
    const adminId = req.user.id;

    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'The requested job was not found'
      });
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status }
    });

    // Log admin action
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'UPDATE_JOB_STATUS',
        entityType: 'Job',
        entityId: jobId,
        oldValues: { status: job.status },
        newValues: { status, reason, adminNotes }
      }
    });

    // TODO: Send notifications to relevant parties

    res.json({
      message: 'Job status updated successfully',
      job: updatedJob
    });
  });

  // Cancel job (admin override)
  static cancelJob = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const { reason, refundAmount } = req.body;
    const adminId = req.user.id;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        payments: true
      }
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'The requested job was not found'
      });
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' }
    });

    // Log admin action
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'CANCEL_JOB',
        entityType: 'Job',
        entityId: jobId,
        oldValues: { status: job.status },
        newValues: { status: 'CANCELLED', reason, refundAmount }
      }
    });

    // TODO: Process refunds if applicable
    // TODO: Send notifications to relevant parties

    res.json({
      message: 'Job cancelled successfully',
      job: updatedJob
    });
  });

  // Get job disputes
  static getJobDisputes = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where: { status: 'DISPUTED' },
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
          reviews: {
            where: {
              rating: { lte: 2 }
            },
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
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.job.count({
        where: { status: 'DISPUTED' }
      })
    ]);

    const paginationMeta = generatePaginationMeta(parseInt(page), parseInt(limit), total);

    res.json({
      disputes: jobs,
      pagination: paginationMeta
    });
  });

  // Resolve job dispute
  static resolveJobDispute = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const { resolution, resolutionNotes, refundAmount, penaltyAmount } = req.body;
    const adminId = req.user.id;

    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'The requested job was not found'
      });
    }

    if (job.status !== 'DISPUTED') {
      return res.status(400).json({
        error: 'Job not in dispute',
        message: 'This job is not currently in dispute'
      });
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status: resolution }
    });

    // Log admin action
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'RESOLVE_JOB_DISPUTE',
        entityType: 'Job',
        entityId: jobId,
        oldValues: { status: job.status },
        newValues: { 
          status: resolution, 
          resolutionNotes, 
          refundAmount, 
          penaltyAmount 
        }
      }
    });

    // TODO: Process refunds/penalties if applicable
    // TODO: Send notifications to both parties

    res.json({
      message: 'Job dispute resolved successfully',
      job: updatedJob
    });
  });

  // Get job reports
  static getJobReports = asyncHandler(async (req, res) => {
    const { startDate, endDate, groupBy = 'day' } = req.query;

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
        groupByClause = `DATE_TRUNC('hour', created_at)`;
        break;
      case 'day':
        groupByClause = `DATE(created_at)`;
        break;
      case 'week':
        groupByClause = `DATE_TRUNC('week', created_at)`;
        break;
      case 'month':
        groupByClause = `DATE_TRUNC('month', created_at)`;
        break;
      default:
        groupByClause = `DATE(created_at)`;
    }

    const reports = await prisma.$queryRaw`
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_jobs,
        COUNT(CASE WHEN status = 'DISPUTED' THEN 1 END) as disputed_jobs,
        AVG(accepted_quote) as avg_job_value,
        SUM(accepted_quote) as total_revenue
      FROM jobs 
      WHERE created_at BETWEEN ${startDate || '2020-01-01'} AND ${endDate || new Date()}
      GROUP BY ${groupByClause}
      ORDER BY period DESC
    `;

    res.json({ reports });
  });
}

export default JobController;
