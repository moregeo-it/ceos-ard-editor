const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');
const simpleGit = require('simple-git');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const axios = require('axios');
const Datastore = require('@seald-io/nedb');
const { startBuild } = require('../utils/build');

// GitHub API configuration
const DEFAULT_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'ceos-org';
const DEFAULT_REPO_NAME = process.env.GITHUB_REPO_NAME || 'ceos-ard';

// Base directory for workspaces
const WORKSPACES_DIR = path.join(__dirname, '../../workspaces');
const DB_DIR = path.join(__dirname, '../../database');
const REPO_URL = `https://github.com/${DEFAULT_REPO_OWNER}/${DEFAULT_REPO_NAME}`;

// Ensure the database directory exists
fs.ensureDirSync(DB_DIR);

// Set up the workspaces database
const workspacesDB = new Datastore({
  filename: path.join(DB_DIR, 'workspaces.db'),
  autoload: true
});

// Create indexes to improve query performance
workspacesDB.ensureIndex({ fieldName: 'id', unique: true });
workspacesDB.ensureIndex({ fieldName: 'userId' });

// Make sure all paths use forward slashes
function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

// Get all workspaces for the current user
router.get('/', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  try {
    const userWorkspaces = await new Promise((resolve, reject) => {
      workspacesDB.find({ userId: req.user.id }, (err, workspaces) => {
        if (err) {
          reject(err);
        } else {
          resolve(workspaces);
        }
      });
    });
    
    return res.status(200).json({
      success: true,
      workspaces: userWorkspaces
    });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch workspaces',
      error: error.message
    });
  }
});

