# CEOS-ARD Editor

A collaborative web-based editor for the CEOS-ARD (Committee on Earth Observation Satellites - Analysis Ready Data) repository.

## Features

- Three-column layout:
  - Left column: File tree for browsing the CEOS-ARD repository
  - Middle column: Code editor for editing YAML files and other content
  - Right column: Preview pane showing generated HTML output
- Workspace-based editing with unique tokens
- Server-side git repository handling
- Preview generation using the CEOS-ARD CLI

## Project Structure

- `/client` - Vue 3 frontend with Vite
- `/server` - Node.js/Express backend

## Setup and Installation

### Prerequisites

- Node.js (v14+ recommended)
- npm or yarn
- Git
- [ceos-ard CLI tool](https://github.com/ceos-org/ceos-ard-cli) installed globally

### Server Setup

1. Navigate to the server directory:
   ```
   cd server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   npm run dev
   ```

The server will run on `http://localhost:3000` by default.

### Client Setup

1. Navigate to the client directory:
   ```
   cd client
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

The client will run on `http://localhost:5173` by default.

## Usage

1. Open the client application in your browser
2. Click "Create New Workspace" to clone the CEOS-ARD repository and create a workspace
3. Browse files using the file tree in the left panel
4. Edit files in the middle panel
5. Save changes and click "Generate Preview" to build HTML previews
6. Select different preview files from the dropdown in the right panel
7. When finished, click "Close Workspace" to delete the workspace

## License

MIT