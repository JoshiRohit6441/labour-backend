import { jobAcceptanceQueue } from '../../config/queue.js';
import prisma from '../../config/database.js';
import { generatePaginationMeta, calculateDistance } from '../../utils/helpers.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import handleResponse from '../../utils/handleResponse.js';

class JobController {
  // Create job
  static createJob = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
      title,
      description,
      jobType,
      address,
      city,
      state,
      pincode,
      latitude,
      longitude,
      scheduledDate,
      scheduledTime,
      estimatedDuration,
      numberOfWorkers,
      requiredSkills,
      budget,
      isLocationTracking = false,
      // BIDDING fields
      detailedDescription,
      startDate,
      siteVisitDeadline,
      quoteSubmissionDeadline,
      materialsProvidedBy,
      expectedDays,
      // SCHEDULED field
      scheduledStartDate
    } = req.body;

    const job = await prisma.job.create({
      data: {
        userId,
        title,
        description,
        jobType,
        address,
        city,
        state,
        pincode,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        scheduledStartDate: jobType === 'SCHEDULED' && scheduledStartDate ? new Date(scheduledStartDate) : (jobType === 'SCHEDULED' && scheduledDate ? new Date(scheduledDate) : null),
        scheduledTime,
        estimatedDuration,
        numberOfWorkers,
        workersNeeded: numberOfWorkers, // Save as workersNeeded too
        requiredSkills,
        budget,
        isLocationTracking: jobType === 'IMMEDIATE' ? true : isLocationTracking,
        // BIDDING fields
        detailedDescription,
        startDate: startDate ? new Date(startDate) : null,
        siteVisitDeadline: siteVisitDeadline ? new Date(siteVisitDeadline) : null,
        quoteSubmissionDeadline: quoteSubmissionDeadline ? new Date(quoteSubmissionDeadline) : null,
        materialsProvidedBy,
        expectedDays: expectedDays ? parseInt(expectedDays) : null
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            // rating: true
          }
        }
      }
    });

    // Create chat room for the job
    await prisma.chatRoom.create({
      data: {
        jobId: job.id,
        participants: {
          connect: { id: userId }
        }
      }
    });

    // Notify nearby contractors who provide worker service in the area
    try {
      const requiredSkillsArray = Array.isArray(requiredSkills) ? requiredSkills : (requiredSkills ? [requiredSkills] : []);

      // Get contractorIds that have workers matching any required skill (if skills provided)
      let contractorIdsBySkill = [];
      if (requiredSkillsArray.length > 0) {
        const skillMatches = await prisma.worker.findMany({
          where: { skills: { hasSome: requiredSkillsArray } },
          select: { contractorId: true },
          distinct: ['contractorId']
        });
        contractorIdsBySkill = skillMatches.map(s => s.contractorId);
      }

      // Fetch active contractors with location data (and skill match if applicable)
      const contractors = await prisma.contractor.findMany({
        where: {
          isActive: true,
          businessLatitude: { not: null },
          businessLongitude: { not: null },
          ...(contractorIdsBySkill.length > 0 ? { id: { in: contractorIdsBySkill } } : {})
        },
        select: { id: true, userId: true, coverageRadius: true, businessLatitude: true, businessLongitude: true }
      });

      const nearbyUserIds = contractors
        .filter(c => {
          const distKm = calculateDistance(
            Number(job.latitude),
            Number(job.longitude),
            Number(c.businessLatitude),
            Number(c.businessLongitude)
          );
          return isFinite(distKm) && distKm <= Number(c.coverageRadius);
        })
        .map(c => c.userId);

      if (nearbyUserIds.length > 0) {
        // Use SocketService to send real-time notifications + persist in DB
        const socketService = req.app.get('socketService');
        if (socketService && socketService.sendNotificationToUsers) {
          await socketService.sendNotificationToUsers(
            nearbyUserIds,
            'JOB_REQUEST',
            'New job near you',
            `${job.title} • ${job.city}`,
            { jobId: job.id, jobType: job.jobType, city: job.city, cta: 'SEE_JOB' }
          );
        }
      }
    } catch (e) {
      // Non-blocking: silently handle notification errors
    }

    return handleResponse(201, 'Job created successfully!', { job }, res);
  });

  // Get user's jobs
  static getUserJobs = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 10, status, jobType } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { userId };

    if (status) where.status = status;
    if (jobType) where.jobType = jobType;

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          contractor: {
            select: {
              id: true,
              businessName: true,
              rating: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
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
                  completedJobs: true
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
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.job.count({ where })
    ]);

    const paginationMeta = generatePaginationMeta(parseInt(page), parseInt(limit), total);

    return handleResponse(200, 'Jobs fetched successfully', { jobs, pagination: paginationMeta }, res);
  });

  // Get latest location updates for a job
  static getLatestLocation = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const { limit = 5 } = req.query;
    const userId = req.user.id;

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        OR: [
          { userId },
          { contractor: { userId } }
        ]
      }
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'Job not found or you do not have permission to view it'
      });
    }

    const updates = await prisma.locationUpdate.findMany({
      where: { jobId },
      orderBy: { timestamp: 'desc' },
      take: Math.min(parseInt(limit), 50)
    });

    return handleResponse(200, 'Latest location updates fetched', { jobId, isLocationTracking: job.isLocationTracking, jobType: job.jobType, status: job.status, updates }, res);
  });

  // Enable/Disable location tracking on a job (user-owned)
  static setTracking = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const { enabled } = req.body;
    const userId = req.user.id;

    const job = await prisma.job.findFirst({
      where: { id: jobId, userId }
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'Job not found or you do not have permission to update it'
      });
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: { isLocationTracking: Boolean(enabled) }
    });

    return handleResponse(200, 'Tracking setting updated', { job: { id: updated.id, isLocationTracking: updated.isLocationTracking } }, res);
  });

  // Get job details
  static getJobDetails = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        userId
      },
      include: {
        contractor: {
          select: {
            id: true,
            businessName: true,
            rating: true,
            businessAddress: true,
            businessCity: true,
            businessState: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                email: true
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
              orderBy: { createdAt: 'asc' },
              take: 50
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
        message: 'Job not found or you do not have permission to view it'
      });
    }

    return handleResponse(200, 'Job details fetched', { job }, res);
  });

  // Update job
  static updateJob = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        userId
      }
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'Job not found or you do not have permission to update it'
      });
    }

    if (['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(job.status)) {
      return res.status(400).json({
        error: 'Cannot update job',
        message: 'Job cannot be updated in its current status'
      });
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        }
      }
    });

    return handleResponse(200, 'Job updated successfully', { job: updatedJob }, res);
  });

  // Cancel job
  static cancelJob = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body || {};

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        userId
      }
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'Job not found or you do not have permission to cancel it'
      });
    }

    // Validate reason
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return handleResponse(400, 'Cancellation reason is required (min 5 characters).', null, res);
    }

    if (job.status === 'COMPLETED') {
      return res.status(400).json({
        error: 'Cannot cancel job',
        message: 'Cannot cancel a completed job'
      });
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason.trim(),
        cancelledBy: 'USER',
      },
    });

    // Notify contractor (if assigned)
    try {
      if (job.contractorId) {
        const contractor = await prisma.contractor.findUnique({ where: { id: job.contractorId }, select: { userId: true, businessName: true } });
        if (contractor) {
          const socketService = req.app.get('socketService');
          if (socketService && socketService.sendNotificationToUser) {
            await socketService.sendNotificationToUser(
              contractor.userId,
              'JOB_CANCELLED',
              'Job was cancelled',
              `The user cancelled the job${updatedJob.title ? `: ${updatedJob.title}` : ''}.`,
              { jobId, reason: updatedJob.cancellationReason }
            );
          }
        }
      }
    } catch (e) {
      // Silently handle notification errors
    }

    return handleResponse(200, 'Job cancelled successfully', { job: updatedJob }, res);
  });

  // Accept quote
  static acceptQuote = asyncHandler(async (req, res) => {
    const { jobId, quoteId } = req.params;
    const userId = req.user.id;

    // Check if job belongs to user
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        userId
      }
    });

    if (!job) {
      return handleResponse(404, 'Job not found or you do not have permission to accept quotes', null, res);
    }

    // Check if quote exists and belongs to job
    const quote = await prisma.quote.findFirst({
      where: {
        id: quoteId,
        jobId
      },
      include: {
        contractor: true
      }
    });

    if (!quote) {
      return handleResponse(404, 'Quote not found or does not belong to this job', null, res);
    }

    const finalAmount = quote.totalAmount || quote.amount;

    const [_, jobUpdate] = await prisma.$transaction([
      prisma.quote.update({ where: { id: quoteId }, data: { isAccepted: true, status: 'pending' } }),
      prisma.job.updateMany({
        where: { id: jobId, contractorId: null, status: { in: ['PENDING', 'QUOTED'] } },
        data: {
          status: 'OFFERED',
          contractorId: quote.contractorId,
          acceptedQuote: finalAmount,
          acceptedQuoteId: quoteId
        }
      })
    ]);

    if (jobUpdate.count === 0) {
      return handleResponse(409, 'This job has already been accepted by another contractor', null, res);
    }

    // Add job to acceptance queue with a 5-minute delay
    await jobAcceptanceQueue.add('check-acceptance', { jobId, quoteId }, { delay: 300000 });

    const updatedJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        contractor: { select: { id: true, businessName: true, rating: true } }
      }
    });

    // Notify contractor of the offer
    try {
      const socketService = req.app.get('socketService');
      if (socketService && socketService.sendNotificationToUser) {
        await socketService.sendNotificationToUser(
          quote.contractor.userId,
          'JOB_OFFERED',
          'You have a new job offer!',
          `Your quote for "${updatedJob?.title || 'Job'}" was accepted. You have 5 minutes to accept.`,
          { jobId, contractorId: quote.contractorId, cta: 'ACCEPT_OFFER' }
        );
      }
    } catch (e) {
      // Silently handle notification errors
    }

    return handleResponse(200, 'Quote offered to contractor successfully', { job: updatedJob }, res);
  });

  // Submit review for job
  static submitReview = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;
    const { contractorRating, contractorComment, workerRatings } = req.body;

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        userId,
        status: 'COMPLETED'
      },
      include: {
        contractor: true,
        assignments: {
          include: {
            worker: true
          }
        }
      }
    });

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'Job not found, not completed, or you do not have permission to review it'
      });
    }

    const existingReviews = await prisma.review.findMany({
      where: {
        jobId,
        giverId: userId
      }
    });

    if (existingReviews.length > 0) {
      return res.status(409).json({
        error: 'Reviews already submitted',
        message: 'You have already submitted reviews for this job'
      });
    }

    const reviews = [];

    if (contractorRating && job.contractor) {
      const contractorReview = await prisma.review.create({
        data: {
          jobId,
          giverId: userId,
          receiverId: job.contractor.userId,
          receiverType: 'contractor',
          rating: contractorRating,
          comment: contractorComment
        }
      });
      reviews.push(contractorReview);
    }

    if (workerRatings && Array.isArray(workerRatings)) {
      for (const workerRating of workerRatings) {
        const worker = job.assignments.find(a => a.worker.id === workerRating.workerId);
        if (worker) {
          const workerReview = await prisma.review.create({
            data: {
              jobId,
              giverId: userId,
              receiverId: workerRating.workerId,
              receiverType: 'worker',
              rating: workerRating.rating,
              comment: workerRating.comment
            }
          });
          reviews.push(workerReview);
        }
      }
    }

    res.status(201).json({
      message: 'Reviews submitted successfully',
      reviews
    });
  });

  static getJobAnalytics = asyncHandler(async (req, res) => {
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
      totalJobs,
      jobsByStatus,
      jobsByType,
      totalSpent,
      averageJobValue,
      monthlyStats
    ] = await Promise.all([
      prisma.job.count({
        where: {
          userId,
          ...dateFilter
        }
      }),

      prisma.job.groupBy({
        by: ['status'],
        where: {
          userId,
          ...dateFilter
        },
        _count: { status: true }
      }),

      prisma.job.groupBy({
        by: ['jobType'],
        where: {
          userId,
          ...dateFilter
        },
        _count: { jobType: true }
      }),

      prisma.payment.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          ...dateFilter
        },
        _sum: { amount: true }
      }),

      prisma.job.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          ...dateFilter
        },
        _avg: { acceptedQuote: true }
      }),

      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as total_jobs,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_jobs,
          AVG(accepted_quote) as avg_job_value,
          SUM(accepted_quote) as total_spent
        FROM jobs 
        WHERE user_id = ${userId}
        ${startDate && endDate ? `AND created_at BETWEEN '${startDate}' AND '${endDate}'` : ''}
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month DESC
        LIMIT 12
      `
    ]);

    res.json({
      analytics: {
        totalJobs,
        totalSpent: totalSpent._sum.amount || 0,
        averageJobValue: averageJobValue._avg.acceptedQuote || 0
      },
      jobsByStatus,
      jobsByType,
      monthlyStats
    });
  });

  static getActiveJob = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const job = await prisma.job.findFirst({
      where: { userId, status: 'IN_PROGRESS' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, jobType: true, status: true, contractorId: true }
    });
    return handleResponse(200, 'Active job fetched', { job: job || null }, res);
  });

  static changeStartDate = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const { startDate } = req.body || {};
    const userId = req.user.id;

    if (!startDate || isNaN(Date.parse(startDate))) {
      return handleResponse(400, 'Valid startDate is required (ISO date).', null, res);
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, userId },
      select: { id: true, jobType: true, status: true, contractorId: true, title: true }
    });

    if (!job) {
      return handleResponse(404, 'Job not found or access denied.', null, res);
    }

    if (!['SCHEDULED', 'BIDDING'].includes(job.jobType)) {
      return handleResponse(400, 'Date change allowed only for SCHEDULED or BIDDING jobs.', null, res);
    }

    if (job.status !== 'ACCEPTED') {
      return handleResponse(400, 'Date can be changed only after acceptance.', null, res);
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: { startDate: new Date(startDate) }
    });

    // Notify contractor
    try {
      if (job.contractorId) {
        const contractor = await prisma.contractor.findUnique({ where: { id: job.contractorId }, select: { userId: true, businessName: true } });
        if (contractor) {
          const socketService = req.app.get('socketService');
          if (socketService && socketService.sendNotificationToUser) {
            await socketService.sendNotificationToUser(
              contractor.userId,
              'JOB_DATE_CHANGED',
              'Job start date updated',
              `Start date updated for job${job.title ? `: ${job.title}` : ''}.`,
              { jobId, startDate: updated.startDate }
            );
          }
        }
      }
    } catch (e) {
      // Silently handle notification errors
    }

    return handleResponse(200, 'Start date updated successfully.', { job: { id: updated.id, startDate: updated.startDate } }, res);
  });
}

export default JobController;

