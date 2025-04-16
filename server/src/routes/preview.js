const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');

// Track build processes
const buildProcesses = new Map();

const WORKSPACES_DIR = path.join(__dirname, '../../workspaces');

// Middleware to validate workspace ID
const validateWorkspace = async (req, res, next) => {
  try {
    // Accept workspace ID from either headers or query parameters
    const workspaceId = req.headers['workspace-id'] || req.query['workspace-id'];
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

// Generate preview by building the project
router.post('/build', async (req, res) => {
  try {
    const workspaceId = req.headers['workspace-id'];
    
    // Check if a build is already in progress for this workspace
    if (buildProcesses.has(workspaceId)) {
      return res.status(409).json({
        success: false,
        message: 'Build already in progress for this workspace',
        status: 'in_progress'
      });
    }
    
    // Create tracking object
    const buildInfo = {
      status: 'starting',
      logs: [],
      startTime: Date.now(),
      endTime: null,
      error: null
    };
    
    buildProcesses.set(workspaceId, buildInfo);
    
    // Respond immediately that the build has started
    res.status(202).json({
      success: true,
      message: 'Build process started',
      status: 'started'
    });
    
    // Run the build process asynchronously
    try {
      buildInfo.status = 'in_progress';
      
      // Run the ceos-ard build command in the workspace
      const buildCmd = spawn('ceos-ard', ['generate-all', '-o', 'build', '--pdf'], { 
        cwd: req.workspacePath,
        shell: true
      });
      
      // Collect output
      buildCmd.stdout.on('data', (data) => {
        const logLine = data.toString();
        buildInfo.logs.push({ type: 'stdout', text: logLine });
      });
      
      buildCmd.stderr.on('data', (data) => {
        const logLine = data.toString();
        buildInfo.logs.push({ type: 'stderr', text: logLine });
      });
      
      // Handle process completion
      buildCmd.on('close', (code) => {
        buildInfo.endTime = Date.now();
        if (code === 0) {
          buildInfo.status = 'completed';
        } else {
          buildInfo.status = 'failed';
          buildInfo.error = `Process exited with code ${code}`;
        }
        
        // Automatically remove from tracking after 10 minutes
        setTimeout(() => {
          buildProcesses.delete(workspaceId);
        }, 10 * 60 * 1000);
      });
      
      buildCmd.on('error', (err) => {
        buildInfo.status = 'failed';
        buildInfo.error = err.message;
        buildInfo.endTime = Date.now();
      });
      
    } catch (buildError) {
      buildInfo.status = 'failed';
      buildInfo.error = buildError.message;
      buildInfo.endTime = Date.now();
    }
    
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
    const workspaceId = req.headers['workspace-id'];
    
    if (!buildProcesses.has(workspaceId)) {
      return res.status(404).json({
        success: false,
        message: 'No build process found for this workspace',
        status: 'not_found'
      });
    }
    
    const buildInfo = buildProcesses.get(workspaceId);
    
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
        name: file,
        path: `build/${file}`
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
    const { filename } = req.params;
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
    const content = await fs.readFile(filePath, 'utf-8');
    
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
    const requestPath = req.params.path;
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
    
    // Send file
    return res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving static file:', error);
    return res.status(500).send('Error serving file');
  }
});

module.exports = router;