const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs-extra');

// Import routes
const workspaceRoutes = require('./routes/workspace');
const fileRoutes = require('./routes/file');
const previewRoutes = require('./routes/preview');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max file size
}));

// Routes
app.use('/api/workspace', workspaceRoutes);
app.use('/api/file', fileRoutes);
app.use('/api/preview', previewRoutes);

// Create workspaces directory if it doesn't exist
const workspacesDir = path.join(__dirname, '../workspaces');
fs.ensureDirSync(workspacesDir);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});