
import prisma from '../../config/database.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import handleResponse from '../../utils/handleResponse.js';
import { calculateDistance } from '../../utils/helpers.js';
import { uploadMultipleToCloudinary } from '../../utils/cloudinaryUploader.js';

class BiddingJobController {
  static createJob = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
      title,
      description,
      address,
      city,
      state,
      pincode,
      latitude,
      longitude,
      detailedDescription,
      expectedDays,
      startDate,
      materialsProvidedBy,
      siteVisitDeadline,
      quoteSubmissionDeadline,
      requiredSkills,
      budget,
    } = req.body;

    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      try {
        const results = await uploadMultipleToCloudinary(req.files);
        imageUrls = results.map((result) => result.secure_url);
      } catch (error) {
        // Silently handle upload errors
        return handleResponse(500, 'Error uploading images.', null, res);
      }
    }

    const job = await prisma.job.create({
      data: {
        userId,
        title,
        description,
        jobType: 'BIDDING',
        address,
        city,
        state,
        pincode,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        detailedDescription,
        expectedDays: expectedDays ? parseInt(expectedDays) : null,
        startDate: startDate ? new Date(startDate) : null,
        materialsProvidedBy,
        siteVisitDeadline: siteVisitDeadline ? new Date(siteVisitDeadline) : null,
        quoteSubmissionDeadline: quoteSubmissionDeadline ? new Date(quoteSubmissionDeadline) : null,
        requiredSkills,
        budget,
        images: imageUrls,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    // Notify nearby contractors
    try {
      const requiredSkillsArray = Array.isArray(requiredSkills) ? requiredSkills : (requiredSkills ? [requiredSkills] : []);

      let contractorIdsBySkill = [];
      if (requiredSkillsArray.length > 0) {
        const skillMatches = await prisma.worker.findMany({
          where: { skills: { hasSome: requiredSkillsArray } },
          select: { contractorId: true },
          distinct: ['contractorId'],
        });
        contractorIdsBySkill = skillMatches.map((s) => s.contractorId);
      }

      const contractors = await prisma.contractor.findMany({
        where: {
          isActive: true,
          businessLatitude: { not: null },
          businessLongitude: { not: null },
          ...(contractorIdsBySkill.length > 0 ? { id: { in: contractorIdsBySkill } } : {}),
        },
        select: { id: true, userId: true, coverageRadius: true, businessLatitude: true, businessLongitude: true },
      });

      const nearbyUserIds = contractors
        .filter((c) => {
          const distKm = calculateDistance(
            Number(job.latitude),
            Number(job.longitude),
            Number(c.businessLatitude),
            Number(c.businessLongitude)
          );
          return isFinite(distKm) && distKm <= Number(c.coverageRadius);
        })
        .map((c) => c.userId);

      if (nearbyUserIds.length > 0) {
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
      // Silently handle notification errors
    }

    return handleResponse(201, 'Bidding job created successfully!', { job }, res);
  });

  static acceptQuote = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { jobId, quoteId } = req.params;

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.userId !== userId) {
      return handleResponse(404, 'Job not found or you do not have permission to modify it', null, res);
    }

    if (job.status !== 'QUOTED') {
      return handleResponse(400, 'Job is not in a state to accept quotes', null, res);
    }

    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote || quote.jobId !== jobId) {
      return handleResponse(404, 'Quote not found or it does not belong to this job', null, res);
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'ACCEPTED',
        acceptedQuoteId: quoteId,
        contractorId: quote.contractorId,
      },
    });

    // Create chat room
    await prisma.chatRoom.create({
      data: {
        jobId,
        participants: {
          connect: [{ id: userId }, { id: quote.contractorId }],
        },
      },
    });

    // Notify contractor
    const socketService = req.app.get('socketService');
    if (socketService && socketService.sendNotificationToUsers) {
      const contractorUser = await prisma.user.findFirst({ where: { contractor: { id: quote.contractorId } } });
      if (contractorUser) {
        await socketService.sendNotificationToUsers(
          [contractorUser.id],
          'QUOTE_ACCEPTED',
          'Your quote was accepted',
          `Your quote for "${job.title}" has been accepted.`,
          { jobId: job.id }
        );
      }
    }

    return handleResponse(200, 'Quote accepted successfully', { job: updatedJob }, res);
  });
}

export default BiddingJobController;
