import prisma from '../../config/database.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import handleResponse from '../../utils/handleResponse.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generatePaginationMeta } from '../../utils/helpers.js';

class AdminController {
  // Auth Methods
  static register = asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return handleResponse(400, 'All fields are required.', null, res);
    }

    const existingAdmin = await prisma.user.findUnique({
      where: { email }
    });

    if (existingAdmin) {
      return handleResponse(400, 'Email already registered.', null, res);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'ADMIN',
        isVerified: true
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });

    return handleResponse(201, 'Admin registered successfully.', { admin }, res);
  });

  static login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return handleResponse(400, 'Email and password are required.', null, res);
    }

    const admin = await prisma.user.findUnique({
      where: { email }
    });

    if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'STAFF')) {
      return handleResponse(401, 'Invalid credentials.', null, res);
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return handleResponse(401, 'Invalid credentials.', null, res);
    }

    const token = jwt.sign(
      { userId: admin.id, role: admin.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    return handleResponse(200, 'Admin logged in successfully.', {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role
      }
    }, res);
  });

  // Dashboard Stats
  static getDashboardStats = asyncHandler(async (req, res) => {
    const [totalUsers, totalContractors, totalJobs, totalPayments, totalRevenue, pendingDocuments] = await Promise.all([
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.contractor.count(),
      prisma.job.count(),
      prisma.payment.count(),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'COMPLETED' }
      }),
      prisma.document.count({ where: { status: 'PENDING' } })
    ]);

    const stats = {
      totalUsers,
      totalContractors,
      totalJobs,
      totalPayments,
      totalRevenue: totalRevenue._sum.amount || 0,
      pendingDocuments,
      timestamp: new Date()
    };

    return handleResponse(200, 'Dashboard stats retrieved successfully.', stats, res);
  });

  // User Management
  static getUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, status } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { role: 'USER' };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (status) where.isVerified = status === 'verified';

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: {
              jobs: true,
              payments: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.user.count({ where })
    ]);

    const meta = generatePaginationMeta(parseInt(page), parseInt(limit), total);

    return handleResponse(200, 'Users retrieved successfully.', { users, meta }, res);
  });

  static getUserDetails = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            jobs: true,
            bids: true,
            payments: true
          }
        },
        jobs: {
          take: 5,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      return handleResponse(404, 'User not found.', null, res);
    }

    return handleResponse(200, 'User details retrieved successfully.', user, res);
  });

  static updateUserStatus = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { isVerified, isBlocked } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return handleResponse(404, 'User not found.', null, res);
    }

    const updateData = {};
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    if (isBlocked !== undefined) updateData.isBlocked = isBlocked;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isVerified: true,
        isBlocked: true
      }
    });

    return handleResponse(200, 'User status updated successfully.', updatedUser, res);
  });

  // Contractor Management
  static getContractors = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, status } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { businessPhone: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }
    if (status) where.isVerified = status === 'verified';

    const [contractors, total] = await Promise.all([
      prisma.contractor.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true
            }
          },
          _count: {
            select: {
              jobs: true,
              payments: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.contractor.count({ where })
    ]);

    const meta = generatePaginationMeta(parseInt(page), parseInt(limit), total);

    return handleResponse(200, 'Contractors retrieved successfully.', { contractors, meta }, res);
  });

  static updateContractorStatus = asyncHandler(async (req, res) => {
    const { contractorId } = req.params;
    const { isVerified, isBlocked } = req.body;

    const contractor = await prisma.contractor.findUnique({
      where: { id: contractorId }
    });

    if (!contractor) {
      return handleResponse(404, 'Contractor not found.', null, res);
    }

    const updateData = {};
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    if (isBlocked !== undefined) updateData.isBlocked = isBlocked;

    const updatedContractor = await prisma.contractor.update({
      where: { id: contractorId },
      data: updateData,
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return handleResponse(200, 'Contractor status updated successfully.', updatedContractor, res);
  });

  // Document Verification
  static getPendingVerifications = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, type } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { status: 'PENDING' };

    if (type) where.documentType = type;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          contractor: {
            select: {
              id: true,
              businessName: true
            }
          }
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.document.count({ where })
    ]);

    const meta = generatePaginationMeta(parseInt(page), parseInt(limit), total);

    return handleResponse(200, 'Pending verifications retrieved successfully.', { documents, meta }, res);
  });

  static verifyDocument = asyncHandler(async (req, res) => {
    const { documentId } = req.params;
    const { status, remarks } = req.body;

    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      return handleResponse(400, 'Invalid status.', null, res);
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      return handleResponse(404, 'Document not found.', null, res);
    }

    const updateData = {
      status,
      verifiedAt: new Date(),
      remarks
    };

    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return handleResponse(200, 'Document verified successfully.', updatedDocument, res);
  });

  // Reports
  static getReports = asyncHandler(async (req, res) => {
    const { startDate, endDate, type } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [jobStats, paymentStats, userStats] = await Promise.all([
      prisma.job.groupBy({
        by: ['status'],
        _count: true,
        where: dateFilter
      }),
      prisma.payment.groupBy({
        by: ['status'],
        _count: true,
        _sum: { amount: true },
        where: dateFilter
      }),
      prisma.user.count({ where: dateFilter })
    ]);

    const reports = {
      jobStats,
      paymentStats,
      userStats,
      period: { startDate, endDate }
    };

    return handleResponse(200, 'Reports retrieved successfully.', reports, res);
  });

  // Audit Logs
  static getAuditLogs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, userId, action, startDate, endDate } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.auditLog.count({ where })
    ]);

    const meta = generatePaginationMeta(parseInt(page), parseInt(limit), total);

    return handleResponse(200, 'Audit logs retrieved successfully.', { logs, meta }, res);
  });

  // Commission Settings
  static getCommissionRate = asyncHandler(async (req, res) => {
    let settings = await prisma.adminSettings.findFirst();
    if (!settings) {
      settings = await prisma.adminSettings.create({
        data: {
          commissionRate: 0.1, // Default 10%
        },
      });
    }
    return handleResponse(200, 'Commission rate retrieved successfully.', { settings }, res);
  });

  static setCommissionRate = asyncHandler(async (req, res) => {
    const { commissionRate } = req.body;
    if (commissionRate === undefined || commissionRate === null) {
      return handleResponse(400, 'Commission rate is required.', null, res);
    }

    let settings = await prisma.adminSettings.findFirst();
    if (!settings) {
      settings = await prisma.adminSettings.create({
        data: {
          commissionRate: parseFloat(commissionRate),
        },
      });
    } else {
      settings = await prisma.adminSettings.update({
        where: { id: settings.id },
        data: {
          commissionRate: parseFloat(commissionRate),
        },
      });
    }

    return handleResponse(200, 'Commission rate updated successfully.', { settings }, res);
  });
}

export default AdminController;