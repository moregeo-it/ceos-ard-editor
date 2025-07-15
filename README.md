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
- GitHub account (required for authentication and to obtain OAuth credentials)

### Server Setup

1. Navigate to the server directory:
   ```
   cd server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the `server` directory with the following keys:
   ```
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   BASE_URL=http://localhost:3000
   SESSION_SECRET=your_session_secret
   ```
   - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are required for GitHub authentication.
   - `BASE_URL` should match your server's base URL.
   - `SESSION_SECRET` is any random string for securing sessions.

4. Obtain GitHub OAuth App credentials:
   To use GitHub authentication (`passport-github2`), you need to register an OAuth application:
   - Go to [GitHub Developer Settings > OAuth Apps](https://github.com/settings/developers).
   - Click **"New OAuth App"**.
   - Set the **Application name** (e.g., CEOS-ARD Editor).
   - Set the **Homepage URL** to your server's URL (e.g., `http://localhost:3000` for local development).
   - Set the **Authorization callback URL** to `http://localhost:3000/api/auth/github/callback`.
   - After creating the app, copy the **Client ID** and **Client Secret** into your `.env` file as shown above.

5. Start the server:
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