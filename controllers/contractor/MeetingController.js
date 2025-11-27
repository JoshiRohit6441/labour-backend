
import prisma from '../../config/database.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import handleResponse from '../../utils/handleResponse.js';

class MeetingController {
  static createMeeting = asyncHandler(async (req, res) => {
    const contractorId = req.user.id;
    const { jobId, meetingTime, location, notes } = req.body;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { userId: true, jobType: true },
    });

    if (!job) {
      return handleResponse(404, 'Job not found', {}, res);
    }

    if (job.jobType !== 'BIDDING') {
      return handleResponse(400, 'Meetings can only be scheduled for bidding jobs', {}, res);
    }

    const meeting = await prisma.meeting.create({
      data: {
        jobId,
        contractorId,
        meetingTime: new Date(meetingTime),
        location,
        notes,
      },
    });

    // Notify user about the meeting
    const socketService = req.app.get('socketService');
    if (socketService && socketService.sendNotificationToUsers) {
      await socketService.sendNotificationToUsers(
        [job.userId],
        'MEETING_SCHEDULED',
        'Meeting Scheduled',
        `A contractor has scheduled a meeting for the job "${job.title}"`,
        { jobId: job.id, meetingId: meeting.id }
      );
    }

    return handleResponse(201, 'Meeting scheduled successfully', { meeting }, res);
  });

  static getMeetings = asyncHandler(async (req, res) => {
    const contractorId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const where = { contractorId };
    if (status) {
      where.status = status;
    }

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            userId: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        }
      },
      orderBy: { meetingTime: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.meeting.count({ where });

    const formattedMeetings = meetings.map(m => ({
      id: m.id,
      jobId: m.jobId,
      meetingTime: m.meetingTime,
      location: m.location,
      notes: m.notes,
      status: m.status,
      jobTitle: m.job?.title,
      userId: m.job?.userId,
      userName: m.job?.user ? `${m.job.user.firstName} ${m.job.user.lastName}` : null,
    }));

    return handleResponse(200, 'Meetings retrieved successfully', { 
      meetings: formattedMeetings,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    }, res);
  });

  static getMeetingById = asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const contractorId = req.user.id;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            userId: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
              }
            }
          }
        }
      }
    });

    if (!meeting || meeting.contractorId !== contractorId) {
      return handleResponse(404, 'Meeting not found', {}, res);
    }

    return handleResponse(200, 'Meeting retrieved successfully', { meeting }, res);
  });

  static updateMeetingStatus = asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const { status } = req.body;
    const contractorId = req.user.id;

    const validStatuses = ['SCHEDULED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return handleResponse(400, 'Invalid status', {}, res);
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId }
    });

    if (!meeting || meeting.contractorId !== contractorId) {
      return handleResponse(404, 'Meeting not found', {}, res);
    }

    const updatedMeeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: { status },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            userId: true,
          }
        }
      }
    });

    // Notify user about meeting status change
    const socketService = req.app.get('socketService');
    if (socketService && socketService.sendNotificationToUsers) {
      const statusMsg = status === 'COMPLETED' ? 'completed' : 'cancelled';
      await socketService.sendNotificationToUsers(
        [updatedMeeting.job.userId],
        `MEETING_${status}`,
        `Meeting ${statusMsg}`,
        `A meeting for the job "${updatedMeeting.job.title}" has been ${statusMsg}`,
        { jobId: updatedMeeting.job.id, meetingId: updatedMeeting.id }
      );
    }

    return handleResponse(200, `Meeting ${statusMsg} successfully`, { meeting: updatedMeeting }, res);
  });

  static deleteMeeting = asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const contractorId = req.user.id;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId }
    });

    if (!meeting || meeting.contractorId !== contractorId) {
      return handleResponse(404, 'Meeting not found', {}, res);
    }

    await prisma.meeting.delete({
      where: { id: meetingId }
    });

    return handleResponse(200, 'Meeting deleted successfully', {}, res);
  });
}

export default MeetingController;
