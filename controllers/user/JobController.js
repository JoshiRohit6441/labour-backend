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
      isLocationTracking = false
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
        scheduledTime,
        estimatedDuration,
        numberOfWorkers,
        requiredSkills,
        budget,
        isLocationTracking: jobType === 'IMMEDIATE' ? true : isLocationTracking
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
      // Non-blocking: log and continue
      console.error('Failed to notify nearby contractors:', e);
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

    // Check if job belongs to user
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

    // Don't allow updates if job is already accepted or in progress
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
    // const { reason } = req.body;

    // Check if job belongs to user
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

    // Don't allow cancellation if job is completed
    if (job.status === 'COMPLETED') {
      return res.status(400).json({
        error: 'Cannot cancel job',
        message: 'Cannot cancel a completed job'
      });
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED'
      }
    });

    // TODO: Handle refunds if advance was paid
    // TODO: Notify contractor and workers

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
      return res.status(404).json({
        error: 'Job not found',
        message: 'Job not found or you do not have permission to accept quotes'
      });
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
      return res.status(404).json({
        error: 'Quote not found',
        message: 'Quote not found or does not belong to this job'
      });
    }

    // Single-winner acceptance: only when not already accepted
    const [_, jobUpdate] = await prisma.$transaction([
      prisma.quote.update({ where: { id: quoteId }, data: { isAccepted: true } }),
      prisma.job.updateMany({
        where: { id: jobId, contractorId: null, status: { in: ['PENDING', 'QUOTED'] } },
        data: { status: 'ACCEPTED', contractorId: quote.contractorId, acceptedQuote: quote.amount }
      })
    ]);

    if (jobUpdate.count === 0) {
      return res.status(409).json({
        error: 'Already accepted',
        message: 'This job has already been accepted by another contractor'
      });
    }

    const updatedJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        contractor: { select: { id: true, businessName: true, rating: true } }
      }
    });

    // Add contractor to chat room
    await prisma.chatRoom.update({
      where: { jobId },
      data: {
        participants: {
          connect: { id: quote.contractor.userId }
        }
      }
    });

    // Notify contractor about acceptance
    try {
      const socketService = req.app.get('socketService');
      if (socketService && socketService.sendNotificationToUser) {
        await socketService.sendNotificationToUser(
          quote.contractor.userId,
          'JOB_ACCEPTED',
          'Your quote was accepted',
          `${updatedJob?.title || 'Job'} was awarded to you`,
          { jobId, contractorId: quote.contractorId, cta: 'SEE_JOB' }
        );
      }
    } catch (e) {
      console.error('Failed to notify contractor about quote acceptance:', e);
    }

    return handleResponse(200, 'Quote accepted successfully', { job: updatedJob }, res);
  });

  // Submit review for job
  static submitReview = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;
    const { contractorRating, contractorComment, workerRatings } = req.body;

    // Check if job belongs to user and is completed
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

    // Check if user already submitted reviews for this job
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

    // Create contractor review
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

    // Create worker reviews
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

  // Get job analytics for user
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
      // Total jobs
      prisma.job.count({
        where: {
          userId,
          ...dateFilter
        }
      }),
      // Jobs by status
      prisma.job.groupBy({
        by: ['status'],
        where: {
          userId,
          ...dateFilter
        },
        _count: { status: true }
      }),
      // Jobs by type
      prisma.job.groupBy({
        by: ['jobType'],
        where: {
          userId,
          ...dateFilter
        },
        _count: { jobType: true }
      }),
      // Total spent
      prisma.payment.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          ...dateFilter
        },
        _sum: { amount: true }
      }),
      // Average job value
      prisma.job.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          ...dateFilter
        },
        _avg: { acceptedQuote: true }
      }),
      // Monthly stats
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

  // Get active (ongoing) job for persistent footer
  static getActiveJob = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const job = await prisma.job.findFirst({
      where: { userId, status: 'IN_PROGRESS' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, jobType: true, status: true, contractorId: true }
    });
    return handleResponse(200, 'Active job fetched', { job: job || null }, res);
  });
}

export default JobController;

