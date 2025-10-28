import { body, param, query, validationResult } from 'express-validator';

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// User validation rules
export const validateUserRegistration = [
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('phone').isMobilePhone('en-IN').withMessage('Valid Indian phone number required'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['USER', 'CONTRACTOR']).withMessage('Invalid role'),
  handleValidationErrors
];

export const validateUserLogin = [
  body('phone').isMobilePhone('en-IN').withMessage('Valid Indian phone number required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

export const validateOTP = [
  body('phone').isMobilePhone('en-IN').withMessage('Valid Indian phone number required'),
  body('otp').isLength({ min: 4, max: 6 }).isNumeric().withMessage('Valid OTP required'),
  handleValidationErrors
];

// Contractor validation rules
export const validateContractorProfile = [
  body('businessName').trim().isLength({ min: 2, max: 100 }).withMessage('Business name must be 2-100 characters'),
  body('businessType').trim().isLength({ min: 2, max: 50 }).withMessage('Business type must be 2-50 characters'),
  body('businessAddress').trim().isLength({ min: 10, max: 200 }).withMessage('Business address must be 10-200 characters'),
  body('businessCity').trim().isLength({ min: 2, max: 50 }).withMessage('City must be 2-50 characters'),
  body('businessState').trim().isLength({ min: 2, max: 50 }).withMessage('State must be 2-50 characters'),
  body('businessPincode').isPostalCode('IN').withMessage('Valid Indian pincode required'),
  body('coverageRadius').optional().isFloat({ min: 1, max: 100 }).withMessage('Coverage radius must be 1-100 km'),
  handleValidationErrors
];

// Worker validation rules
export const validateWorker = [
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters'),
  body('phone').isMobilePhone('en-IN').withMessage('Valid Indian phone number required'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('skills').isArray({ min: 1 }).withMessage('At least one skill is required'),
  body('experience').optional().isInt({ min: 0, max: 50 }).withMessage('Experience must be 0-50 years'),
  body('hourlyRate').optional().isFloat({ min: 0 }).withMessage('Hourly rate must be positive'),
  body('dailyRate').optional().isFloat({ min: 0 }).withMessage('Daily rate must be positive'),
  handleValidationErrors
];

// Job validation rules
export const validateJobCreation = [
  body('title').trim().isLength({ min: 5, max: 100 }).withMessage('Title must be 5-100 characters'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters'),
  body('jobType').isIn(['IMMEDIATE', 'SCHEDULED', 'BIDDING']).withMessage('Invalid job type'),
  body('address').trim().isLength({ min: 10, max: 200 }).withMessage('Address must be 10-200 characters'),
  body('city').trim().isLength({ min: 2, max: 50 }).withMessage('City must be 2-50 characters'),
  body('state').trim().isLength({ min: 2, max: 50 }).withMessage('State must be 2-50 characters'),
  body('pincode').isPostalCode('IN').withMessage('Valid Indian pincode required'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
  body('scheduledDate').optional().isISO8601().withMessage('Valid date required'),
  body('scheduledTime').optional().isString().withMessage('Valid time required'),
  body('estimatedDuration').optional().isInt({ min: 1, max: 24 }).withMessage('Duration must be 1-24 hours'),
  body('numberOfWorkers').isInt({ min: 1, max: 20 }).withMessage('Number of workers must be 1-20'),
  body('requiredSkills').isArray({ min: 1 }).withMessage('At least one skill is required'),
  body('budget').optional().isFloat({ min: 0 }).withMessage('Budget must be positive'),
  handleValidationErrors
];

// Quote validation rules
export const validateQuote = [
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
  body('estimatedArrival').optional().isString().withMessage('Valid ETA required'),
  body('notes').optional().isString().withMessage('Notes must be string'),
  handleValidationErrors
];

// Rate card validation rules
export const validateRateCard = [
  body('skill').trim().isLength({ min: 2, max: 50 }).withMessage('Skill must be 2-50 characters'),
  body('minHours').isInt({ min: 1, max: 24 }).withMessage('Min hours must be 1-24'),
  body('hourlyRate').isFloat({ min: 0 }).withMessage('Hourly rate must be positive'),
  body('dailyRate').optional().isFloat({ min: 0 }).withMessage('Daily rate must be positive'),
  body('travelCharges').optional().isFloat({ min: 0 }).withMessage('Travel charges must be positive'),
  body('extraCharges').optional().isFloat({ min: 0 }).withMessage('Extra charges must be positive'),
  handleValidationErrors
];

// Review validation rules
export const validateReview = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('comment').optional().isString().isLength({ max: 500 }).withMessage('Comment must be less than 500 characters'),
  handleValidationErrors
];

// Payment validation rules
export const validatePayment = [
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
  body('paymentType').isIn(['advance', 'final', 'refund']).withMessage('Invalid payment type'),
  handleValidationErrors
];

// ID validation
export const validateObjectId = [
  param('id').isLength({ min: 1 }).withMessage('Valid ID required'),
  handleValidationErrors
];

// Pagination validation
export const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  handleValidationErrors
];

// Validation rules for updates (making fields optional)
export const validateContractorProfileUpdate = [
  body('businessName').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Business name must be 2-100 characters'),
  body('businessType').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Business type must be 2-50 characters'),
  body('businessAddress').optional().trim().isLength({ min: 10, max: 200 }).withMessage('Business address must be 10-200 characters'),
  body('businessCity').optional().trim().isLength({ min: 2, max: 50 }).withMessage('City must be 2-50 characters'),
  body('businessState').optional().trim().isLength({ min: 2, max: 50 }).withMessage('State must be 2-50 characters'),
  body('businessPincode').optional().isPostalCode('IN').withMessage('Valid Indian pincode required'),
  body('coverageRadius').optional().isFloat({ min: 1, max: 100 }).withMessage('Coverage radius must be 1-100 km'),
  handleValidationErrors
];

export const validateWorkerUpdate = [
  body('firstName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters'),
  body('lastName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters'),
  body('phone').optional().isMobilePhone('en-IN').withMessage('Valid Indian phone number required'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('skills').optional().isArray({ min: 1 }).withMessage('At least one skill is required'),
  body('experience').optional().isInt({ min: 0, max: 50 }).withMessage('Experience must be 0-50 years'),
  body('hourlyRate').optional().isFloat({ min: 0 }).withMessage('Hourly rate must be positive'),
  body('dailyRate').optional().isFloat({ min: 0 }).withMessage('Daily rate must be positive'),
  handleValidationErrors
];

export const validateRateCardUpdate = [
  body('skill').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Skill must be 2-50 characters'),
  body('minHours').optional().isInt({ min: 1, max: 24 }).withMessage('Min hours must be 1-24'),
  body('hourlyRate').optional().isFloat({ min: 0 }).withMessage('Hourly rate must be positive'),
  body('dailyRate').optional().isFloat({ min: 0 }).withMessage('Daily rate must be positive'),
  body('travelCharges').optional().isFloat({ min: 0 }).withMessage('Travel charges must be positive'),
  body('extraCharges').optional().isFloat({ min: 0 }).withMessage('Extra charges must be positive'),
  handleValidationErrors
];
