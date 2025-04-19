const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs-extra');
const session = require('express-session');
const passport = require('./config/passport');

// Load environment variables
require('dotenv').config();

// Import routes
const workspaceRoutes = require('./routes/workspace');
const fileRoutes = require('./routes/file');
const previewRoutes = require('./routes/preview');
const authRoutes = require('./routes/auth');

// Import middleware
const { ensureAuthenticated } = require('./middleware/auth');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5174',
  credentials: true
}));
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE) || 50) * 1024 * 1024 } // Default: 50MB
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));

// Initialize Passport and session
app.use(passport.initialize());
app.use(passport.session());

// Public routes (no auth required)
app.use('/api/auth', authRoutes);

// Protected routes (auth required)
app.use('/api/workspace', ensureAuthenticated, workspaceRoutes);
app.use('/api/file', ensureAuthenticated, fileRoutes);
app.use('/api/preview', ensureAuthenticated, previewRoutes);

// Create workspaces directory if it doesn't exist
const workspacesDir = path.join(__dirname, '../workspaces');
fs.ensureDirSync(workspacesDir);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});