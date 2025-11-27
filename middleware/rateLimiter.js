import rateLimit from 'express-rate-limit';
 '../config/redisConfig.js';

// General rate limiter
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limiter (stricter)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many authentication attempts',
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// OTP rate limiter (very strict)
export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: {
    error: 'Too many OTP requests',
    message: 'Too many OTP requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Job creation rate limiter
export const jobCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many job requests',
    message: 'Too many job requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Quote submission rate limiter
export const quoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: 'Too many quote submissions',
    message: 'Too many quote submissions, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment order creation rate limiter (strict)
export const paymentOrderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15,
  message: {
    error: 'Too many payment requests',
    message: 'Too many payment requests, please try again later. Maximum 15 orders per hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment verification rate limiter (very strict)
export const paymentVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    error: 'Too many verification attempts',
    message: 'Too many payment verification attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

