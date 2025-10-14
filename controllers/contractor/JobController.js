import prisma from '../../config/database.js';
import { calculateDistance, generatePaginationMeta } from '../../utils/helpers.js';
import { asyncHandler } from '../../middleware/errorHandler.js';

class JobController {
  // Get contractor's jobs
  static getContractorJobs = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 10, status, jobType } = req.query;

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

    const where = { contractorId: contractor.id };
    if (status) where.status = status;
    if (jobType) where.jobType = jobType;

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              rating: true
            }
          },
          quotes: {
            where: { contractorId: contractor.id }
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
              status: true
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

  // Get nearby jobs for contractor
  static getNearbyJobs = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { latitude, longitude, radius = 20, page = 1, limit = 10, skills } = req.query;

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
      status: { in: ['PENDING', 'QUOTED'] },
      jobType: { in: ['IMMEDIATE', 'BIDDING'] }
    };

    if (skills) {
      where.requiredSkills = {
        hasSome: skills.split(',')
      };
    }

    // Get all jobs matching criteria
    const allJobs = await prisma.job.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rating: true
          }
        },
        quotes: {
          where: { contractorId: contractor.id }
        }
      }
    });

    // Filter jobs by distance
    const nearbyJobs = allJobs.filter(job => {
      const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        job.latitude,
        job.longitude
      );
      return distance <= parseFloat(radius);
    });

    // Sort by distance and paginate
    const sortedJobs = nearbyJobs
      .sort((a, b) => {
        const distanceA = calculateDistance(
          parseFloat(latitude),
          parseFloat(longitude),
          a.latitude,
          a.longitude
        );
        const distanceB = calculateDistance(
          parseFloat(latitude),
          parseFloat(longitude),
          b.latitude,
          b.longitude
        );
        return distanceA - distanceB;
      })
      .slice(skip, skip + parseInt(limit));

    const paginationMeta = generatePaginationMeta(parseInt(page), parseInt(limit), nearbyJobs.length);

    res.json({
      jobs: sortedJobs,
      pagination: paginationMeta
    });
  });

  // Submit quote for job
  static submitQuote = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;
    const { amount, estimatedArrival, notes } = req.body;

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

    // Check if job exists and is in correct status
    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'The requested job was not found'
      });
    }

    if (job.status !== 'PENDING' && job.status !== 'QUOTED') {
      return res.status(400).json({
        error: 'Cannot submit quote',
        message: 'Job is not accepting quotes in its current status'
      });
    }

    // Check if contractor already submitted a quote
    const existingQuote = await prisma.quote.findFirst({
      where: {
        jobId,
        contractorId: contractor.id
      }
    });

    if (existingQuote) {
      return res.status(409).json({
        error: 'Quote already exists',
        message: 'You have already submitted a quote for this job'
      });
    }

    const quote = await prisma.quote.create({
      data: {
        jobId,
        contractorId: contractor.id,
        amount,
        estimatedArrival,
        notes
      },
      include: {
        contractor: {
          select: {
            id: true,
            businessName: true,
            rating: true,
            totalJobs: true,
            completedJobs: true
          }
        }
      }
    });

    // Update job status to QUOTED if it was PENDING
    if (job.status === 'PENDING') {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'QUOTED' }
      });
    }

    // TODO: Send notification to user about new quote

    res.status(201).json({
      message: 'Quote submitted successfully',
      quote
    });
  });

  // Update quote
  static updateQuote = asyncHandler(async (req, res) => {
    const { jobId, quoteId } = req.params;
    const userId = req.user.id;
    const { amount, estimatedArrival, notes } = req.body;

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

    // Check if quote exists and belongs to contractor
    const quote = await prisma.quote.findFirst({
      where: {
        id: quoteId,
        jobId,
        contractorId: contractor.id
      }
    });

    if (!quote) {
      return res.status(404).json({
        error: 'Quote not found',
        message: 'Quote not found or you do not have permission to update it'
      });
    }

    if (quote.isAccepted) {
      return res.status(400).json({
        error: 'Cannot update quote',
        message: 'Cannot update an accepted quote'
      });
    }

    const updatedQuote = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        amount,
        estimatedArrival,
        notes
      },
      include: {
        contractor: {
          select: {
            id: true,
            businessName: true,
            rating: true
          }
        }
      }
    });

    res.json({
      message: 'Quote updated successfully',
      quote: updatedQuote
    });
  });

  // Cancel quote
  static cancelQuote = asyncHandler(async (req, res) => {
    const { jobId, quoteId } = req.params;
    const userId = req.user.id;

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

    // Check if quote exists and belongs to contractor
    const quote = await prisma.quote.findFirst({
      where: {
        id: quoteId,
        jobId,
        contractorId: contractor.id
      }
    });

    if (!quote) {
      return res.status(404).json({
        error: 'Quote not found',
        message: 'Quote not found or you do not have permission to cancel it'
      });
    }

    if (quote.isAccepted) {
      return res.status(400).json({
        error: 'Cannot cancel quote',
        message: 'Cannot cancel an accepted quote'
      });
    }

    await prisma.quote.delete({
      where: { id: quoteId }
    });

    // TODO: Send notification to user about quote cancellation

    res.json({
      message: 'Quote cancelled successfully'
    });
  });

  // Start job
  static startJob = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;

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

    // Check if job exists and belongs to contractor
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        contractorId: contractor.id
      }
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'Job not found or you do not have permission to start it'
      });
    }

    if (job.status !== 'ACCEPTED') {
      return res.status(400).json({
        error: 'Cannot start job',
        message: 'Job must be accepted before it can be started'
      });
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status: 'IN_PROGRESS' }
    });

    // Update job assignments
    await prisma.jobAssignment.updateMany({
      where: { jobId },
      data: { 
        status: 'started',
        startedAt: new Date()
      }
    });

    // TODO: Send notification to user that job has started

    res.json({
      message: 'Job started successfully',
      job: updatedJob
    });
  });

  // Complete job
  static completeJob = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;

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

    // Check if job exists and belongs to contractor
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        contractorId: contractor.id
      }
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'Job not found or you do not have permission to complete it'
      });
    }

    if (job.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        error: 'Cannot complete job',
        message: 'Job must be in progress before it can be completed'
      });
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status: 'COMPLETED' }
    });

    // Update job assignments
    await prisma.jobAssignment.updateMany({
      where: { jobId },
      data: { 
        status: 'completed',
        completedAt: new Date()
      }
    });

    // Update contractor and worker stats
    await prisma.contractor.update({
      where: { id: contractor.id },
      data: {
        completedJobs: { increment: 1 }
      }
    });

    // TODO: Process final payment
    // TODO: Send notification to user that job is completed
    // TODO: Request reviews

    res.json({
      message: 'Job completed successfully',
      job: updatedJob
    });
  });

  // Assign workers to job
  static assignWorkers = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;
    const { workerIds } = req.body;

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

    // Check if job exists and belongs to contractor
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        contractorId: contractor.id
      }
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'Job not found or you do not have permission to assign workers'
      });
    }

    // Verify workers belong to contractor
    const workers = await prisma.worker.findMany({
      where: {
        id: { in: workerIds },
        contractorId: contractor.id
      }
    });

    if (workers.length !== workerIds.length) {
      return res.status(400).json({
        error: 'Invalid workers',
        message: 'Some workers do not belong to your contractor profile'
      });
    }

    // Create job assignments
    const assignments = await Promise.all(
      workerIds.map(workerId =>
        prisma.jobAssignment.create({
          data: {
            jobId,
            workerId
          },
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
        })
      )
    );

    res.status(201).json({
      message: 'Workers assigned successfully',
      assignments
    });
  });

  // Get job analytics for contractor
  static getJobAnalytics = asyncHandler(async (req, res) => {
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
      totalJobs,
      jobsByStatus,
      jobsByType,
      averageJobValue,
      totalEarnings,
      monthlyStats
    ] = await Promise.all([
      // Total jobs
      prisma.job.count({
        where: {
          contractorId: contractor.id,
          ...dateFilter
        }
      }),
      // Jobs by status
      prisma.job.groupBy({
        by: ['status'],
        where: {
          contractorId: contractor.id,
          ...dateFilter
        },
        _count: { status: true }
      }),
      // Jobs by type
      prisma.job.groupBy({
        by: ['jobType'],
        where: {
          contractorId: contractor.id,
          ...dateFilter
        },
        _count: { jobType: true }
      }),
      // Average job value
      prisma.job.aggregate({
        where: {
          contractorId: contractor.id,
          status: 'COMPLETED',
          ...dateFilter
        },
        _avg: { acceptedQuote: true }
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
        _sum: { amount: true }
      }),
      // Monthly stats
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as total_jobs,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_jobs,
          AVG(accepted_quote) as avg_job_value,
          SUM(accepted_quote) as total_revenue
        FROM jobs 
        WHERE contractor_id = ${contractor.id}
        ${startDate && endDate ? `AND created_at BETWEEN '${startDate}' AND '${endDate}'` : ''}
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month DESC
        LIMIT 12
      `
    ]);

    res.json({
      analytics: {
        totalJobs,
        averageJobValue: averageJobValue._avg.acceptedQuote || 0,
        totalEarnings: totalEarnings._sum.amount || 0
      },
      jobsByStatus,
      jobsByType,
      monthlyStats
    });
  });
}

export default JobController;

