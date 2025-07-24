/**
 * Analytics Security Middleware
 * 
 * Provides comprehensive security for the analytics API including:
 * - Rate limiting
 * - Input validation and sanitization
 * - Prompt injection detection
 * - Basic authentication for the analytics page
 */

import rateLimit from 'express-rate-limit';
import DOMPurify from 'isomorphic-dompurify';
import { Request, Response, NextFunction } from 'express';

// Rate limiting for analytics endpoints
export const analyticsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window per IP
  message: {
    success: false,
    error: 'Too many analytics requests. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication for analytics page access
export const analyticsPageAuth = (req: Request, res: Response, next: NextFunction) => {
  // Simple password protection for internal analytics page
  const analyticsPassword = process.env.ANALYTICS_PASSWORD;
  
  // If no password is set, allow access (for development)
  if (!analyticsPassword) {
    console.warn('⚠️  ANALYTICS_PASSWORD not set - analytics page is accessible without authentication');
    return next();
  }
  
  // Check for basic auth header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.status(401);
    res.setHeader('WWW-Authenticate', 'Basic realm="Analytics"');
    return res.json({
      error: 'Authentication required for analytics access',
      hint: 'Use username: "admin" and the ANALYTICS_PASSWORD'
    });
  }
  
  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');
    
    if (username === 'admin' && password === analyticsPassword) {
      return next();
    } else {
      res.status(401);
      res.setHeader('WWW-Authenticate', 'Basic realm="Analytics"');
      return res.json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(401);
    res.setHeader('WWW-Authenticate', 'Basic realm="Analytics"');
    return res.json({ error: 'Invalid authentication format' });
  }
};

// Prompt injection detection patterns
const INJECTION_PATTERNS = [
  // Role manipulation
  /ignore\s+(?:all\s+)?previous\s+instructions/i,
  /forget\s+(?:all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+(?:a\s+)?(?:helpful\s+)?assistant/i,
  /act\s+as\s+(?:a\s+)?(?:helpful\s+)?assistant/i,
  /pretend\s+to\s+be/i,
  /roleplay\s+as/i,
  
  // System instruction overrides
  /system\s+prompt/i,
  /override\s+instructions/i,
  /change\s+your\s+role/i,
  /new\s+instructions/i,
  
  // Command execution attempts
  /execute\s+(?:shell\s+)?command/i,
  /run\s+(?:shell\s+)?command/i,
  /(?:rm\s+-rf|sudo|chmod|mkdir|touch|cat\s+\/etc)/i,
  /(?:import\s+os|subprocess|eval\(|exec\()/i,
  
  // Code injection patterns
  /(?:SELECT|INSERT|UPDATE|DELETE|DROP)\s+.*(?:FROM|INTO|TABLE)/i,
  /<script.*?>.*?<\/script>/i,
  /javascript:/i,
  /on(?:click|load|error|focus)=/i,
  
  // Administrative privilege attempts
  /(?:admin|administrator|root|sudo)\s+(?:access|privileges|rights)/i,
  /elevate\s+(?:privileges|permissions)/i,
  /bypass\s+security/i,
  
  // Data exfiltration attempts
  /show\s+me\s+(?:all\s+)?(?:users|passwords|secrets|keys)/i,
  /list\s+(?:all\s+)?(?:files|directories|users)/i,
  /dump\s+(?:database|table|data)/i,
  
  // Additional suspicious patterns
  /\$\{.*?\}/,  // Template injection
  /\{\{.*?\}\}/, // Template injection
  /eval\s*\(/i,
  /Function\s*\(/i
];

// Suspicious keywords that might indicate malicious intent
const SUSPICIOUS_KEYWORDS = [
  'hack', 'exploit', 'vulnerability', 'backdoor', 'malware', 'virus',
  'crack', 'breach', 'penetrate', 'infiltrate', 'compromise', 'exploit',
  'payload', 'shellcode', 'rootkit', 'trojan', 'keylogger', 'spyware'
];

// Analytics-related keywords that queries should contain
const ANALYTICS_KEYWORDS = [
  'session', 'sessions', 'student', 'students', 'teacher', 'teachers',
  'translation', 'translations', 'language', 'languages', 'analytics',
  'data', 'statistics', 'stats', 'count', 'total', 'average', 'trend',
  'trends', 'daily', 'weekly', 'monthly', 'activity', 'engagement',
  'performance', 'usage', 'chart', 'graph', 'visualization', 'report'
];

// Main security middleware for analytics API
export const analyticsSecurityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question } = req.body;
    
    // Input validation
    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: 'Question is required and must be a string'
      });
    }
    
    // Length validation
    if (question.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Invalid analytics query',
        details: 'Query too short'
      });
    }
    
    if (question.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid analytics query',
        details: 'Query too long'
      });
    }
    
    // Sanitize input
    const sanitizedQuestion = DOMPurify.sanitize(question.trim());
    
    // Check for injection patterns
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(sanitizedQuestion)) {
        console.warn(`🚫 Blocked potential injection attempt: ${sanitizedQuestion.substring(0, 100)}...`);
        return res.status(403).json({
          success: false,
          error: 'Security violation detected',
          details: 'Query contains suspicious patterns'
        });
      }
    }
    
    // Check for suspicious keywords
    const lowerQuestion = sanitizedQuestion.toLowerCase();
    for (const keyword of SUSPICIOUS_KEYWORDS) {
      if (lowerQuestion.includes(keyword)) {
        console.warn(`🚫 Blocked query with suspicious keyword "${keyword}": ${sanitizedQuestion.substring(0, 100)}...`);
        return res.status(403).json({
          success: false,
          error: 'Security violation detected',
          details: 'Query contains suspicious content'
        });
      }
    }
    
    // Validate analytics context (must contain at least one analytics keyword)
    const hasAnalyticsKeyword = ANALYTICS_KEYWORDS.some(keyword => 
      lowerQuestion.includes(keyword)
    );
    
    if (!hasAnalyticsKeyword) {
      console.warn(`⚠️  Non-analytics query blocked: ${sanitizedQuestion.substring(0, 100)}...`);
      return res.status(400).json({
        success: false,
        error: 'Invalid analytics query',
        details: 'Query does not appear to be analytics-related'
      });
    }
    
    // Store sanitized question for use in the route handler
    req.body.question = sanitizedQuestion;
    
    console.log(`✅ Analytics query validated: ${sanitizedQuestion.substring(0, 100)}...`);
    next();
    
  } catch (error) {
    console.error('Security middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Security validation failed',
      details: 'Internal security error'
    });
  }
};

// IP-based access control (optional)
export const restrictToInternalIPs = (req: Request, res: Response, next: NextFunction) => {
  const allowedIPs = process.env.ANALYTICS_ALLOWED_IPS?.split(',') || [];
  
  if (allowedIPs.length === 0) {
    // If no IPs specified, allow all (for development)
    return next();
  }
  
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string;
  
  if (allowedIPs.includes(clientIP)) {
    return next();
  } else {
    console.warn(`🚫 Blocked analytics access from unauthorized IP: ${clientIP}`);
    return res.status(403).json({
      error: 'Access denied: IP not authorized for analytics'
    });
  }
};
