const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');
const simpleGit = require('simple-git');
const { execSync } = require('child_process');

// Base directory for workspaces
const WORKSPACES_DIR = path.join(__dirname, '../../workspaces');
const REPO_URL = 'https://github.com/ceos-org/ceos-ard';

// Create a new workspace
router.post('/create', async (req, res) => {
  try {
    // Generate unique workspace ID
    const workspaceId = uuidv4();
    const workspacePath = path.join(WORKSPACES_DIR, workspaceId);
    
    // Create workspace directory
    await fs.ensureDir(workspacePath);
    
    // Clone repository into workspace
    const git = simpleGit();
    await git.clone(REPO_URL, workspacePath);
    
    // Set up git config in the workspace to avoid warnings
    const workspaceGit = simpleGit(workspacePath);
    await workspaceGit.addConfig('user.name', 'CEOS-ARD Editor User');
    await workspaceGit.addConfig('user.email', 'ceos-ard-editor@example.com');
    
    // Return workspace ID as token
    return res.status(201).json({
      success: true,
      workspaceId,
      message: 'Workspace created successfully'
    });
  } catch (error) {
    console.error('Error creating workspace:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create workspace',
      error: error.message
    });
  }
});

// Close/delete a workspace
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const workspacePath = path.join(WORKSPACES_DIR, id);
    
    // Check if workspace exists
    if (await fs.pathExists(workspacePath)) {
    // Remove workspace directory
      await fs.remove(workspacePath);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Workspace closed successfully'
    });
  } catch (error) {
    console.error('Error closing workspace:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to close workspace',
      error: error.message
    });
  }
});

// Get workspace status (git status)
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const workspacePath = path.join(WORKSPACES_DIR, id);
    
    // Check if workspace exists
    if (!await fs.pathExists(workspacePath)) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }
    
    // Get git status
    const git = simpleGit(workspacePath);
    const status = await git.status();
    
    return res.status(200).json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error getting workspace status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get workspace status',
      error: error.message
    });
  }
});

module.exports = router;