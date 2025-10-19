import prisma from '../../config/database.js';
import {
  generateToken,
  generateRefreshToken,
  hashPassword,
  comparePassword,
  storeRefreshToken,
  deleteRefreshToken,
  generateOTP,
  storeOTP,
  verifyOTP,
  deleteOTP
} from '../../utils/auth.js';
import { formatPhoneNumber, maskSensitiveData, generatePaginationMeta } from '../../utils/helpers.js';
import twilioClient from '../../config/twilioConfig.js';
import { asyncHandler } from '../../middleware/errorHandler.js';

class UserController {
  // Register new user
  static register = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, phone, password, role = 'USER' } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { phone: formatPhoneNumber(phone) }
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email or phone number already exists'
      });
    }

    // Hash password if provided
    const hashedPassword = password ? await hashPassword(password) : null;

    // Create user
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone: formatPhoneNumber(phone),
        password: hashedPassword,
        role,
        status: 'PENDING_VERIFICATION'
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        isVerified: true,
        createdAt: true
      }
    });

    // Generate OTP for phone verification
    const otp = generateOTP();
    await storeOTP(formatPhoneNumber(phone), otp);

    // Send OTP via SMS
    try {
      await twilioClient.messages.create({
        body: `Your LabourHire verification code is: ${otp}. Valid for 5 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formatPhoneNumber(phone)
      });
    } catch (error) {
      console.error('SMS sending failed:', error);
    }

    res.status(201).json({
      message: 'User registered successfully. Please verify your phone number.',
      user: {
        ...user,
        phone: maskSensitiveData(user.phone, 'phone'),
        email: user.email ? maskSensitiveData(user.email, 'email') : null
      }
    });
  });

  // Login user
  static login = asyncHandler(async (req, res) => {
    const { phone, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { phone: formatPhoneNumber(phone) },
      include: {
        contractorProfile: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Phone number or password is incorrect'
      });
    }

    // Check password if user has one
    if (user.password && !(await comparePassword(password, user.password))) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Phone number or password is incorrect'
      });
    }

    // Check user status
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        error: 'Account suspended',
        message: 'Your account has been suspended. Please contact support.'
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      role: user.role,
      isVerified: user.isVerified
    };

    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Store refresh token
    await storeRefreshToken(user.id, refreshToken);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: maskSensitiveData(user.phone, 'phone'),
        role: user.role,
        status: user.status,
        isVerified: user.isVerified,
        contractorProfile: user.contractorProfile
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  });

  // Verify OTP
  static verifyOTP = asyncHandler(async (req, res) => {
    const { phone, otp } = req.body;

    // Verify OTP
    const isValidOTP = await verifyOTP(formatPhoneNumber(phone), otp);
    if (!isValidOTP) {
      return res.status(400).json({
        error: 'Invalid OTP',
        message: 'The OTP you entered is invalid or expired'
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { phone: formatPhoneNumber(phone) }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No user found with this phone number'
      });
    }

    // Update user verification status
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        status: 'ACTIVE'
      }
    });

    // Delete OTP
    await deleteOTP(formatPhoneNumber(phone));

    res.json({
      message: 'Phone number verified successfully',
      user: {
        id: user.id,
        isVerified: true,
        status: 'ACTIVE'
      }
    });
  });

  // Resend OTP
  static resendOTP = asyncHandler(async (req, res) => {
    const { phone } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { phone: formatPhoneNumber(phone) }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No user found with this phone number'
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    await storeOTP(formatPhoneNumber(phone), otp);

    // Send OTP via SMS
    try {
      await twilioClient.messages.create({
        body: `Your LabourHire verification code is: ${otp}. Valid for 5 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formatPhoneNumber(phone)
      });
    } catch (error) {
      console.error('SMS sending failed:', error);
      return res.status(500).json({
        error: 'Failed to send OTP',
        message: 'Unable to send verification code. Please try again.'
      });
    }

    res.json({
      message: 'OTP sent successfully'
    });
  });

  // Refresh token
  static refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token required',
        message: 'Refresh token is required'
      });
    }

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, JWT_SECRET);

      // Check if refresh token exists in Redis
      const storedToken = await getRefreshToken(decoded.userId);
      if (storedToken !== refreshToken) {
        return res.status(401).json({
          error: 'Invalid refresh token',
          message: 'Refresh token is invalid or expired'
        });
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          role: true,
          isVerified: true,
          status: true
        }
      });

      if (!user || user.status === 'SUSPENDED') {
        return res.status(401).json({
          error: 'User not found or suspended',
          message: 'User not found or account suspended'
        });
      }

      // Generate new tokens
      const tokenPayload = {
        userId: user.id,
        role: user.role,
        isVerified: user.isVerified
      };

      const newAccessToken = generateToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);

      // Store new refresh token
      await storeRefreshToken(user.id, newRefreshToken);

      res.json({
        message: 'Token refreshed successfully',
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        }
      });
    } catch (error) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        message: 'Refresh token is invalid or expired'
      });
    }
  });

  // Logout
  static logout = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Delete refresh token
    await deleteRefreshToken(userId);

    res.json({
      message: 'Logged out successfully'
    });
  });

  // Get user profile
  static getProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        contractorProfile: {
          include: {
            workers: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                skills: true,
                isActive: true,
                rating: true
              }
            },
            rateCards: true
          }
        },
        documents: true
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    res.json({
      user: {
        ...user,
        phone: maskSensitiveData(user.phone, 'phone'),
        email: user.email ? maskSensitiveData(user.email, 'email') : null
      }
    });
  });

  // Update user profile
  static updateProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { firstName, lastName, email, address, city, state, pincode, dateOfBirth } = req.body;

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: email,
          id: { not: userId }
        }
      });

      if (existingUser) {
        return res.status(409).json({
          error: 'Email already exists',
          message: 'This email is already registered with another account'
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        email,
        address,
        city,
        state,
        pincode,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        dateOfBirth: true,
        updatedAt: true
      }
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        ...updatedUser,
        email: updatedUser.email ? maskSensitiveData(updatedUser.email, 'email') : null
      }
    });
  });

  // Change password
  static changePassword = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true }
    });

    if (!user.password) {
      return res.status(400).json({
        error: 'No password set',
        message: 'This account does not have a password set'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: 'Invalid current password',
        message: 'The current password you entered is incorrect'
      });
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });

    res.json({
      message: 'Password changed successfully'
    });
  });

  // Delete account
  static deleteAccount = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { password } = req.body;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true }
    });

    // Verify password if user has one
    if (user.password && !(await comparePassword(password, user.password))) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'The password you entered is incorrect'
      });
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: userId }
    });

    // Delete refresh token
    await deleteRefreshToken(userId);

    res.json({
      message: 'Account deleted successfully'
    });
  });

  // Get user jobs
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
              rating: true
            }
          },
          quotes: {
            select: {
              id: true,
              amount: true,
              estimatedArrival: true,
              createdAt: true
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
}

export default UserController;
