import prisma from '../../config/database.js';
import { calculateDistance, generatePaginationMeta, isValidPAN, maskSensitiveData } from '../../utils/helpers.js';
import { asyncHandler } from '../../middleware/errorHandler.js';

class ContractorController {
  // Create contractor profile
  static createProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
      businessName,
      businessType,
      gstNumber,
      panNumber,
      businessAddress,
      businessCity,
      businessState,
      businessPincode,
      businessLatitude,
      businessLongitude,
      coverageRadius = 20.0,
      bankAccountNumber,
      bankIfscCode,
      bankAccountName
    } = req.body;

    // Check if contractor profile already exists
    const existingContractor = await prisma.contractor.findUnique({
      where: { userId }
    });

    if (existingContractor) {
      return res.status(409).json({
        error: 'Profile already exists',
        message: 'Contractor profile already exists for this user'
      });
    }

    // Validate and mask sensitive data
    if (panNumber && !isValidPAN(panNumber)) {
      return res.status(400).json({
        error: 'Invalid PAN',
        message: 'Please provide a valid PAN number'
      });
    }

    const maskedPanNumber = panNumber ? maskSensitiveData(panNumber, 'pan') : null;
    const maskedBankAccountNumber = bankAccountNumber ? maskSensitiveData(bankAccountNumber, 'bank') : null;

    // Create contractor profile
    const contractor = await prisma.contractor.create({
      data: {
        userId,
        businessName,
        businessType,
        gstNumber,
        panNumber: maskedPanNumber,
        businessAddress,
        businessCity,
        businessState,
        businessPincode,
        businessLatitude,
        businessLongitude,
        coverageRadius,
        bankAccountNumber: maskedBankAccountNumber,
        bankIfscCode,
        bankAccountName
      },
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

    res.status(201).json({
      message: 'Contractor profile created successfully',
      contractor
    });
  });

  // Get contractor profile
  static getProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const contractor = await prisma.contractor.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isVerified: true
          }
        },
        workers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            skills: true,
            experience: true,
            hourlyRate: true,
            dailyRate: true,
            isActive: true,
            isVerified: true,
            rating: true,
            totalJobs: true,
            completedJobs: true
          }
        },
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
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!contractor) {
      return res.status(404).json({
        error: 'Profile not found',
        message: 'Contractor profile not found'
      });
    }

    res.json({ contractor });
  });

  // Update contractor profile
  static updateProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const updateData = req.body;

    // Validate and mask sensitive data if present in the update
    if (updateData.panNumber) {
      if (!isValidPAN(updateData.panNumber)) {
        return res.status(400).json({
          error: 'Invalid PAN',
          message: 'Please provide a valid PAN number'
        });
      }
      updateData.panNumber = maskSensitiveData(updateData.panNumber, 'pan');
    }

    if (updateData.bankAccountNumber) {
      updateData.bankAccountNumber = maskSensitiveData(updateData.bankAccountNumber, 'bank');
    }

    const contractor = await prisma.contractor.update({
      where: { userId },
      data: updateData,
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
      message: 'Profile updated successfully',
      contractor
    });
  });

  // Add worker
  static addWorker = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
      firstName,
      lastName,
      phone,
      email,
      skills,
      experience,
      hourlyRate,
      dailyRate
    } = req.body;

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

    // Check if worker with same phone already exists
    const existingWorker = await prisma.worker.findFirst({
      where: { phone }
    });

    if (existingWorker) {
      return res.status(409).json({
        error: 'Worker already exists',
        message: 'A worker with this phone number already exists'
      });
    }

    const worker = await prisma.worker.create({
      data: {
        contractorId: contractor.id,
        firstName,
        lastName,
        phone,
        email,
        skills,
        experience,
        hourlyRate,
        dailyRate
      }
    });

    res.status(201).json({
      message: 'Worker added successfully',
      worker
    });
  });

  // Get workers
  static getWorkers = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 10, isActive } = req.query;

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
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [workers, total] = await Promise.all([
      prisma.worker.findMany({
        where,
        include: {
          availability: {
            where: {
              date: { gte: new Date() }
            },
            orderBy: { date: 'asc' },
            take: 7
          },
          documents: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.worker.count({ where })
    ]);

    const paginationMeta = generatePaginationMeta(parseInt(page), parseInt(limit), total);

    res.json({
      workers,
      pagination: paginationMeta
    });
  });

  // Update worker
  static updateWorker = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { workerId } = req.params;
    const updateData = req.body;

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

    // Check if worker belongs to contractor
    const worker = await prisma.worker.findFirst({
      where: {
        id: workerId,
        contractorId: contractor.id
      }
    });

    if (!worker) {
      return res.status(404).json({
        error: 'Worker not found',
        message: 'Worker not found or does not belong to your contractor profile'
      });
    }

    const updatedWorker = await prisma.worker.update({
      where: { id: workerId },
      data: updateData
    });

    res.json({
      message: 'Worker updated successfully',
      worker: updatedWorker
    });
  });

  // Delete worker
  static deleteWorker = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { workerId } = req.params;

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

    // Check if worker belongs to contractor
    const worker = await prisma.worker.findFirst({
      where: {
        id: workerId,
        contractorId: contractor.id
      }
    });

    if (!worker) {
      return res.status(404).json({
        error: 'Worker not found',
        message: 'Worker not found or does not belong to your contractor profile'
      });
    }

    await prisma.worker.delete({
      where: { id: workerId }
    });

    res.json({
      message: 'Worker deleted successfully'
    });
  });

  // Set worker availability
  static setWorkerAvailability = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { workerId } = req.params;
    const { date, timeSlot, isAvailable, notes } = req.body;

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

    // Check if worker belongs to contractor
    const worker = await prisma.worker.findFirst({
      where: {
        id: workerId,
        contractorId: contractor.id
      }
    });

    if (!worker) {
      return res.status(404).json({
        error: 'Worker not found',
        message: 'Worker not found or does not belong to your contractor profile'
      });
    }

    // Upsert availability
    const availability = await prisma.availability.upsert({
      where: {
        workerId_date_timeSlot: {
          workerId,
          date: new Date(date),
          timeSlot
        }
      },
      update: {
        isAvailable,
        notes
      },
      create: {
        workerId,
        date: new Date(date),
        timeSlot,
        isAvailable,
        notes
      }
    });

    res.json({
      message: 'Worker availability updated successfully',
      availability
    });
  });

  // Get worker availability
  static getWorkerAvailability = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { workerId } = req.params;
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

    // Check if worker belongs to contractor
    const worker = await prisma.worker.findFirst({
      where: {
        id: workerId,
        contractorId: contractor.id
      }
    });

    if (!worker) {
      return res.status(404).json({
        error: 'Worker not found',
        message: 'Worker not found or does not belong to your contractor profile'
      });
    }

    const where = { workerId };
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const availability = await prisma.availability.findMany({
      where,
      orderBy: { date: 'asc' }
    });

    res.json({ availability });
  });

  // Create rate card
  static createRateCard = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
      skill,
      minHours,
      hourlyRate,
      dailyRate,
      travelCharges,
      extraCharges
    } = req.body;

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

    const rateCard = await prisma.rateCard.create({
      data: {
        contractorId: contractor.id,
        skill,
        minHours,
        hourlyRate,
        dailyRate,
        travelCharges,
        extraCharges
      }
    });

    res.status(201).json({
      message: 'Rate card created successfully',
      rateCard
    });
  });

  // Get rate cards
  static getRateCards = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const contractor = await prisma.contractor.findUnique({
      where: { userId }
    });

    if (!contractor) {
      return res.status(404).json({
        error: 'Contractor profile not found',
        message: 'Please create a contractor profile first'
      });
    }

    const rateCards = await prisma.rateCard.findMany({
      where: { contractorId: contractor.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ rateCards });
  });

  // Update rate card
  static updateRateCard = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { rateCardId } = req.params;
    const updateData = req.body;

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

    // Check if rate card belongs to contractor
    const rateCard = await prisma.rateCard.findFirst({
      where: {
        id: rateCardId,
        contractorId: contractor.id
      }
    });

    if (!rateCard) {
      return res.status(404).json({
        error: 'Rate card not found',
        message: 'Rate card not found or does not belong to your contractor profile'
      });
    }

    const updatedRateCard = await prisma.rateCard.update({
      where: { id: rateCardId },
      data: updateData
    });

    res.json({
      message: 'Rate card updated successfully',
      rateCard: updatedRateCard
    });
  });

  // Delete rate card
  static deleteRateCard = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { rateCardId } = req.params;

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

    // Check if rate card belongs to contractor
    const rateCard = await prisma.rateCard.findFirst({
      where: {
        id: rateCardId,
        contractorId: contractor.id
      }
    });

    if (!rateCard) {
      return res.status(404).json({
        error: 'Rate card not found',
        message: 'Rate card not found or does not belong to your contractor profile'
      });
    }

    await prisma.rateCard.delete({
      where: { id: rateCardId }
    });

    res.json({
      message: 'Rate card deleted successfully'
    });
  });

  // Get contractor jobs
  static getJobs = asyncHandler(async (req, res) => {
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
              phone: true
            }
          },
          quotes: true,
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

  // Get nearby jobs
  static getNearbyJobs = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { latitude, longitude, radius = 20, page = 1, limit = 10 } = req.query;

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

    // Get all jobs within radius
    const allJobs = await prisma.job.findMany({
      where: {
        status: { in: ['PENDING', 'QUOTED'] },
        jobType: { in: ['IMMEDIATE', 'BIDDING'] }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
              // rating field does not exist on User model
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
}

export default ContractorController;