// Create a new workspace
router.post('/create', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { title = 'Untitled Workspace', defaultPfs = '' } = req.body;
    const userId = req.user.id;
    const username = req.user.username;
    const accessToken = req.session.githubToken;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'GitHub access token not found in session. Please log in again.'
      });
    }

    // Generate unique workspace ID
    const workspaceId = uuidv4();
    const workspacePath = path.join(WORKSPACES_DIR, workspaceId);
    
    // Create workspace directory
    await fs.ensureDir(workspacePath);

    // Check if user already has a fork of the repository
    let userRepoUrl;
    let branchName = `edits/${uuidv4()}`;

    try {
      // Check if fork already exists
      const checkForkResponse = await axios.get(
        `https://api.github.com/repos/${username}/${DEFAULT_REPO_NAME}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          validateStatus: (status) => status < 500 // Accept 404 as valid response
        }
      );

      if (checkForkResponse.status === 200) {
        // Fork exists, use it
        userRepoUrl = `https://oauth2:${accessToken}@github.com/${username}/${DEFAULT_REPO_NAME}.git`;
      } else if (checkForkResponse.status === 404) {
        // Fork doesn't exist, create it
        console.log(`Creating new fork for user ${username}`);
        const forkResponse = await axios.post(
          `https://api.github.com/repos/${DEFAULT_REPO_OWNER}/${DEFAULT_REPO_NAME}/forks`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );
        
        if (forkResponse.status === 202) {
          userRepoUrl = `https://oauth2:${accessToken}@github.com/${username}/${DEFAULT_REPO_NAME}.git`;
          // Wait a few seconds for GitHub to complete the fork
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          throw new Error(`Failed to fork repository: ${forkResponse.statusText}`);
        }
      }
    } catch (forkError) {
      console.error('Error checking/creating fork:', forkError);
      // Fall back to the default repository if fork creation fails
      userRepoUrl = REPO_URL;
    }
    
    // Create a temporary credentials helper script for Git authentication
    const tmpDir = path.join(WORKSPACES_DIR, '.tmp');
    await fs.ensureDir(tmpDir);
    const credentialHelperPath = path.join(tmpDir, `cred-helper-${workspaceId}.js`);
    const credentialHelperContent = `
#!/usr/bin/env node
console.log('username=oauth2');
console.log('password=${accessToken}');
process.exit(0);
    `.trim();
    
    await fs.writeFile(credentialHelperPath, credentialHelperContent);
    await fs.chmod(credentialHelperPath, '755'); // Make executable
    
    // Configure git to use the credential helper
    const git = simpleGit();
    await git.env('GIT_TERMINAL_PROMPT', '0'); // Disable interactive prompt
    await git.addConfig('credential.helper', `"${credentialHelperPath.replace(/\\/g, '/')}"`, false);
    
    // Clone repository into workspace
    await git.clone(userRepoUrl, workspacePath);
    
    // Set up git config in the workspace
    const workspaceGit = simpleGit(workspacePath);
    await workspaceGit.addConfig('user.name', req.user.displayName || req.user.username);
    await workspaceGit.addConfig('user.email', req.user.emails?.[0]?.value || `${req.user.username}@users.noreply.github.com`);
    await workspaceGit.addConfig('credential.helper', `"${credentialHelperPath.replace(/\\/g, '/')}"`, false);
    
    // Create and checkout a new branch that's synced with upstream main
    try {
      // Add upstream remote if we're using a fork
      if (userRepoUrl !== REPO_URL) {
        await workspaceGit.addRemote('upstream', REPO_URL);
        
        // Fetch from upstream
        await workspaceGit.fetch('upstream', 'main');
        
        // Create new branch from upstream/main
        await workspaceGit.checkout(['-b', branchName, 'upstream/main']);
      } else {
        // If we're not using a fork, just create a branch from the local main
        await workspaceGit.checkout(['-b', branchName]);
      }
    } catch (branchError) {
      console.error('Error setting up branch:', branchError);
    }
    
    // Clean up credential helper file after clone is complete
    try {
      await fs.remove(credentialHelperPath);
    } catch (cleanupError) {
      console.warn('Warning: Unable to remove credential helper file:', cleanupError);
    }

    // Create workspace metadata
    const workspace = {
      id: workspaceId,
      title,
      userId,
      username,
      defaultPfs,
      createdAt: new Date().toISOString(),
      branchName,
      repoUrl: userRepoUrl.replace(/https:\/\/oauth2:.*?@github\.com/, 'https://github.com') // Remove token from URL
    };
    
    // Save workspace to database
    await new Promise((resolve, reject) => {
      workspacesDB.insert(workspace, (err, newWorkspace) => {
        if (err) {
          reject(err);
        } else {
          resolve(newWorkspace);
        }
      });
    });
    
    // Return workspace data immediately - don't wait for build
    const response = {
      success: true,
      workspace,
      message: 'Workspace created successfully'
    };
    
    res.status(201).json(response);
    
    // Automatically start the build process after response is sent
    // This is safely outside of the response cycle
    setTimeout(() => {
      try {
        console.log(`Starting automated build for workspace ${workspaceId}`);
        // Start a build for the specific PFS if one is provided, or build all if not
        startBuild(workspacePath, workspaceId);
        
        // Add metadata to track that build was initiated automatically
        workspace.buildInitiated = true;
        workspacesDB.update({ id: workspaceId }, { $set: { buildInitiated: true } });
        
      } catch (buildError) {
        // Log the error but the workspace is already created successfully
        console.error(`Automatic build initiation failed for workspace ${workspaceId}:`, buildError);
      }
    }, 100); // Small delay to ensure response is sent first
    
  } catch (error) {
    console.error('Error creating workspace:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create workspace',
      error: error.message
    });
  }
});

// Get workspace details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Find workspace in the database
    const workspace = await new Promise((resolve, reject) => {
      workspacesDB.findOne({ id, userId: req.user.id }, (err, workspace) => {
        if (err) {
          reject(err);
        } else {
          resolve(workspace);
        }
      });
    });
    
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found or not authorized'
      });
    }
    
    const workspacePath = path.join(WORKSPACES_DIR, id);
    
    // Check if workspace directory exists
    if (!await fs.pathExists(workspacePath)) {
      return res.status(404).json({
        success: false,
        message: 'Workspace directory not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      workspace
    });
  } catch (error) {
    console.error('Error getting workspace:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get workspace',
      error: error.message
    });
  }
});

