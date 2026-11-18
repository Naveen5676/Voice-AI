import { rateLimit } from 'express-rate-limit'

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // 300 requests per 15 minutes per IP
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { trustProxy: false },
  skip: (request) => request.path.startsWith('/internal') || request.path === '/health',
  message: { message: 'Too many requests, please try again later.' },
})

export const startCallRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 10, // max 10 call start attempts per 5 minutes per IP
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { message: 'Too many call start attempts. Please wait a few minutes before trying again.' },
})
