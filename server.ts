import express from 'express';
import path from 'path';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { User, Assessment, Slide, Submission, AdminUser } from './server/models.js';

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only';

app.use(express.json());

// Authentication Middleware
const authenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers.token) {
    token = req.headers.token;
  }

  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token.trim(), JWT_SECRET) as any;
    let foundUser = null;

    // Check role from decoded payload
    if (decoded.role === 'admin' || decoded.role === 'franchise') {
      const admin = await AdminUser.findById(decoded.id);
      if (admin) {
        foundUser = admin.toObject ? admin.toObject() : admin;
        foundUser.role = 'admin';
      }
    }

    // Fallback/Standard lookup in User (students / main site UserDetails)
    if (!foundUser) {
      const user = await User.findById(decoded.id);
      if (user) {
        foundUser = user.toObject ? user.toObject() : user;
        if (!foundUser.role) {
          foundUser.role = 'student';
        }
      }
    }

    if (!foundUser) return res.status(401).json({ message: 'User not found' });
    req.user = foundUser;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const isAdmin = (req: any, res: any, next: any) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};

async function startServer() {
  // MongoDB Connection
  const MONGODB_URI = process.env.MONGODB_URI;

  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('MongoDB connection error:', err);
    }
  } else {
    console.warn('MONGODB_URI not found in environment. Database features will fail.');
  }

  // --- AUTH ROUTES ---
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, password, role } = req.body;
      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ message: 'Email already in use' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({ name, email, password: hashedPassword, role });
      await user.save();

      const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ user, token });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      let foundUser: any = await User.findOne({ email: email.toLowerCase() });
      let calculatedRole = 'student';

      if (!foundUser) {
        const admin = await AdminUser.findOne({ email: email.toLowerCase() });
        if (admin) {
          foundUser = admin;
          calculatedRole = 'admin';
        }
      }

      if (!foundUser || !(await bcrypt.compare(password, foundUser.password as string))) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const role = foundUser.role || calculatedRole;
      const userObj = foundUser.toObject ? foundUser.toObject() : foundUser;
      
      delete userObj.password;
      userObj.role = role;

      const token = jwt.sign({ id: foundUser._id, role }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ user: userObj, token });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/auth/me', authenticate, (req: any, res: any) => {
    res.json(req.user);
  });

  // --- ASSESSMENT ROUTES ---
  app.get('/api/assessments', authenticate, async (req, res) => {
    try {
      const assessments = await Assessment.find();
      res.json(assessments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/assessments/:id', authenticate, async (req, res) => {
    try {
      const assessment = await Assessment.findById(req.params.id);
      if (!assessment) return res.status(404).json({ message: 'Not found' });
      res.json(assessment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/assessments', authenticate, isAdmin, async (req: any, res) => {
    try {
      const assessment = new Assessment({ ...req.body, createdBy: req.user._id });
      await assessment.save();
      res.status(201).json(assessment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/assessments/:id', authenticate, isAdmin, async (req, res) => {
    try {
      const assessment = await Assessment.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(assessment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete('/api/assessments/:id', authenticate, isAdmin, async (req, res) => {
    try {
      await Assessment.findByIdAndDelete(req.params.id);
      await Slide.deleteMany({ assessmentId: req.params.id });
      res.json({ message: 'Deleted' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/assessments/:id/slides', authenticate, async (req, res) => {
    try {
      const slides = await Slide.find({ assessmentId: req.params.id }).sort('order');
      res.json(slides);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/assessments/:id/slides/batch', authenticate, isAdmin, async (req, res) => {
    try {
      const { slides } = req.body;
      const assessmentId = req.params.id;
      const incomingIds = slides.map((s: any) => s.id).filter((id: string) => id && !id.startsWith('new-'));
      await Slide.deleteMany({ assessmentId, _id: { $nin: incomingIds } });

      const results = [];
      for (const slideData of slides) {
        if (slideData.id && !slideData.id.startsWith('new-')) {
          const updated = await Slide.findByIdAndUpdate(slideData.id, slideData, { new: true });
          results.push(updated);
        } else {
          const newSlide = new Slide({ ...slideData, assessmentId, _id: undefined });
          await newSlide.save();
          results.push(newSlide);
        }
      }
      res.json(results);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // --- SUBMISSION ROUTES ---
  app.get('/api/submissions', authenticate, async (req: any, res) => {
    try {
      let query: any = {};
      if (req.user.role === 'student') query.userId = req.user._id;
      if (req.user.role === 'assessor') query.assessorId = req.user._id;
      
      const submissions = await Submission.find(query).populate('userId', 'name email').populate('assessmentId', 'title');
      res.json(submissions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/submissions/:id', authenticate, async (req, res) => {
    try {
      const submission = await Submission.findById(req.params.id).populate('userId', 'name email').populate('assessmentId', 'title');
      res.json(submission);
    } catch (error: any) {
      res.status(404).json({ message: 'Submission not found' });
    }
  });

  app.post('/api/submissions', authenticate, async (req: any, res) => {
    try {
      const submission = new Submission({ ...req.body, userId: req.user._id });
      await submission.save();
      res.status(201).json(submission);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/submissions/:id', authenticate, async (req, res) => {
    try {
      const submission = await Submission.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(submission);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // --- USER MANAGEMENT ---
  app.get('/api/users', authenticate, isAdmin, async (req, res) => {
    try {
      const users = await User.find();
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/users/:id', authenticate, isAdmin, async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Vite Middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