// Close/delete a workspace
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Find and remove workspace from the database
    const numRemoved = await new Promise((resolve, reject) => {
      workspacesDB.remove({ id, userId: req.user.id }, {}, (err, numRemoved) => {
        if (err) {
          reject(err);
        } else {
          resolve(numRemoved);
        }
      });
    });
    
    if (numRemoved === 0) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found or not authorized'
      });
    }
    
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

// Update workspace title
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Find and update workspace in the database
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required for update'
      });
    }
    
    const numUpdated = await new Promise((resolve, reject) => {
      workspacesDB.update(
        { id, userId: req.user.id }, 
        { $set: { title } },
        {},
        (err, numUpdated) => {
          if (err) {
            reject(err);
          } else {
            resolve(numUpdated);
          }
        }
      );
    });
    
    if (numUpdated === 0) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found or not authorized'
      });
    }
    
    // Get the updated workspace
    const workspace = await new Promise((resolve, reject) => {
      workspacesDB.findOne({ id, userId: req.user.id }, (err, workspace) => {
        if (err) {
          reject(err);
        } else {
          resolve(workspace);
        }
      });
    });
    
    return res.status(200).json({
      success: true,
      workspace,
      message: 'Workspace updated successfully'
    });
  } catch (error) {
    console.error('Error updating workspace:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update workspace',
      error: error.message
    });
  }
});

