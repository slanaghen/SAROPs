# SAROps Context Providers: Incident and Toast

This document details the structure and content of the `IncidentContext` and `ToastContext`, which handle global state management and user notifications across the SAROps application.

---

## 1. IncidentContext

The `IncidentContext` is the primary state container for the application. It manages the lifecycle of a search-and-rescue incident and tracks the identity and operational status of the current user.

### Primary Responsibilities
*   **Session Management**: Tracking if an incident is active and managing the transition between "Guest" and "Active" states.
*   **Identity Resolution**: Mapping the authenticated Supabase user to a specific `responder` record.
*   **Operational Parity**: Syncing the user's current status (e.g., Deployed, Staged) and team attachment across all dashboards.
*   **System Configuration**: Managing global refresh intervals for data polling.

### Key State Variables
| Variable | Type | Description |
| :--- | :--- | :--- |
| `isActive` | Boolean | True if an incident is currently being tracked in the session. |
| `isAdmin` | Boolean | True if the user has system-wide administrative access. |
| `incidentId` | String | The unique identifier (number) of the active incident. |
| `incidentData` | Object | Metadata including `name`, `opNumber`, `opPeriodId`, `parInterval`, and `sarstream` data. |
| `responderId` | String | The UUID of the responder record associated with the current session. |
| `responderName` | String | The display name of the current user. |
| `responderStatus` | String | The individual operational status (e.g., `Staged`, `Deployed`). |
| `accessLevel` | String | The role-based access level (`admin`, `staff`, or `responder`). |
| `currentTeamStatus` | String | The status of the team the user is currently attached to. |
| `currentAssignmentStatus`| String | The status of the task currently assigned to the user's team. |
| `user` | Object | The raw Supabase Auth user object. |
| `operationsRefreshInterval` | Number | The polling rate (ms) for the Operations and Planning dashboards. |
| `responderRefreshInterval` | Number | The polling rate (ms) for the Responder Dashboard. |
| `sartopoRefreshInterval` | Number | The polling rate (ms) for the SARTopo synchronization service. |

### Key Functions
| Function | Description |
| :--- | :--- |
| `startIncident(...)` | Initializes the context with incident and operational period metadata. |
| `endIncident()` | Resets the context and cleans up operational state when an incident is closed. |
| `setResponderId(id)` | Updates the active responder reference. |
| `setResponderStatus(status)`| Updates the user's operational status. |
| `setAccessLevel(level)` | Updates the user's permission level. |
| `logout()` | Clears all context state and signs the user out of Supabase Auth. |
| `clearIncident()` | Resets incident-specific data without ending the user session. |
| `setOperationsRefreshInterval(n)` | Updates the global polling rate for staff dashboards. |

---

## 2. ToastContext

The `ToastContext` provides a unified, non-blocking notification system. It allows components to deliver feedback to the user without interrupting their workflow with browser alerts.

### Primary Responsibilities
*   **User Feedback**: Delivering success, error, warning, and info messages.
*   **Queue Management**: Managing multiple active notifications and handling their automatic expiration.
*   **UI Consistency**: Ensuring that all alerts across the application share the same visual style and behavior.

### Key Functions
| Function | Description |
| :--- | :--- |
| `addToast(message, type)` | Adds a new notification to the screen. |

### Toast Types and Usage
The `addToast` function accepts a `type` string that determines the visual styling of the notification:

*   **`success`**
    *   **Color**: Green.
    *   **Usage**: Positive confirmation of an action (e.g., "Assignment saved").
*   **`error`**
    *   **Color**: Red.
    *   **Usage**: Indicating a failure or permission issue (e.g., "Failed to sync SARTopo data").
*   **`warning`**
    *   **Color**: Orange.
    *   **Usage**: Highlighting an operational risk or a required field (e.g., "You cannot leave while deployed").
*   **`info`**
    *   **Color**: Blue.
    *   **Usage**: General updates or status changes (e.g., "New broadcast message received").

---

## 3. Implementation Patterns

### Accessing Context
Contexts are accessed via custom hooks:
```javascript
const { incidentData, responderStatus } = useIncident();
const { addToast } = useToast();
```

### Triggering Notifications
Toasts are typically triggered inside `try...catch` blocks or after successful API calls:
```javascript
try {
  await saveAssignment(data);
  addToast('Assignment updated', 'success');
} catch (err) {
  addToast(err.message, 'error');
}
```