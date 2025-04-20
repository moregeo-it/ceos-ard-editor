const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const { startBuild, getBuildStatus } = require('../utils/build');
const { sanitizePath, sanitizeString, sanitizeWorkspaceId } = require('../utils/sanitize');

const WORKSPACES_DIR = path.join(__dirname, '../../workspaces');

// Make sure all paths use forward slashes
function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

// Middleware to validate workspace ID
const validateWorkspace = async (req, res, next) => {
  try {
    // Accept workspace ID from either headers or query parameters
    const workspaceId = sanitizeWorkspaceId(req.headers['workspace-id'] || req.query['workspace-id']);
    if (!workspaceId) {
      return res.status(401).json({
        success: false,
        message: 'Workspace ID not provided'
      });
    }

    const workspacePath = path.join(WORKSPACES_DIR, workspaceId);
    if (!await fs.pathExists(workspacePath)) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    req.workspacePath = workspacePath;
    req.workspaceId = workspaceId;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error validating workspace',
      error: error.message
    });
  }
};

// Apply middleware to all routes
router.use(validateWorkspace);

// Unified build endpoint that handles both all files and specific PFS builds
router.post('/build', async (req, res) => {
  try {
    const pfs = sanitizeString(req.query.pfs); // Optional PFS parameter
    
    // Start build using the shared utility
    startBuild(req.workspacePath, req.workspaceId, pfs);
    
    // Respond immediately that the build has started
    res.status(202).json({
      success: true,
      message: pfs ? `Build process started for ${pfs}` : 'Build process started for all previews',
      status: 'started'
    });
    
  } catch (error) {
    console.error('Error starting build process:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start build process: ' + error.message
    });
  }
});

// Get build status
router.get('/build-status', async (req, res) => {
  try {
    const buildInfo = getBuildStatus(req.workspaceId);
    
    if (!buildInfo) {
      return res.status(200).json({
        success: false,
        message: 'No build process found for this workspace',
      });
    }
    
    return res.status(200).json({
      success: true,
      status: buildInfo.status,
      logs: buildInfo.logs,
      startTime: buildInfo.startTime,
      endTime: buildInfo.endTime,
      error: buildInfo.error
    });
  } catch (error) {
    console.error('Error getting build status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get build status',
      error: error.message
    });
  }
});

// List available preview files
router.get('/list', async (req, res) => {
  try {
    const buildDir = path.join(req.workspacePath, 'build');
    
    // Check if build directory exists
    if (!await fs.pathExists(buildDir)) {
      return res.status(404).json({
        success: false,
        message: 'Build directory not found. Please build the project first.'
      });
    }
    
    // Get list of HTML files in the build directory
    const files = await fs.readdir(buildDir);
    const htmlFiles = files
      .filter(file => file.endsWith('.html'))
      .map(file => ({
        name: sanitizeString(file),
        path: sanitizePath(`build/${file}`)
      }));
    
    return res.status(200).json({
      success: true,
      previewFiles: htmlFiles
    });
  } catch (error) {
    console.error('Error listing preview files:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to list preview files',
      error: error.message
    });
  }
});

// Get specific preview file content
router.get('/content/:filename', async (req, res) => {
  try {
    const filename = sanitizeString(req.params.filename);
    const filePath = path.join(req.workspacePath, 'build', filename);
    
    // Check if file exists and is within the workspace/build directory
    if (!await fs.pathExists(filePath) || 
        !filePath.startsWith(path.join(req.workspacePath, 'build')) || 
        !filename.endsWith('.html')) {
      return res.status(404).json({
        success: false,
        message: 'Preview file not found or invalid path'
      });
    }
    
    // Read preview file content
    let content = await fs.readFile(filePath, 'utf-8');

    // Replace edit placeholders
    content = content.replace(
      /<!--\s*edit:\s*([\w\-\.\~\/\\]+)\s*-->/g,
      (match, p1) => `<a name="${normalizePath(sanitizePath(p1))}"></a><button class="edit" value="${normalizePath(sanitizePath(p1))}">Edit</button>`
    );
    
    return res.status(200).json({
      success: true,
      content,
      filename
    });
  } catch (error) {
    console.error('Error getting preview content:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get preview content',
      error: error.message
    });
  }
});

// Serve static preview files (for images, styles, etc.)
router.get('/static/:path(*)', async (req, res) => {
  try {
    const requestPath = sanitizePath(req.params.path);
    const basePath = path.resolve(path.join(req.workspacePath, 'build'));
    const filePath = path.join(basePath, requestPath);

    // Check if file is within the workspace/build directory
    if (!filePath.startsWith(basePath)) {
      return res.status(400).send('Invalid file path');
    }
    // Check if file exists
    if (!await fs.pathExists(filePath)) {
      return res.status(404).send('File not found');
    }
    
    // Set Cross-Origin headers to allow resources to be displayed in iframe
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send file
    return res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving static file:', error);
    return res.status(500).send('Error serving file');
  }
});

module.exports = router;