// Get workspace status (git status)
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const workspace = await new Promise((resolve, reject) => {
      workspacesDB.findOne({ id, userId: req.user.id }, (err, workspace) => {
        if (err) {
          reject(err);
        } else {
          resolve(workspace);
        }
      });
    });
    
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found or not authorized'
      });
    }
    
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
    const gitStatus = await git.status();
    
    // Create a simplified array of file status objects
    const files = [];
    
    // Process modified files
    if (gitStatus.modified && gitStatus.modified.length > 0) {
      gitStatus.modified.forEach(file => {
        files.push({
          path: normalizePath(file),
          status: 'modified'
        });
      });
    }
    
    // Process created/new files
    if (gitStatus.created && gitStatus.created.length > 0) {
      gitStatus.created.forEach(file => {
        files.push({
          path: normalizePath(file),
          status: 'added'
        });
      });
    }
    
    // Process not_added files (untracked)
    if (gitStatus.not_added && gitStatus.not_added.length > 0) {
      gitStatus.not_added.forEach(file => {
        files.push({
          path: normalizePath(file),
          status: 'added'
        });
      });
    }
    
    // Process deleted files
    if (gitStatus.deleted && gitStatus.deleted.length > 0) {
      gitStatus.deleted.forEach(file => {
        files.push({
          path: normalizePath(file),
          status: 'deleted'
        });
      });
    }
    
    // Process renamed files
    if (gitStatus.renamed && gitStatus.renamed.length > 0) {
      gitStatus.renamed.forEach(item => {
        files.push({
          path: normalizePath(item.to),
          originalPath: normalizePath(item.from),
          status: 'renamed'
        });
      });
    }
    
    return res.status(200).json({
      success: true,
      files,
      branchName: workspace.branchName
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

// POST /api/workspace/:id/propose - Commit changes and create a PR
router.post('/:id/propose', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const workspace = await new Promise((resolve, reject) => {
      workspacesDB.findOne({ id, userId: req.user.id }, (err, workspace) => {
        if (err) {
          reject(err);
        } else {
          resolve(workspace);
        }
      });
    });
    
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found or not authorized'
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    const workspacePath = path.join(WORKSPACES_DIR, id);
    
    if (!fs.existsSync(workspacePath)) {
      return res.status(404).json({
        success: false,
        message: 'Workspace directory not found'
      });
    }

    const accessToken = req.session.githubToken;
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'GitHub access token not found in session. Please log in again.'
      });
    }

    try {
      // Use simpleGit for all git operations to ensure consistency
      const git = simpleGit(workspacePath);
      
      // Check git status
      const status = await git.status();
      if (!status.files.length) {
        return res.status(400).json({
          success: false,
          message: 'No changes to propose'
        });
      }

      // Add all files
      await git.add('.');

      // Commit changes
      await git.commit(title);
      
      // Get current branch name if not already stored
      const branchName = workspace.branchName || (await git.branch()).current;
      
      // Set up git credentials for push
      // Configure a custom credential helper to avoid prompt
      const credentialHelperPath = path.join(workspacePath, '.git-credentials-helper.js');
      const credentialHelperContent = `
#!/usr/bin/env node
console.log('username=oauth2');
console.log('password=${accessToken}');
process.exit(0);
      `.trim();
      
      await fs.writeFile(credentialHelperPath, credentialHelperContent);
      await fs.chmod(credentialHelperPath, '755'); // Make executable
      
      // Set git configurations for the repository
      await git.addConfig('credential.helper', `"${credentialHelperPath.replace(/\\/g, '/')}"`, false, 'local');
      
      // Add remote URL with token in case it wasn't set properly before
      const remoteUrl = `https://oauth2:${accessToken}@github.com/${workspace.username}/${DEFAULT_REPO_NAME}.git`;
      try {
        // Try to update existing remote first
        await git.remote(['set-url', 'origin', remoteUrl]);
      } catch (remoteError) {
        // If remote doesn't exist, add it
        await git.remote(['add', 'origin', remoteUrl]);
      }
      
      // Push to remote
      try {
        await git.push(['--set-upstream', 'origin', branchName]);
        console.log('Successfully pushed to remote');
      } catch (pushError) {
        console.error('Push error details:', pushError);
        
        // Clean up credential helper file
        await fs.remove(credentialHelperPath);
        
        return res.status(500).json({
          success: false,
          message: `Failed to push to remote repository: ${pushError.message}`
        });
      }

      // Clean up credential helper file
      await fs.remove(credentialHelperPath);

      // Create pull request using GitHub API
      let pullRequestUrl = '';
      try {
        // Extract repository owner and name
        const username = workspace.username;
        const repoName = DEFAULT_REPO_NAME;
        
        // Create the pull request to the upstream repo
        const response = await axios.post(
          `https://api.github.com/repos/${DEFAULT_REPO_OWNER}/${DEFAULT_REPO_NAME}/pulls`,
          {
            title: title,
            body: description || '',
            head: `${username}:${branchName}`,
            base: 'main'  // Target branch in upstream repo
          },
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );
        
        pullRequestUrl = response.data.html_url;
      } catch (prError) {
        console.error('Failed to create pull request:', prError);
        // Continue without failing - we'll still return success for the push
      }

      // Return successful response with PR URL if available
      if (pullRequestUrl) {
        return res.json({
          success: true,
          message: 'Changes proposed and pull request created successfully',
          branchName: workspace.branchName,
          pullRequestUrl: pullRequestUrl,
          automaticPr: true
        });
      } else {
        return res.json({
          success: true,
          message: 'Changes proposed successfully',
          branchName: workspace.branchName,
          automaticPr: false,
          instructions: 'Your changes have been pushed to the remote repository. To complete the process, please create a pull request manually from your Git hosting service.'
        });
      }
    } catch (gitError) {
      console.error('Git operation failed:', gitError);
      return res.status(500).json({
        success: false, 
        message: `Git operation failed: ${gitError.message}`
      });
    }
  } catch (error) {
    console.error('Error proposing changes:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to propose changes',
      error: error.message
    });
  }
});

module.exports = router;