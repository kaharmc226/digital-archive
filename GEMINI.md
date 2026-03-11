# Digital Archive

## Project Overview
Digital Archive is a secure, full-stack web application built to serve as a document management system. It acts as a custom, user-friendly frontend for a specific Google Drive folder. 

### Key Technologies
*   **Framework:** Next.js 16 (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS (v4)
*   **Authentication:** Auth.js (`next-auth@beta`) using the Google Provider
*   **Storage Backend:** Google Drive API (`googleapis`)
*   **UI Components:** `react-hot-toast` for notifications.

### Core Architecture & Features
*   **Google Drive Integration:** The application connects to a designated Google Drive root folder using an OAuth2 Refresh Token (configured via `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN`). It acts as a central service account representing the archive owner.
*   **Authentication:** Users must log in via their Google accounts to access the dashboard.
*   **Dynamic Permissions:** Access control is managed via a designated Google Sheet (`GOOGLE_SHEET_ID`). The application fetches this sheet dynamically, mapping user emails to allowed subfolders within the archive.
*   **Localization:** The user interface is localized in Bahasa Indonesia.
*   **Operations:** Users can view files, navigate through subfolders (categories), upload new files (with drag-and-drop support), delete files, and search within specific folders or globally.

## Building and Running

### Prerequisites
Ensure Node.js is installed. The project uses `npm` as the package manager.

Environment variables must be configured in a `.env.local` file:
```env
GOOGLE_DRIVE_FOLDER_ID=...
AUTH_GOOGLE_ID=...          # Used for next-auth login
AUTH_GOOGLE_SECRET=...      # Used for next-auth login
GOOGLE_CLIENT_ID=...        # Used for Drive API operations
GOOGLE_CLIENT_SECRET=...    # Used for Drive API operations
GOOGLE_REFRESH_TOKEN=...    # Offline access token for Drive operations
AUTH_SECRET=...             # Random string for next-auth session encryption
GOOGLE_SHEET_ID=...         # Spreadsheet ID for access control
```

### Commands
*   **Development Server:**
    ```bash
    npm run dev
    ```
*   **Production Build:**
    ```bash
    npm run build
    ```
*   **Start Production Server:**
    ```bash
    npm start
    ```
*   **Linting:**
    ```bash
    npm run lint
    ```

## Development Conventions

*   **Routing:** The project strictly follows the Next.js App Router conventions (`src/app`).
*   **Authentication Middleware:** Protected routes are enforced using the `src/proxy.ts` (Next.js middleware) and `src/auth.ts` configuration.
*   **API Routes:** Backend logic handling Google Drive operations is located in `src/app/api/drive`. These routes must enforce authentication and verify permissions by calling functions from `src/lib/permissions.ts`.
*   **Drive Service Abstraction:** All raw Google Drive API initialization should happen through `getDriveService()` located in `src/lib/googleDrive.ts`.
*   **Styling:** Utility-first styling with Tailwind CSS is preferred over custom CSS files.
*   **Error Handling:** Use `toast.error` (from `react-hot-toast`) on the client side to display errors gracefully to the user in Bahasa Indonesia.
*   **Google Drive Thumbnails:** When rendering images or thumbnails sourced from Google Drive, always include the `referrerPolicy="no-referrer"` attribute on the `<img>` tag to prevent 403 Forbidden errors caused by cross-origin restrictions.
