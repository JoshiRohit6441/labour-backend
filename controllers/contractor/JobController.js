import prisma from '../../config/database.js';
import { calculateDistance, generatePaginationMeta } from '../../utils/helpers.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import handleResponse from '../../utils/handleResponse.js';
import cloudinary from '../../config/cloudinaryConfig.js';
import notificationQueue from '../../config/queue.js';
import redisClient from '../../config/redisConfig.js';

// Helper to upload buffer to Cloudinary
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: 'auto', folder: 'quote_documents' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

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
      return handleResponse(404, 'Please create a contractor profile first', null, res);
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
              phone: true
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

    return handleResponse(200, 'Jobs fetched successfully', { jobs, pagination: paginationMeta }, res);
  });

  // Get job details for contractor
  static getJobDetails = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;

    const contractor = await prisma.contractor.findUnique({ where: { userId } });
    if (!contractor) {
      return handleResponse(404, 'Please create a contractor profile first', null, res);
    }

    const cacheKey = `job:${jobId}`;
    const cachedJob = await redisClient.get(cacheKey);

    if (cachedJob) {
      return handleResponse(200, 'Job details fetched from cache', { job: JSON.parse(cachedJob) }, res);
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        },
        quotes: {
          where: { contractorId: contractor.id },
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
        chatRoom: {
          include: {
            participants: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            },
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
      return handleResponse(404, 'Job not found', null, res);
    }

    await redisClient.set(cacheKey, JSON.stringify(job), { EX: 3600 });

    return handleResponse(200, 'Job details fetched', { job }, res);
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
      return handleResponse(404, 'Please create a contractor profile first', null, res);
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

    let nearbyJobs = [];
    if (process.env.USE_POSTGIS === 'true') {
      // Use PostGIS for efficient geo query
      const rMeters = parseFloat(radius) * 1000;
      const rawJobs = await prisma.$queryRawUnsafe(
        `SELECT j.* FROM jobs j 
         WHERE j.status IN ('PENDING','QUOTED') 
           AND j.job_type IN ('IMMEDIATE','BIDDING')
           AND ST_DWithin(
             ST_SetSRID(ST_Point(j.longitude, j.latitude), 4326)::geography,
             ST_SetSRID(ST_Point($1, $2), 4326)::geography,
             $3
           )`,
        parseFloat(longitude),
        parseFloat(latitude),
        rMeters
      );
      // Hydrate quotes for this contractor
      const jobIds = rawJobs.map(j => j.id);
      const quotes = await prisma.quote.findMany({ where: { jobId: { in: jobIds }, contractorId: contractor.id } });
      const quoteMap = new Map(quotes.map(q => [q.jobId, q]));
      nearbyJobs = rawJobs.map(j => ({ ...j, quotes: quoteMap.get(j.id) ? [quoteMap.get(j.id)] : [] }));
    } else {
      // Fallback to Haversine filtering
      const allJobs = await prisma.job.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            }
          },
          quotes: { where: { contractorId: contractor.id } }
        }
      });
      nearbyJobs = allJobs.filter(job => {
        const distance = calculateDistance(
          parseFloat(latitude),
          parseFloat(longitude),
          job.latitude,
          job.longitude
        );
        return distance <= parseFloat(radius);
      });
    }

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

    return handleResponse(200, 'Nearby jobs fetched successfully', { jobs: sortedJobs, pagination: paginationMeta }, res);
  });

  // Submit quote for job
  static submitQuote = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;
    const { amount, totalAmount, notes, addOns, meetingScheduledOn, estimatedArrival } = req.body;
    const files = req.files;

    const contractor = await prisma.contractor.findUnique({ where: { userId } });
    if (!contractor) {
      return handleResponse(404, 'Please create a contractor profile first', null, res);
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return handleResponse(404, 'The requested job was not found', null, res);
    }

    if (job.status !== 'PENDING' && job.status !== 'QUOTED') {
      return handleResponse(400, 'Job is not accepting quotes in its current status', null, res);
    }

    let documentUrls = [];
    if (files && files.length > 0) {
      try {
        const uploadPromises = files.map(file => uploadToCloudinary(file.buffer));
        const uploadResults = await Promise.all(uploadPromises);
        documentUrls = uploadResults.map(result => result.secure_url);
      } catch (error) {
        return handleResponse(500, 'Failed to upload documents.', null, res);
      }
    }

    // Use totalAmount if provided, otherwise use amount
    const quoteAmount = totalAmount ? parseFloat(totalAmount) : (amount ? parseFloat(amount) : null);

    if (!quoteAmount) {
      return handleResponse(400, 'Quote amount is required', null, res);
    }

    const quoteData = {
      jobId,
      contractorId: contractor.id,
      amount: quoteAmount,
      totalAmount: totalAmount ? parseFloat(totalAmount) : undefined,
      notes,
      addOns: addOns ? (typeof addOns === 'string' ? JSON.parse(addOns) : addOns) : undefined,
      documents: documentUrls.length > 0 ? documentUrls : undefined,
      meetingScheduledOn: meetingScheduledOn ? new Date(meetingScheduledOn) : undefined,
      estimatedArrival: estimatedArrival || undefined,
    };

    const quote = await prisma.quote.upsert({
      where: {
        jobId_contractorId: {
          jobId: jobId,
          contractorId: contractor.id
        }
      },
      update: quoteData,
      create: quoteData,
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

    if (job.status === 'PENDING') {
      await prisma.job.update({ where: { id: jobId }, data: { status: 'QUOTED' } });
    }

    try {
      const socketService = req.app.get('socketService');
      if (socketService && socketService.sendNotificationToUser) {
        await socketService.sendNotificationToUser(
          job.userId,
          'QUOTE_RECEIVED',
          'You got a new quote',
          `${contractor.businessName} quoted ₹${totalAmount}`,
          { jobId: jobId, quoteId: quote.id, cta: 'SEE_JOB' }
        );
      }
    } catch (e) {
    }

    return handleResponse(201, 'Quote submitted successfully', { quote }, res);
  });

  // Initiate pre-acceptance chat (SCHEDULED/BIDDING)
  static initiateChat = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;

    const contractor = await prisma.contractor.findUnique({ where: { userId } });
    if (!contractor) {
      return handleResponse(404, 'Please create a contractor profile first', null, res);
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return handleResponse(404, 'The requested job was not found', null, res);
    }

    if (!['SCHEDULED', 'BIDDING'].includes(job.jobType)) {
      return handleResponse(400, 'Chat is allowed pre-acceptance only for SCHEDULED or BIDDING jobs', null, res);
    }

    // Ensure chat room exists and add both participants (user is already connected on job create)
    const room = await prisma.chatRoom.upsert({
      where: { jobId },
      update: {},
      create: { jobId }
    });

    await prisma.chatRoom.update({
      where: { id: room.id },
      data: {
        participants: {
          connect: [{ id: userId }]
        }
      }
    });

    // Notify user about chat initiation (optional)
    try {
      const socketService = req.app.get('socketService');
      if (socketService && socketService.sendNotificationToUser) {
        await socketService.sendNotificationToUser(
          job.userId,
          'CHAT_INITIATED',
          'Contractor initiated chat',
          'A contractor wants to discuss your job',
          { jobId, contractorId: contractor.id, cta: 'SEE_JOB' }
        );
      }
    } catch (e) {
      // non-blocking
    }

    return handleResponse(200, 'Chat ready', { room: { id: room.id } }, res);
  });

  // Claim job (single-winner) for IMMEDIATE and SCHEDULED
  static claimJob = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const { workerIds = [] } = req.body || {};
    const userId = req.user.id;

    const contractor = await prisma.contractor.findUnique({ where: { userId } });
    if (!contractor) {
      return handleResponse(404, 'Please create a contractor profile first', null, res);
    }

    if (contractor.verificationStatus !== 'VERIFIED') {
      return handleResponse(403, 'Your business profile must be verified to claim jobs', null, res);
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return handleResponse(404, 'The requested job was not found', null, res);
    }

    if (!['IMMEDIATE', 'SCHEDULED'].includes(job.jobType)) {
      return handleResponse(400, 'Only IMMEDIATE or SCHEDULED jobs can be claimed by contractors', null, res);
    }

    const workersRequired = job.workersNeeded || job.numberOfWorkers || 1;

    if (!workerIds.length) {
      return handleResponse(400, `This job requires ${workersRequired} worker(s). Please select workers.`, null, res);
    }

    if (workerIds.length < workersRequired) {
      return handleResponse(400, `This job requires at least ${workersRequired} worker(s).`, null, res);
    }

    const { ok, customerId } = await prisma.$transaction(async (tx) => {
      const updatedCount = await tx.job.updateMany({
        where: { id: jobId, contractorId: null, status: { in: ['PENDING', 'QUOTED'] } },
        data: { contractorId: contractor.id, status: 'ACCEPTED' }
      });

      if (updatedCount.count === 0) return { ok: false };

      if (job.jobType === 'SCHEDULED' && job.scheduledStartDate) {
        const unavailableWorkers = await tx.availability.findMany({
          where: {
            workerId: { in: workerIds },
            date: new Date(job.scheduledStartDate),
            isAvailable: false,
          },
          select: { workerId: true },
        });

        if (unavailableWorkers.length > 0) {
          throw new Error("Some selected workers are not available for this job date");
        }
      }

      const workers = await tx.worker.findMany({
        where: { id: { in: workerIds }, contractorId: contractor.id }
      });

      if (workers.length !== workerIds.length) {
        throw new Error('Some workers do not belong to your contractor profile');
      }

      await tx.jobAssignment.deleteMany({ where: { jobId } });

      await tx.jobAssignment.createMany({
        data: workerIds.map((wid) => ({ jobId, workerId: wid })),
      });

      return { ok: true, customerId: job.userId };
    }, { timeout: 20000 });

    if (!ok) {
      return handleResponse(409, 'This job has already been accepted by another contractor', null, res);
    }

    await prisma.chatRoom.upsert({
      where: { jobId },
      update: {
        participants: {
          connect: [{ id: userId }, { id: customerId }],
        },
      },
      create: {
        jobId,
        participants: {
          connect: [{ id: userId }, { id: customerId }],
        },
      },
    });

    try {
      const socketService = req.app.get('socketService');

      if (socketService?.sendNotificationToUser) {
        await socketService.sendNotificationToUser(
          customerId,
          'JOB_ACCEPTED',
          'Your job was accepted',
          `${contractor.businessName} accepted your job`,
          { jobId, contractorId: contractor.id, cta: 'SEE_JOB' }
        );

        socketService.io.to(`user_${customerId}`).emit('job_accepted', {
          jobId,
          contractorId: contractor.id,
          contractorName: contractor.businessName
        });
      }
    } catch (_) { }

    const updated = await prisma.job.findUnique({ where: { id: jobId } });
    return handleResponse(200, 'Job claimed successfully', { job: updated }, res);
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
      return handleResponse(404, 'Please create a contractor profile first', null, res);
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
      return handleResponse(404, 'Quote not found or you do not have permission to update it', null, res);
    }

    if (quote.isAccepted) {
      return handleResponse(400, 'Cannot update an accepted quote', null, res);
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

    return handleResponse(200, 'Quote updated successfully', { quote: updatedQuote }, res);
  });

  // Request advance (<= 20% of totalAmount)
  static requestAdvance = asyncHandler(async (req, res) => {
    const { jobId, quoteId } = req.params;
    const { amount } = req.body || {};
    const userId = req.user.id;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return handleResponse(400, 'Advance amount must be a positive number', null, res);
    }

    const contractor = await prisma.contractor.findUnique({ where: { userId } });
    if (!contractor) {
      return handleResponse(404, 'Please create a contractor profile first', null, res);
    }

    const quote = await prisma.quote.findFirst({ where: { id: quoteId, jobId, contractorId: contractor.id } });
    if (!quote) {
      return handleResponse(404, 'Quote not found or access denied', null, res);
    }

    if (!quote.totalAmount || quote.totalAmount <= 0) {
      return handleResponse(400, 'Cannot request advance without totalAmount on quote', null, res);
    }

    const limit = quote.totalAmount * 0.20;
    if (Number(amount) > limit) {
      return handleResponse(400, 'Advance cannot exceed 20% of the total amount.', null, res);
    }

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: { advanceRequested: true, advanceAmount: Number(amount) }
    });

    return handleResponse(200, 'Advance request recorded', { quote: { id: updated.id, advanceRequested: updated.advanceRequested, advanceAmount: updated.advanceAmount } }, res);
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
      return handleResponse(404, 'Please create a contractor profile first', null, res);
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
      return handleResponse(404, 'Quote not found or you do not have permission to cancel it', null, res);
    }

    if (quote.isAccepted) {
      return handleResponse(400, 'Cannot cancel an accepted quote', null, res);
    }

    await prisma.quote.delete({
      where: { id: quoteId }
    });

    // TODO: Send notification to user about quote cancellation

    return handleResponse(200, 'Quote cancelled successfully', null, res);
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
      return handleResponse(404, 'Please create a contractor profile first', null, res);
    }

    // Check if job exists and belongs to contractor
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        contractorId: contractor.id
      }
    });

    if (!job) {
      return handleResponse(404, 'Job not found or you do not have permission to start it', null, res);
    }

    if (job.status !== 'ACCEPTED') {
      return handleResponse(400, 'Job must be accepted before it can be started', null, res);
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status: 'IN_PROGRESS' }
    });

    const cacheKey = `job:${jobId}`;
    await redisClient.del(cacheKey);

    // Update job assignments
    await prisma.jobAssignment.updateMany({
      where: { jobId },
      data: {
        status: 'started',
        startedAt: new Date()
      }
    });

    // TODO: Send notification to user that job has started
    try {
      const socketService = req.app.get('socketService');
      if (socketService && socketService.sendNotificationToUser) {
        await socketService.sendNotificationToUser(
          job.userId,
          'JOB_STARTED',
          'Your job has started',
          `The contractor has started working on your job: ${job.title}`,
          { jobId: job.id, cta: 'SEE_JOB' }
        );
      }
    } catch (e) {
    }

    return handleResponse(200, 'Job started successfully', { job: updatedJob }, res);
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
      return handleResponse(404, 'Please create a contractor profile first', null, res);
    }

    // Check if job exists and belongs to contractor
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        contractorId: contractor.id
      }
    });

    if (!job) {
      return handleResponse(404, 'Job not found or you do not have permission to complete it', null, res);
    }

    if (job.status !== 'IN_PROGRESS') {
      return handleResponse(400, 'Job must be in progress before it can be completed', null, res);
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status: 'COMPLETED' }
    });

    const cacheKey = `job:${jobId}`;
    await redisClient.del(cacheKey);

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
    try {
      const socketService = req.app.get('socketService');
      if (socketService && socketService.sendNotificationToUser) {
        await socketService.sendNotificationToUser(
          job.userId,
          'JOB_COMPLETED',
          'Your job has been completed',
          `The contractor has completed your job: ${job.title}`,
          { jobId: job.id, cta: 'SEE_JOB' }
        );
      }
    } catch (e) {
    }
    // TODO: Request reviews

    return handleResponse(200, 'Job completed successfully', { job: updatedJob }, res);
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
      return handleResponse(404, 'Please create a contractor profile first', null, res);
    }

    // Check if job exists and belongs to contractor
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        contractorId: contractor.id
      }
    });

    if (!job) {
      return handleResponse(404, 'Job not found or you do not have permission to assign workers', null, res);
    }

    // Verify workers belong to contractor
    const workers = await prisma.worker.findMany({
      where: {
        id: { in: workerIds },
        contractorId: contractor.id
      }
    });

    if (workers.length !== workerIds.length) {
      return handleResponse(400, 'Some workers do not belong to your contractor profile', null, res);
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

    return handleResponse(201, 'Workers assigned successfully', { assignments }, res);
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
      return handleResponse(404, 'Please create a contractor profile first', null, res);
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

    return handleResponse(200, 'Analytics fetched successfully', {
      analytics: {
        totalJobs,
        averageJobValue: averageJobValue._avg.acceptedQuote || 0,
        totalEarnings: totalEarnings._sum.amount || 0
      },
      jobsByStatus,
      jobsByType,
      monthlyStats
    }, res);
  });

  // Get active (ongoing) job for persistent footer
  static getActiveJob = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const contractor = await prisma.contractor.findUnique({ where: { userId } });
    if (!contractor) {
      return handleResponse(404, 'Please create a contractor profile first', null, res);
    }
    const job = await prisma.job.findFirst({
      where: { contractorId: contractor.id, status: 'IN_PROGRESS' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, jobType: true, status: true, userId: true }
    });
    return handleResponse(200, 'Active job fetched', { job: job || null }, res);
  });

  static cancelJob = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body || {};

    const contractor = await prisma.contractor.findUnique({ where: { userId } });
    if (!contractor) {
      return handleResponse(404, 'Please create a contractor profile first', null, res);
    }

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        contractorId: contractor.id,
      },
    });

    if (!job) {
      return handleResponse(404, 'Job not found or you do not have permission to cancel it', null, res);
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return handleResponse(400, 'Cancellation reason is required (min 5 characters).', null, res);
    }

    if (job.status === 'COMPLETED') {
      return handleResponse(400, 'Cannot cancel a completed job', null, res);
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason.trim(),
        cancelledBy: 'CONTRACTOR',
      },
    });

    // Notify user
    try {
      const socketService = req.app.get('socketService');
      if (socketService && socketService.sendNotificationToUser) {
        await socketService.sendNotificationToUser(
          job.userId,
          'JOB_CANCELLED',
          'Job was cancelled',
          `The contractor cancelled the job${updatedJob.title ? `: ${updatedJob.title}` : ''}.`,
          { jobId, reason: updatedJob.cancellationReason }
        );
      }
    } catch (e) {
    }

    return handleResponse(200, 'Job cancelled successfully', { job: updatedJob }, res);
  });

  static shareLocation = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const { workerPhone } = req.body;
    const userId = req.user.id;

    const contractor = await prisma.contractor.findUnique({ where: { userId } });
    if (!contractor) {
      return handleResponse(404, 'Please create a contractor profile first', null, res);
    }

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        contractorId: contractor.id,
      },
    });

    if (!job) {
      return handleResponse(404, 'Job not found or you do not have permission to share its location', null, res);
    }

    const securityCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        locationSharingCode: securityCode,
        locationSharingWorkerPhone: workerPhone,
        locationSharingCodeExpiresAt: expiresAt,
      },
    });

    await notificationQueue.add('send-sms', {
      type: 'sms',
      data: {
        phone: workerPhone,
        message: `Your security code for job ${job.title} is ${securityCode}`,
      }
    });

    return handleResponse(200, 'Location shared successfully', { job: updatedJob }, res);
  });

  static acceptOffer = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user.id;

    const contractor = await prisma.contractor.findUnique({ where: { userId } });
    if (!contractor) {
      return handleResponse(404, 'Please create a contractor profile first', null, res);
    }

    if (contractor.verificationStatus !== 'VERIFIED') {
      return handleResponse(403, 'Your business profile must be verified to accept job offers', null, res);
    }

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        contractorId: contractor.id,
        status: 'OFFERED',
      },
    });

    if (!job) {
      return handleResponse(404, 'Job offer not found or has expired', null, res);
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status: 'ACCEPTED' },
    });

    // Notify user
    try {
      const socketService = req.app.get('socketService');
      if (socketService && socketService.sendNotificationToUser) {
        await socketService.sendNotificationToUser(
          job.userId,
          'JOB_ACCEPTED',
          'Your job offer was accepted!',
          `Contractor ${contractor.businessName} has accepted your job offer for "${job.title}".`,
          { jobId, contractorId: contractor.id }
        );
      }
    } catch (e) {
      // Silently handle notification errors
    }    // Notify other contractors
    try {
      const allQuotes = await prisma.quote.findMany({
        where: { jobId, contractorId: { not: contractor.id } },
        include: { contractor: { select: { userId: true } } },
      });

      const socketService = req.app.get('socketService');
      if (socketService && socketService.sendNotificationToUser) {
        for (const otherQuote of allQuotes) {
          if (otherQuote.contractor.userId) {
            await socketService.sendNotificationToUser(
              otherQuote.contractor.userId,
              'QUOTE_REJECTED',
              'Your quote was not selected',
              `Another contractor was selected for ${job.title || 'the job'}`,
              { jobId, quoteId: otherQuote.id }
            );
          }
        }
      }
    } catch (e) {
      // Silently handle notification errors
    } return handleResponse(200, 'Job offer accepted successfully', { job: updatedJob }, res);
  });
}


export default JobController;