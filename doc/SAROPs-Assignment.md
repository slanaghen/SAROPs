# SAROps Assignment Management Specification

This document provides a complete technical specification for the `Assignment` object within the SAROps application, with a focus on the data persistence strategy for completed assignments.

---

## 1. Assignment Data Model

An Assignment is a task defined within a specific **Operational Period**. Its data is primarily stored in the `assignments` table.

| Field | Type | Description |
| :--- | :--- | :--- |
| `assignment_id` | UUID | Primary Key. |
| `op_period_id` | UUID | Foreign Key to `operational_periods`. |
| `team_id` | UUID | Foreign Key to `teams`. This is **nullable**. |
| `status` | `assignment_status` | The current operational status of the assignment. |
| `title` | TEXT | The user-defined name for the assignment. |
| `completed_team_snapshot` | JSONB | **Key Field**: Stores an immutable record of the team at completion. |
| ... | ... | Other descriptive fields (segment, type, etc.). |

### The `completed_team_snapshot` Column

This `JSONB` column is the cornerstone of the historical data strategy. When an assignment is moved to a terminal status (`Completed` or `Incomplete`), this field is populated with a complete, point-in-time record of the team that was assigned to it. This decouples the historical record from the live team object, which can then be reused.

---

## 2. The "Snapshot" Workflow for Completed Assignments

To preserve historical data integrity while allowing teams to be reused, the system employs a "snapshot" method when an assignment is completed.

### Trigger Logic

This workflow is managed by the `sync_team_status_on_assignment_update` database trigger, which fires when the `status` of a record in the `assignments` table is updated.

### Workflow Steps

When an assignment's status changes to `Completed` or `Incomplete`, the trigger function executes the following sequence:

1.  **Snapshot Creation**: A query, likely leveraging the `team_current_responders` view, generates a JSON object of the team's complete state (details below). This JSON object is then written into the `completed_team_snapshot` column of the assignment being updated.

2.  **Team Release**: The original team's `status` in the `teams` table is set back to `Staged`. This makes the team and its name immediately available for a new tasking without requiring it to be recreated.

3.  **Decoupling**: The `team_id` on the assignment record is set to `NULL`. This breaks the live foreign key link, making the `completed_team_snapshot` the definitive source of truth for that assignment's historical team data.

### Visual Workflow

```mermaid
graph TD
    subgraph Assignment Lifecycle
        A[Assignment Deployed] -->|User action| B(Mark as "Completed");
    end

    subgraph "DB Trigger: sync_team_status_on_assignment_update"
        B --> C{Generate JSON Snapshot};
        C --> D[UPDATE assignments SET<br>completed_team_snapshot = json];
        D --> E[UPDATE teams SET<br>status = 'Staged'];
        E --> F[UPDATE assignments SET<br>team_id = NULL];
    end

    subgraph Result
        F --> G[Historical Record Preserved];
        E --> H[Team is Reusable];
    end
```

---

## 3. Snapshot Data Structure

To ensure the UI can render a completed assignment's team details exactly as they were, the snapshot must be comprehensive. The JSON object stored in `completed_team_snapshot` contains the following structure:

*   **Core Team Information**:
    *   `team_name_number`: The name of the team (e.g., "Ground 1").
    *   `type`: The team's functional type (e.g., "Ground", "Hasty").
    *   `status`: The team's status. This will be set to **"Reassigned"** within the snapshot to indicate that the team has completed this task and is available for new assignments.
    *   `leader_responder_id`: The UUID of the designated team leader.
    *   `leader_name`: The full name of the team leader.
    *   `equipment`: A JSON array of equipment strings.

*   **Team Members (JSON Array)**: A complete list of all responders on the team.
    *   *For each member*:
        *   `responder_id`: UUID
        *   `name`: Full Name
        *   `agency`: Agency affiliation
        *   `role`: Role on the team (e.g., "Team Leader", "Member").

*   **Team Vehicles (JSON Array)**: A complete list of all vehicles attached to the team.
    *   *For each vehicle*:
        *   `vehicle_id`: UUID
        *   `designation`: Vehicle call sign or designation.
        *   `type`: Type of vehicle.

---

## 4. UI Implementation Guide

To correctly display team information, UI components must become "snapshot-aware." This involves implementing conditional logic based on the assignment's status.

### Core Concept: Conditional Data Sourcing

When a component needs to display team information for an assignment, it must check the assignment's status:

1.  **If the assignment is `Active` (`Planned`, `Assigned`, `Deployed`):** The component should fetch team data using the live `team_id` foreign key, just as it does now.
2.  **If the assignment is `Terminal` (`Completed`, `Incomplete`):** The component must ignore the (now `NULL`) `team_id` and instead parse the `completed_team_snapshot` JSONB column to get the historical team data.

### Example (React Component)

The following conceptual code shows how a table cell component might determine which team name to display:

```javascript
const AssignmentTeamCell = ({ assignment, allTeams }) => {
  const isCompleted = assignment.status === 'Completed' || assignment.status === 'Incomplete';

  // If completed, use the snapshot. Otherwise, find the live team.
  const teamName = isCompleted
    ? assignment.completed_team_snapshot?.team_name_number
    : allTeams.find(t => t.team_id === assignment.team_id)?.team_name_number;

  const tooltipText = isCompleted
    ? `Leader: ${assignment.completed_team_snapshot?.leader_name}`
    : 'Live Team';

  return (
    <td title={tooltipText}>
      {teamName || '—'} {isCompleted && '(Completed)'}
    </td>
  );
};
```

This conditional rendering logic must be applied to all views that display assignment and team data, including dashboards, lists, and detail modals, to ensure the UI accurately reflects the historical state.