# SAROps UI Style Guide: Buttons, Chips, and Top Banner

This document outlines the standard styling conventions for buttons and status chips within the SAROps application, including how they adapt to different display density settings. It also details the content and behavior of the top banner.

---

## 1. Buttons

Buttons in SAROps are designed for clear action indication and consistent user interaction.

### General Appearance
*   **Shape**: Rounded corners (typically `8px` or `4px` `border-radius`).
*   **Font**: Inherits system font, typically `font-weight: 600` (semi-bold).
*   **Size**: Varies based on context (e.g., main actions vs. header actions).
*   **Hover/Active States**: Subtle visual feedback (e.g., slight background change, border darkening).

### Types and Coloring

Buttons use a semantic coloring scheme to indicate the nature of the action.

*   **`action-btn-primary` (Primary Action)**
    *   **Color**: Bright blue (`#0ea5e9` or similar).
    *   **Text**: White.
    *   **Use**: Main call-to-action, positive confirmation, initiating a process.
    *   **Example**: "Save", "Check in to Incident", "Download from SARTopo".

*   **`action-btn-secondary` (Secondary Action)**
    *   **Color**: Transparent background, border (`#cbd5e1` or similar).
    *   **Text**: Dark gray (`#475569` or similar).
    *   **Use**: Alternative actions, cancellations, less prominent actions.
    *   **Example**: "Cancel", "Reset", "Generate JSON".

*   **`action-btn-success` (Success/Confirm)**
    *   **Color**: Green (`#22c55e` or similar).
    *   **Text**: White.
    *   **Use**: Confirming successful completion, positive operational status.
    *   **Example**: "Complete" (assignment).

*   **`action-btn-warning` (Warning/Caution)**
    *   **Color**: Orange/Red (`#f59e0b` or similar).
    *   **Text**: White.
    *   **Use**: Actions with potential negative consequences, or to highlight a specific status.
    *   **Example**: "Leave Team", "Cancel" (assignment).

*   **`action-btn-danger` (Destructive Action)**
    *   **Color**: Red (`#ef4444` or similar).
    *   **Text**: White.
    *   **Use**: Deletion, irreversible actions.
    *   **Example**: "Clear Data", "Delete Incident".

*   **`action-btn-full` (Full Width)**
    *   **Use**: Stretches to fill available horizontal space.
    *   **Example**: "Deploy" button on Responder Dashboard.

*   **`action-btn-header` (Compact Header Button)**
    *   **Use**: Smaller buttons typically found within section headers or alongside other controls.

---

## 2. Status Chips

Status chips (`status-chip` or `status-indicator`) are small, visually distinct labels used to convey the current state of an object (responder, team, assignment).

### General Appearance
*   **Shape**: Rounded rectangles (`border-radius: 4px` or `8px`).
*   **Font**: Small, often `font-size: 12px` or `13px`, `font-weight: 500` or `600`.
*   **Padding**: Compact horizontal and vertical padding (e.g., `2px 8px`).

### Types and Coloring

Chips use a color-coded system to quickly communicate status.

*   **`status-chip-staged` (Staged)**
    *   **Color**: Dark Blue (`#1e3a8a` or similar).
    *   **Text**: White.
    *   **Use**: Responder/Team is ready for assignment, at base.

*   **`status-chip-attached` (Attached)**
    *   **Color**: Light Gray (`#e2e8f0` or similar).
    *   **Text**: Dark Gray (`#475569` or similar).
    *   **Use**: Responder is part of a team, but the team is not yet assigned or deployed.

*   **`status-chip-assigned` (Assigned)**
    *   **Color**: Blue (`#3b82f6` or similar).
    *   **Text**: White.
    *   **Use**: Team/Assignment has been given a task but not yet deployed.

*   **`status-chip-deployed` (Deployed)**
    *   **Color**: Green (`#22c55e` or similar).
    *   **Text**: White.
    *   **Use**: Team/Assignment is actively in the field.

*   **`status-chip-completed` (Completed)**
    *   **Color**: Green (`#22c55e` or similar).
    *   **Text**: White.
    *   **Use**: Assignment successfully finished.

*   **`status-chip-incomplete` (Incomplete/Cancelled)**
    *   **Color**: Orange (`#f59e0b` or similar).
    *   **Text**: White.
    *   **Use**: Assignment cancelled or not fully completed.

*   **`chip-overdue-gradient` (PAR Overdue)**
    *   **Color**: Animated gradient, typically from orange to red.
    *   **Text**: White.
    *   **Use**: Visually highlights overdue Personnel Accountability Report (PAR) status.

