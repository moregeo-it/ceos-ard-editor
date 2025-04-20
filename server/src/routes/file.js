const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const axios = require('axios');

const WORKSPACES_DIR = path.join(__dirname, '../../workspaces');

// Make sure all paths use forward slashes
function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

// Place any routes that don't require workspace validation before the middleware

// List all available PFS folders (fetched directly from GitHub)
router.get('/list-pfs', async (req, res) => {
  try {
    const { owner = process.env.GITHUB_REPO_OWNER || 'ceos-org', repo = process.env.GITHUB_REPO_NAME || 'ceos-ard', branch = 'main' } = req.query;
    
    // Use GitHub API to get contents of the pfs directory
    const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/pfs?ref=${branch}`;
    
    // Make request to GitHub API
    const response = await axios.get(githubApiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CEOS-ARD-Editor'
      }
    });
    
    // Filter the response to only get directories
    const pfsFolders = response.data
      .filter(item => item.type === 'dir')
      .map(item => item.name)
      .filter(name => !name.startsWith('.'));  // Filter out hidden folders
    
    return res.status(200).json({
      success: true,
      pfsFolders
    });
  } catch (error) {
    console.error('Error fetching PFS folders from GitHub:', error);
    return res.status(500).json({
      success: false, 
      message: 'Failed to fetch PFS folders from GitHub',
      error: error.message
    });
  }
});

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

// List files in a directory
router.get('/list', async (req, res) => {
  try {
    const { dir = '' } = req.query;
    const dirPath = path.join(req.workspacePath, dir);

    // Check if directory exists and is within the workspace
    if (!await fs.pathExists(dirPath) || !dirPath.startsWith(req.workspacePath)) {
      return res.status(404).json({
        success: false,
        message: 'Directory not found or invalid path'
      });
    }

    // Get directory contents
    const items = await fs.readdir(dirPath);
    
    // Get git status
    const gitCmd = 'git status --porcelain';
    let { stdout } = await execPromise(gitCmd, { cwd: req.workspacePath });
    
    // Parse git status output
    const changedFiles = {};
    const deletedFiles = [];
    
    // Parse git status output
    stdout.split('\n')
      .filter(line => line.trim() !== '')
      .forEach(line => {
        // Git status format is "XY filename"
        // where X is staging status and Y is working tree status
        let status = line.substring(0, 2).trim();
        if (status == '??') {
          status = 'A';
        }
        const filePath = normalizePath(line.substring(3));
        
        // Store the file's git status
        changedFiles[filePath] = status;
        
        // Track deleted files to make sure they show up in the file list
        if (status.startsWith('D') || status.includes('D')) {
          deletedFiles.push(filePath);
        }
      });

    // Get the list of files in the current directory
    const fileList = await Promise.all(items
      // Filter out dot files and build folder at the top level
      .filter(item => {
        // Hide files/folders starting with a dot
        if (item.startsWith('.')) return false;
        // Hide PDF files, we can't edit them
        if (item.endsWith('.pdf')) return false;
        
        // Hide build folder only at the top level
        if (['templates', 'build', 'LICENSE'].includes(item) && dir === '') return false;
        
        return true;
      })
      .map(async (item) => {
        const itemPath = path.join(dirPath, item);
        const relativePath = path.relative(req.workspacePath, itemPath);
        const stats = await fs.stat(itemPath);
        return {
          name: item,
          path: normalizePath(relativePath),
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modifiedTime: stats.mtime,
          // Add git status information if file is changed
          gitStatus: changedFiles[relativePath] || null
        };
      }));

    // Add deleted files that belong in this directory
    if (dir) {
      // For subdirectories, only include deleted files within this directory
      const dirPrefix = dir.endsWith('/') ? dir : dir + '/';
      
      deletedFiles.forEach(filePath => {
        // Filter deleted files to only those that belong in this directory
        if (filePath.startsWith(dirPrefix)) {
          const fileName = path.basename(filePath);
          const relativePath = filePath;
          
          // Don't add if the file is already in the list (shouldn't happen for deleted files)
          if (!fileList.some(file => file.path === relativePath)) {
            fileList.push({
              name: fileName,
              path: relativePath,
              isDirectory: false, // Deleted directories are more complex, mark them as files for now
              size: 0,
              modifiedTime: new Date(),
              gitStatus: changedFiles[relativePath],
              isDeleted: true
            });
          }
        }
      });
    } else {
      // For the root directory, include deleted files that are directly in the root
      deletedFiles.forEach(filePath => {
        // Check if this file is directly in the root (no directory separators)
        if (!filePath.includes('/')) {
          // Don't add if the file is already in the list
          if (!fileList.some(file => file.path === filePath)) {
            fileList.push({
              name: filePath,
              path: filePath,
              isDirectory: false,
              size: 0,
              modifiedTime: new Date(),
              gitStatus: changedFiles[filePath],
              isDeleted: true
            });
          }
        }
      });
    }

    return res.status(200).json({
      success: true,
      files: fileList,
      changedFiles
    });
  } catch (error) {
    console.error('Error listing files:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to list files',
      error: error.message
    });
  }
});

// Search files (both filenames and content)
router.get('/search', async (req, res) => {
  try {
    const { query = '' } = req.query;
    
    if (!query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Results array
    const results = [];
    const maxResults = 100; // Limit number of results to prevent overload
    let resultCount = 0;

    // Function to search a file/directory recursively
    const searchRecursively = async (dirPath, relativePath = '') => {
      if (resultCount >= maxResults) return;

      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        if (resultCount >= maxResults) break;

        // Skip hidden files and specified directories at root level
        if (item.startsWith('.')) continue;
        if (['templates', 'build'].includes(item) && relativePath === '') continue;
        if (item.endsWith('.git')) continue; // Skip git directory

        const itemPath = path.join(dirPath, item);
        const itemRelativePath = path.join(relativePath, item);
        const stats = await fs.stat(itemPath);

        // Check filename match
        if (item.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            path: normalizePath(itemRelativePath),
            name: item,
            isDirectory: stats.isDirectory(),
            matchType: 'filename',
            size: stats.size,
            modifiedTime: stats.mtime
          });
          resultCount++;
        }

        if (stats.isDirectory()) {
          // Search within subdirectory
          await searchRecursively(itemPath, itemRelativePath);
        } else {
          // Check if file is likely to be binary by extension
          const ext = path.extname(item).toLowerCase();
          const binaryExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.docx', '.xlsx'];
          
          if (!binaryExtensions.includes(ext) && resultCount < maxResults) {
            // For text files, search content
            try {
              const content = await fs.readFile(itemPath, 'utf-8');
              const lowerContent = content.toLowerCase();
              const lowerQuery = query.toLowerCase();
              
              if (lowerContent.includes(lowerQuery)) {
                // Extract context around the match
                const matchIndex = lowerContent.indexOf(lowerQuery);
                const extractStart = Math.max(0, matchIndex - 40);
                const extractEnd = Math.min(content.length, matchIndex + query.length + 40);
                
                let extractText = content.substring(extractStart, extractEnd);
                
                // Add ellipsis if we're not starting from the beginning or ending at the end
                if (extractStart > 0) extractText = '...' + extractText;
                if (extractEnd < content.length) extractText = extractText + '...';
                
                // Only add to results if not already added via filename match
                if (!results.some(r => r.path === itemRelativePath)) {
                  results.push({
                    path: itemRelativePath,
                    name: item,
                    isDirectory: false,
                    matchType: 'content',
                    extract: extractText,
                    size: stats.size,
                    modifiedTime: stats.mtime
                  });
                  resultCount++;
                }
              }
            } catch (err) {
              // Skip files that can't be read as text
              console.warn(`Could not read file for search: ${itemPath}`, err.message);
            }
          }
        }
      }
    };

    // Start recursive search
    await searchRecursively(req.workspacePath);

    return res.status(200).json({
      success: true,
      results,
      hasMoreResults: resultCount >= maxResults
    });
  } catch (error) {
    console.error('Error searching files:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search files',
      error: error.message
    });
  }
});

// Get file content
router.get('/content', async (req, res) => {
  try {
    const { filePath } = req.query;
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required'
      });
    }

    const fullPath = path.join(req.workspacePath, filePath);
    
    // Check if file exists and is within the workspace
    if (!await fs.pathExists(fullPath) || !fullPath.startsWith(req.workspacePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found or invalid path'
      });
    }

    // Check if it's a directory
    const stats = await fs.stat(fullPath);
    if (stats.isDirectory()) {
      return res.status(400).json({
        success: false,
        message: 'Path points to a directory, not a file'
      });
    }

    // Check if file is editable
    const extension = path.extname(fullPath).toLowerCase();
    const editableExtensions = ['.md', '.yaml', '.yml', '.bib', '.txt', ''];
    const isEditable = editableExtensions.includes(extension);
    
    // For non-editable files, return success but with isEditable=false
    // The client will handle displaying these files differently
    if (!isEditable) {
      return res.status(200).json({
        success: true,
        content: '',
        filePath,
        isEditable: false
      });
    }

    // Read file content for editable files
    const content = await fs.readFile(fullPath, 'utf-8');
    
    return res.status(200).json({
      success: true,
      content,
      filePath,
      isEditable: true
    });
  } catch (error) {
    console.error('Error getting file content:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get file content',
      error: error.message
    });
  }
});

// Save file content
router.post('/save', async (req, res) => {
  try {
    const { filePath, content } = req.body;
    
    if (!filePath || content === undefined) {
      return res.status(400).json({
        success: false,
        message: 'File path and content are required'
      });
    }

    const fullPath = path.join(req.workspacePath, filePath);
    
    // Check if path is within the workspace
    if (!fullPath.startsWith(req.workspacePath)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid file path'
      });
    }

    // Ensure directory exists
    await fs.ensureDir(path.dirname(fullPath));
    
    // Write file content
    await fs.writeFile(fullPath, content, 'utf-8');
    
    return res.status(200).json({
      success: true,
      message: 'File saved successfully',
      filePath
    });
  } catch (error) {
    console.error('Error saving file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save file',
      error: error.message
    });
  }
});

// Delete file
router.post('/delete', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required'
      });
    }

    const fullPath = path.join(req.workspacePath, filePath);
    
    // Check if path is within the workspace
    if (!fullPath.startsWith(req.workspacePath)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid file path'
      });
    }

    // Check if file exists
    if (!await fs.pathExists(fullPath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Delete file or directory
    await fs.remove(fullPath);
    
    return res.status(200).json({
      success: true,
      message: 'File deleted successfully',
      filePath
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message
    });
  }
});

// Rename file
router.post('/rename', async (req, res) => {
  try {
    const { oldPath, newPath } = req.body;
    
    if (!oldPath || !newPath) {
      return res.status(400).json({
        success: false,
        message: 'Old path and new path are required'
      });
    }

    const fullOldPath = path.join(req.workspacePath, oldPath);
    const fullNewPath = path.join(req.workspacePath, newPath);
    
    // Check if paths are within the workspace
    if (!fullOldPath.startsWith(req.workspacePath) || !fullNewPath.startsWith(req.workspacePath)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid file path'
      });
    }

    // Check if source file exists
    if (!await fs.pathExists(fullOldPath)) {
      return res.status(404).json({
        success: false,
        message: 'Source file not found'
      });
    }
    
    // Check if destination already exists
    if (await fs.pathExists(fullNewPath)) {
      return res.status(409).json({
        success: false,
        message: 'Destination already exists'
      });
    }

    // Ensure destination directory exists
    await fs.ensureDir(path.dirname(fullNewPath));
    
    // Rename/move file
    await fs.move(fullOldPath, fullNewPath);
    
    return res.status(200).json({
      success: true,
      message: 'File renamed successfully',
      oldPath,
      newPath
    });
  } catch (error) {
    console.error('Error renaming file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to rename file',
      error: error.message
    });
  }
});

// Copy file
router.post('/copy', async (req, res) => {
  try {
    const { sourcePath, destPath } = req.body;
    
    if (!sourcePath || !destPath) {
      return res.status(400).json({
        success: false,
        message: 'Source path and destination path are required'
      });
    }

    const fullSourcePath = path.join(req.workspacePath, sourcePath);
    const fullDestPath = path.join(req.workspacePath, destPath);
    
    // Check if paths are within the workspace
    if (!fullSourcePath.startsWith(req.workspacePath) || !fullDestPath.startsWith(req.workspacePath)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid file path'
      });
    }

    // Check if source file exists
    if (!await fs.pathExists(fullSourcePath)) {
      return res.status(404).json({
        success: false,
        message: 'Source file not found'
      });
    }
    
    // Check if destination already exists
    if (await fs.pathExists(fullDestPath)) {
      return res.status(409).json({
        success: false,
        message: 'Destination already exists'
      });
    }

    // Ensure destination directory exists
    await fs.ensureDir(path.dirname(fullDestPath));
    
    // Copy file or directory
    await fs.copy(fullSourcePath, fullDestPath);
    
    return res.status(200).json({
      success: true,
      message: 'File copied successfully',
      sourcePath,
      destPath
    });
  } catch (error) {
    console.error('Error copying file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to copy file',
      error: error.message
    });
  }
});

// Move file
router.post('/move', async (req, res) => {
  try {
    const { sourcePath, destPath } = req.body;
    
    if (!sourcePath || !destPath) {
      return res.status(400).json({
        success: false,
        message: 'Source path and destination path are required'
      });
    }

    const fullSourcePath = path.join(req.workspacePath, sourcePath);
    const fullDestPath = path.join(req.workspacePath, destPath);
    
    // Check if paths are within the workspace
    if (!fullSourcePath.startsWith(req.workspacePath) || !fullDestPath.startsWith(req.workspacePath)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid file path'
      });
    }

    // Check if source file exists
    if (!await fs.pathExists(fullSourcePath)) {
      return res.status(404).json({
        success: false,
        message: 'Source file not found'
      });
    }
    
    // Check if destination already exists
    if (await fs.pathExists(fullDestPath)) {
      return res.status(409).json({
        success: false,
        message: 'Destination already exists'
      });
    }

    // Ensure destination directory exists
    await fs.ensureDir(path.dirname(fullDestPath));
    
    // Move file or directory
    await fs.move(fullSourcePath, fullDestPath);
    
    return res.status(200).json({
      success: true,
      message: 'File moved successfully',
      sourcePath,
      destPath
    });
  } catch (error) {
    console.error('Error moving file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to move file',
      error: error.message
    });
  }
});

// Upload file
router.post('/upload', async (req, res) => {
  try {
    // If no file is uploaded
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files were uploaded'
      });
    }

    const { filePath } = req.body;
    const uploadedFile = req.files.file;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required'
      });
    }

    const fullPath = path.join(req.workspacePath, filePath);
    
    // Check if path is within the workspace
    if (!fullPath.startsWith(req.workspacePath)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid file path'
      });
    }

    // Ensure directory exists
    await fs.ensureDir(path.dirname(fullPath));
    
    // Move the uploaded file to its destination
    await uploadedFile.mv(fullPath);
    
    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      filePath
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload file',
      error: error.message
    });
  }
});

// View file (serve file directly)
router.get('/view/:filePath(*)', async (req, res) => {
  try {
    const filePath = req.params.filePath;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required'
      });
    }

    const fullPath = path.join(req.workspacePath, filePath);
    
    // Check if file exists and is within the workspace
    if (!await fs.pathExists(fullPath) || !fullPath.startsWith(req.workspacePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found or invalid path'
      });
    }

    // Check if it's a directory
    const stats = await fs.stat(fullPath);
    if (stats.isDirectory()) {
      return res.status(400).json({
        success: false,
        message: 'Path points to a directory, not a file'
      });
    }

    // Determine content type based on file extension
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = getContentType(ext);
    
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    // Serve the file directly
    return res.sendFile(fullPath);
  } catch (error) {
    console.error('Error serving file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to serve file',
      error: error.message
    });
  }
});

// Helper function to determine content type
function getContentType(ext) {
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.md': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript'
  };
  
  return contentTypes[ext] || 'application/octet-stream';
}

// Get PFS documents that use a requirement file
router.get('/pfs-references', async (req, res) => {
  try {
    const { requirementPath } = req.query;
    
    if (!requirementPath) {
      return res.status(400).json({
        success: false,
        message: 'Requirement file path is required'
      });
    }

    // Check if this is a requirements file
    if (!requirementPath.startsWith('requirements/')) {
      return res.status(200).json({
        success: true,
        pfsDocuments: []
      });
    }

    // Extract the requirement name from the path (without the .yaml extension and requirements/ prefix)
    const requirementName = requirementPath.replace('requirements/', '').replace('.yaml', '');
    
    // Find all PFS folders
    const pfsDir = path.join(req.workspacePath, 'pfs');
    if (!await fs.pathExists(pfsDir)) {
      return res.status(200).json({
        success: true,
        pfsDocuments: []
      });
    }

    const pfsFolders = await fs.readdir(pfsDir);
    const pfsDocuments = [];
    
    // Check each PFS folder's requirements.yaml file
    for (const pfsFolder of pfsFolders) {
      const requirementsFilePath = path.join(pfsDir, pfsFolder, 'requirements.yaml');
      
      if (await fs.pathExists(requirementsFilePath)) {
        try {
          const content = await fs.readFile(requirementsFilePath, 'utf-8');
          
          // Check if the requirement name is in the content
          if (content.includes(requirementName)) {
            pfsDocuments.push(pfsFolder);
          }
        } catch (error) {
          console.warn(`Could not read requirements file for ${pfsFolder}:`, error.message);
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      pfsDocuments
    });
  } catch (error) {
    console.error('Error getting PFS references:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get PFS references',
      error: error.message
    });
  }
});

// Revert changes to a file (restore from git)
router.post('/revert', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required'
      });
    }

    // Get the full path
    const fullPath = path.join(req.workspacePath, filePath);
    
    // Check if path is within the workspace
    if (!fullPath.startsWith(req.workspacePath)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid file path'
      });
    }

    // Execute git checkout to restore the file
    const gitCmd = `git checkout -- "${filePath}"`;
    await execPromise(gitCmd, { cwd: req.workspacePath });
    
    return res.status(200).json({
      success: true,
      message: 'File reverted successfully',
      filePath
    });
  } catch (error) {
    console.error('Error reverting file changes:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to revert file changes',
      error: error.message
    });
  }
});

// Get diff for a file
router.get('/diff', async (req, res) => {
  try {
    const { filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required'
      });
    }

    // Get the full path
    const fullPath = path.join(req.workspacePath, filePath);
    
    // Check if path is within the workspace
    if (!fullPath.startsWith(req.workspacePath)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid file path'
      });
    }
    
    // Get git status of the file to determine how to handle it
    const gitStatusCmd = `git status --porcelain -- "${filePath}"`;
    const { stdout: gitStatusOutput } = await execPromise(gitStatusCmd, { cwd: req.workspacePath });
    
    if (gitStatusOutput.trim() === '') {
      // File not changed
      return res.status(200).json({
        success: true,
        diff: 'No changes'
      });
    }
    
    // Git status output format is "XY filename" where X is staging status and Y is working tree status
    const statusCode = gitStatusOutput.substring(0, 2).trim();
    
    // Handle different file statuses
    if (statusCode === 'A' || statusCode === '??' || statusCode.startsWith('A')) {
      // Added file - no diff needed
      return res.status(200).json({
        success: true,
        diff: `New file: ${filePath}`
      });
    } else if (statusCode === 'D' || statusCode.includes('D')) {
      // Deleted file - no diff needed
      return res.status(200).json({
        success: true,
        diff: `File deleted: ${filePath}`
      });
    } else if (statusCode.includes('R')) {
      // Renamed file
      return res.status(200).json({
        success: true,
        diff: `File renamed: ${filePath}`
      });
    } else {
      // Modified file - show diff
      const gitDiffCmd = `git diff -- "${filePath}"`;
      const { stdout: diffOutput } = await execPromise(gitDiffCmd, { cwd: req.workspacePath });
      
      return res.status(200).json({
        success: true,
        diff: diffOutput || 'No visible changes (possibly whitespace only)'
      });
    }
  } catch (error) {
    console.error('Error getting diff:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get diff',
      error: error.message
    });
  }
});

// Create a new folder
router.post('/create-folder', async (req, res) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath) {
      return res.status(400).json({
        success: false,
        message: 'Folder path is required'
      });
    }
    const fullPath = path.join(req.workspacePath, folderPath);
    // Check if path is within the workspace
    if (!fullPath.startsWith(req.workspacePath)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid folder path'
      });
    }
    // Ensure directory does not already exist
    if (await fs.pathExists(fullPath)) {
      return res.status(409).json({
        success: false,
        message: 'Folder already exists'
      });
    }
    // Create the directory
    await fs.ensureDir(fullPath);
    return res.status(200).json({
      success: true,
      message: 'Folder created successfully',
      folderPath
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create folder',
      error: error.message
    });
  }
});

module.exports = router;