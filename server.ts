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

// --- MOCK DATA FOR OFFLINE / BYPASS PREVIEW MODE ---
const MOCK_ASSESSMENTS = [
  {
    _id: 'mock-assessment-1',
    id: 'mock-assessment-1',
    title: 'Psychological Test Battery - Mock Series 1',
    description: 'A comprehensive timed evaluation of psychological profiles, comprising TAT, WAT, and SRT.',
    duration: 30,
    slidesCount: 3
  },
  {
    _id: 'mock-assessment-2',
    id: 'mock-assessment-2',
    title: 'TAT (Thematic Apperception Test) Practice',
    description: 'Practice series containing high-resolution thematic slides with a 30-second viewing timer.',
    duration: 15,
    slidesCount: 2
  }
];

const MOCK_SLIDES: Record<string, any[]> = {
  'mock-assessment-1': [
    { _id: 'slide-1-1', id: 'slide-1-1', assessmentId: 'mock-assessment-1', imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb', order: 1, duration: 10 },
    { _id: 'slide-1-2', id: 'slide-1-2', assessmentId: 'mock-assessment-1', imageUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05', order: 2, duration: 10 },
    { _id: 'slide-1-3', id: 'slide-1-3', assessmentId: 'mock-assessment-1', imageUrl: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d', order: 3, duration: 10 }
  ],
  'mock-assessment-2': [
    { _id: 'slide-2-1', id: 'slide-2-1', assessmentId: 'mock-assessment-2', imageUrl: 'https://images.unsplash.com/photo-1472214222541-d510753a4907', order: 1, duration: 15 },
    { _id: 'slide-2-2', id: 'slide-2-2', assessmentId: 'mock-assessment-2', imageUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e', order: 2, duration: 15 }
  ]
};

const mockSubmissions: any[] = [];

// Authentication Middleware
const authenticate = async (req: any, res: any, next: any) => {
  const isBypass = process.env.BYPASS_AUTH === 'true' || mongoose.connection.readyState !== 1;

  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers.token) {
    token = req.headers.token;
  }

  if (isBypass) {
    let mockUser = {
      _id: 'mock-user-123456789012',
      id: 'mock-user-123456789012',
      name: 'Preview Student',
      email: 'student@ssb.com',
      role: 'student'
    };

    if (token) {
      try {
        const decoded = jwt.verify(token.trim(), JWT_SECRET) as any;
        if (decoded.role === 'admin') {
          mockUser = {
            _id: 'mock-admin-123456789012',
            id: 'mock-admin-123456789012',
            name: 'Preview Admin',
            email: 'admin@ssb.com',
            role: 'admin'
          };
        } else if (decoded.role === 'assessor') {
          mockUser = {
            _id: 'mock-assessor-123456789012',
            id: 'mock-assessor-123456789012',
            name: 'Preview Assessor',
            email: 'assessor@ssb.com',
            role: 'assessor'
          };
        }
      } catch (e) {
        // Continue with default mock student if token verify fails
      }
    }
    
    req.user = mockUser;
    return next();
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
    const isBypass = process.env.BYPASS_AUTH === 'true' || mongoose.connection.readyState !== 1;
    if (isBypass) {
      const { email } = req.body;
      const lowercaseEmail = (email || '').toLowerCase();
      const role = lowercaseEmail.includes('admin') ? 'admin' : (lowercaseEmail.includes('assessor') ? 'assessor' : 'student');
      
      const mockUser = {
        _id: `mock-${role}-123456789012`,
        id: `mock-${role}-123456789012`,
        name: `Preview ${role.charAt(0).toUpperCase() + role.slice(1)}`,
        email: lowercaseEmail || `${role}@ssb.com`,
        role: role
      };

      const token = jwt.sign({ id: mockUser._id, role }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ user: mockUser, token });
    }

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
    const isBypass = process.env.BYPASS_AUTH === 'true' || mongoose.connection.readyState !== 1;
    if (isBypass) {
      return res.json(MOCK_ASSESSMENTS);
    }

    try {
      const assessments = await Assessment.find();
      res.json(assessments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/assessments/:id', authenticate, async (req, res) => {
    const isBypass = process.env.BYPASS_AUTH === 'true' || mongoose.connection.readyState !== 1;
    if (isBypass) {
      const assessment = MOCK_ASSESSMENTS.find(a => a._id === req.params.id);
      if (!assessment) return res.status(404).json({ message: 'Not found' });
      return res.json(assessment);
    }

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
    const isBypass = process.env.BYPASS_AUTH === 'true' || mongoose.connection.readyState !== 1;
    if (isBypass) {
      const slides = MOCK_SLIDES[req.params.id] || [];
      return res.json(slides);
    }

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
    const isBypass = process.env.BYPASS_AUTH === 'true' || mongoose.connection.readyState !== 1;
    if (isBypass) {
      let filtered = mockSubmissions;
      if (req.user.role === 'student') {
        filtered = mockSubmissions.filter(s => s.userId === req.user._id);
      } else if (req.user.role === 'assessor') {
        filtered = mockSubmissions.filter(s => s.assessorId === req.user._id);
      }
      return res.json(filtered);
    }

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
    const isBypass = process.env.BYPASS_AUTH === 'true' || mongoose.connection.readyState !== 1;
    if (isBypass) {
      const submission = mockSubmissions.find(s => s._id === req.params.id);
      if (!submission) return res.status(404).json({ message: 'Submission not found' });
      return res.json(submission);
    }

    try {
      const submission = await Submission.findById(req.params.id).populate('userId', 'name email').populate('assessmentId', 'title');
      res.json(submission);
    } catch (error: any) {
      res.status(404).json({ message: 'Submission not found' });
    }
  });

  app.post('/api/submissions', authenticate, async (req: any, res) => {
    const isBypass = process.env.BYPASS_AUTH === 'true' || mongoose.connection.readyState !== 1;
    if (isBypass) {
      const newSub = {
        ...req.body,
        _id: `mock-sub-${Date.now()}`,
        id: `mock-sub-${Date.now()}`,
        userId: req.user._id,
        user: { name: req.user.name, email: req.user.email },
        assessment: MOCK_ASSESSMENTS.find(a => a._id === req.body.assessmentId) || { title: 'Psychology Test Battery' },
        createdAt: new Date().toISOString()
      };
      mockSubmissions.push(newSub);
      return res.status(201).json(newSub);
    }

    try {
      const submission = new Submission({ ...req.body, userId: req.user._id });
      await submission.save();
      res.status(201).json(submission);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put('/api/submissions/:id', authenticate, async (req, res) => {
    const isBypass = process.env.BYPASS_AUTH === 'true' || mongoose.connection.readyState !== 1;
    if (isBypass) {
      const idx = mockSubmissions.findIndex(s => s._id === req.params.id);
      if (idx !== -1) {
        mockSubmissions[idx] = { ...mockSubmissions[idx], ...req.body };
        return res.json(mockSubmissions[idx]);
      }
      return res.status(404).json({ message: 'Submission not found' });
    }

    try {
      const submission = await Submission.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(submission);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // --- USER MANAGEMENT ---
  app.get('/api/users', authenticate, isAdmin, async (req, res) => {
    const isBypass = process.env.BYPASS_AUTH === 'true' || mongoose.connection.readyState !== 1;
    if (isBypass) {
      return res.json([
        { _id: 'mock-user-123456789012', name: 'Preview Student', email: 'student@ssb.com', role: 'student' },
        { _id: 'mock-assessor-123456789012', name: 'Preview Assessor', email: 'assessor@ssb.com', role: 'assessor' },
        { _id: 'mock-admin-123456789012', name: 'Preview Admin', email: 'admin@ssb.com', role: 'admin' }
      ]);
    }

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

  // Serve uploaded images/slides static directory
  app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));

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