*   **`unread-indicator` (New Message)**
    *   **Color**: Red dot (`#ef4444`).
    *   **Use**: Indicates unread messages in the global banner.

---

## 3. Display Density

The application supports different display densities to optimize for various screen sizes and user preferences. This is controlled by the `display_density` setting in the user's profile (`users` table) and applied via a class on the `app-shell` div (e.g., `density-comfortable`, `density-compact`).

*   **`density-comfortable` (Default)**
    *   **Buttons**: Standard padding, font sizes, and heights.
    *   **Chips**: Standard padding and font sizes.
    *   **Overall**: More generous spacing between elements, larger input fields.

*   **`density-compact` (Compact Mode)**
    *   **Buttons**: Reduced padding, slightly smaller font sizes, and lower heights.
    *   **Chips**: Reduced padding and smaller font sizes.
    *   **Overall**: Tighter spacing, smaller input fields, designed to fit more information on smaller screens (e.g., mobile devices).

---

## 4. Top Banner

The top banner (`incident-banner`) provides persistent, critical information about the application state, current incident, and user status.

### Content and Circumstances

1.  **Branding (`banner-left`)**
    *   **SAROps Logo and Text**: Always visible.
    *   **DB Instance Indicator**: Displays `LOCAL` or `REMOTE` based on `SAROPS_DB_INSTANCE` environment variable. This is a small chip indicating which Supabase instance the application is connected to.

2.  **Incident Information (`banner-item`)**
    *   **Incident Name**: (`incidentData?.name`) - Visible when an incident is `isActive`.
    *   **Operational Period Number**: (`incidentData?.opNumber`) - Visible when an incident is `isActive`.

3.  **User Information (`banner-right`)**
    *   **Responder Name**: (`responderName`) - Displays the name of the currently active responder.
    *   **Access Level**: (`accessLevel`) - Appears next to the responder name, indicating `Admin`, `Staff`, or `Responder`.
    *   **Guest/Email**: If `responderName` is not set, displays `user?.email` or "Guest".

4.  **Status Indicator (`status-indicator`)**
    *   **Effective Status**: Displays the most relevant operational status of the current user (e.g., `Staged`, `Attached`, `Assigned`, `Deployed`, `CheckedOut`). This prioritizes active field statuses over `Staged`.
    *   **Visibility**: Appears when an incident is `isActive` or the `responderStatus` is `CheckedOut`.

5.  **Notifications**
    *   **System Notifications Blocked**: A small `!` icon (`connection-dot offline`) appears if browser notifications are denied, indicating that visual alerts are disabled.
    *   **Unread Messages**: A red dot (`unread-indicator`) appears if `hasUnreadMessages` is true, indicating new unread messages. Clicking it navigates to the Responder Dashboard.

6.  **Connectivity Indicator (`connection-dot`)**
    *   **Online/Offline**: A small green (`online`) or red (`offline`) dot indicates the application's network connectivity status.

7.  **Menu (`banner-menu-container`)**
    *   **Hamburger Button**: Always visible when a `user` is logged in or an incident is `isActive`.
    *   **Dropdown Menu**: Contains navigation links.
        *   **My Dashboard**: Visible if `isActive`.
        *   **Settings**: Visible if `isActive`.
        *   **ICS Chart**: Visible if `isActive`.
        *   **QR Codes**: Visible if `isActive`.
        *   **Check Out**: Visible if `isActive`.
        *   **Live Feed**: Visible if `incidentData?.sarstream` is enabled and `incidentData?.sarstream_data?.url` is present.
        *   **Operations**: Visible for `Staff` or `Admin` access levels.
        *   **Planning**: Visible for `Staff` or `Admin` access levels.
        *   **Incident**: Visible for `Staff` or `Admin` access levels.
        *   **Action Log**: Visible for `Staff` or `Admin` access levels.
        *   **SARTopo**: Visible for `Staff` or `Admin` access levels.
        *   **Google Forms**: Visible for `Staff` or `Admin` access levels.
        *   **Administration**: Visible only for `Admin` access level.
        *   **DB Switcher**: Allows switching between `LOCAL` and `REMOTE` database instances.
        *   **Sign Out**: Always visible when a user is logged in.

---

### Display Density Impact on Top Banner

The top banner also adapts to the `display_density` setting:

*   **`density-comfortable`**: Standard padding, font sizes, and element spacing.
*   **`density-compact`**: Reduced padding, smaller font sizes, and tighter spacing to ensure all elements fit without overflow, especially on smaller screens. The `compact-mode` class is added to the `app-shell` to trigger specific CSS adjustments.

```
```


