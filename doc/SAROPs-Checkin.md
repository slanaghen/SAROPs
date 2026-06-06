# SAROps Responder Check-in

The Responder Check-in page is the primary entry point for field personnel and command staff. It manages identity establishment, incident selection, and initial team placement.

## 1. Functionality

### Session Initialization
Upon loading, the page checks for an existing session. If no session is found, it establishes a temporary **Anonymous Session** via Supabase Auth (`signInAnonymously`). This ensures that all database interactions are protected by Row Level Security (RLS) from the moment the user interacts with the form.

### Data Collection
The check-in process captures essential operational metadata:
*   **Identity**: Full Name, Agency, and a unique Identifier (e.g., Radio Call Sign or Badge Number).
*   **Contact**: Cell phone number, automatically formatted as `nnn-nnn-nnnn`.
*   **Capabilities**: Multi-select field for special skills (UAS, K9, Swiftwater, etc.).
*   **Responder Type**: Radio selection for agency type (SAR, Fire, Law, Medical).
*   **Device Tracking**: Generates a unique `device_id` stored in local storage to maintain session persistence and facilitate offline tracking.

### Incident Selection
Users select from a real-time list of active incidents (incidents where `end_datetime` is NULL). 
*   **Real-time Sync**: The list updates automatically if an incident is started or ended by an administrator.
*   **Admin Override**: If the user is an Admin, they are provided the option to create a new incident directly from the check-in flow.

### The "First Responder" Logic
A critical system feature: if a responder checks into an incident that has no Incident Commander, the system:
1.  Identifies the "Staff" team for the current Operational Period.
2.  Automatically assigns the responder to the Staff team.
3.  Sets the responder as the **Incident Commander** (Team Leader).
4.  Promotes their `access_level` to `staff` via database triggers.

### Confirmation & Team Assignment
Before finalization, a confirmation screen displays the captured data. After confirmation:
*   If the incident has active teams, the user can select a team to join.
*   If the user is recognized as Command Staff, they are redirected directly to the **Operations Dashboard**.
*   Standard responders are redirected to the **Responder Dashboard**.

---

## 2. Styling and UI Design

### Layout
*   **Centering**: The form is contained in a `checkin-container` with a `maxWidth` of `480px`, centered vertically and horizontally in the viewport.
*   **Component Architecture**: The `ResponderCheckinPage` acts as a logic wrapper, while `ResponderCheckin` handles the rendering.

### Visual Theme
*   **Typography**: Uses the **Inter** system font.
*   **High-Density Forms**: Input fields and labels use a compact design (`padding: 4px 1px`, `font-size: 11.5px`) to ensure the entire form is visible on mobile screens without excessive scrolling.
*   **Status Indicators**: The page uses the system's standard status chips:
    *   `Staged`: Dark Blue
    *   `Attached`: Light Gray with Dark Text
    *   `Online`: Green dot (in banner)

### Confirmation View
The confirmation screen utilizes a "dark card" aesthetic within the CSS:
*   **Labels**: Displayed in `white` with a bold weight to contrast against the dark card backgrounds.
*   **Values**: Displayed with clear, readable spacing in a two-column detail grid.

### Interaction Design
*   **Buttons**: 
    *   `btn-primary`: Bright blue (`#0ea5e9`) for the main "Continue" and "Confirm" actions.
    *   `btn-secondary`: Transparent with borders for "Back to Edit" or "Skip" actions.
*   **Loading States**: An animated hourglass spinner and "Establishing secure temporary access" messaging appear during session initialization to manage user expectations.
*   **Alerts**: 
    *   **Error**: Red background with a warning icon for validation failures or network errors.
    *   **Success**: Green background for successful check-in confirmation.

---

## 3. Navigation Links
*   **Registered User Link**: Located directly under the title, allowing Staff and Admins to bypass the field check-in and go to the formal `/login` page.
*   **Auto-Redirect**: If an active, non-expired session is detected, the page automatically redirects the user to their respective dashboard to prevent redundant check-ins.
```