/**
 * Authentication Routes
 * 
 * Handles teacher login, registration, and session management
 */
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import logger from '../logger';

const router = Router();

// JWT secret (in production, this should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;

/**
 * Register a new teacher
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const newUser = await db
      .insert(users)
      .values({
        username,
        password: hashedPassword,
      })
      .returning({ id: users.id, username: users.username });

    logger.info('New teacher registered:', { username, teacherId: newUser[0].id });

    res.status(201).json({
      message: 'Teacher registered successfully',
      user: { id: newUser[0].id, username: newUser[0].username }
    });

  } catch (error: any) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Login teacher
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (user.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user[0].password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user[0].id, username: user[0].username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info('Teacher logged in:', { username, teacherId: user[0].id });

    res.json({
      message: 'Login successful',
      user: { id: user[0].id, username: user[0].username },
      token
    });

  } catch (error: any) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Verify teacher token (middleware)
 */
export const verifyTeacherToken = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.teacher = { id: decoded.userId, username: decoded.username };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Get current teacher info
 */
router.get('/me', verifyTeacherToken, (req: any, res) => {
  res.json({ user: req.teacher });
});

export default router;
