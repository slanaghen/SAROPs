# SAROps: Team Management Guide

In SAROps, a **Team** is a fundamental operational unit composed of responders and, optionally, vehicles. Teams are the primary resource assigned to carry out specific tasks (Assignments) during an incident. This document outlines the complete lifecycle of a team, from its creation to its final status.

## Team Statuses

A team's status reflects its current state within the operational period. The status dictates what actions can be performed with the team and automatically synchronizes the status of its assigned members.

**Staged**: The team has been created but is not yet assigned to a task. It is available for deployment. Responders on a Staged team have their status automatically set to `Attached`.
| **Assigned**: The team has been linked to a specific assignment but has not yet begun fieldwork. Responders on an Assigned team have their status automatically set to `Assigned`.
| **Deployed**: The team is actively working on its assignment in the field. This status activates the Personnel Accountability Report (PAR) timer. Responders on a Deployed team have their status automatically set to `Deployed`.
| **Disbanded**: The team has completed its assignment or has been stood down. All members and vehicles are released and their statuses are reset to `Staged`. The team record is preserved for historical purposes.

---

## Creating and Editing a Team

Teams are managed primarily through the **Planning Dashboard** or the **Admin Page**.

### Creating a New Team

1.  **Initiation**: Click the "New Team" button on either the Planning Dashboard or the Admin Page. This opens the **Team Form Modal**.
2.  **Team Type**: Select a type from the dropdown (e.g., Ground, K9, UAS). The system prevents the creation of more than one "Staff" team per operational period.
3.  **Team Name**: You can enter a custom name (e.g., "Ridge Runners"). If left blank, a name will be auto-generated based on its type and a sequential number (e.g., "Ground 2").
4.  **Leader Assignment**: A team **must** have a leader. Drag a responder from the "Staged Responders" pool to the "Team Leader" (or "Incident Commander" for Staff) slot. The save buttons will remain disabled until a leader is assigned.
5.  **Adding Members**:
    *   Drag responders from the "Staged Responders" pool to the "Team Members" area.
    *   For each member, you can optionally assign a specific role (e.g., "Radio Operator", "Medic").
6.  **Adding Vehicles**: Drag vehicles from the "Staged Vehicles" pool to the "Team Vehicles" list.
7.  **Equipment**: List any non-tracked equipment in the equipment text field (e.g., "Rope Kit, Stokes Litter").
8.  **Saving**:
    *   **Save & Exit**: Saves the team and closes the modal.
    *   **Save & Add Another**: Saves the team and immediately opens a new, blank form.

### Editing an Existing Team

Editing a team is similar to creating one. Click on any team card in the Planning or Operations dashboards, or use the "Edit" action in the Admin page tables. This opens the same **TeamFormModal**, pre-populated with the team's current information.

*   **Members & Vehicles**: You can add or remove members and vehicles using drag-and-drop. To remove a resource, drag it from the team list back to the corresponding "Staged" pool at the bottom of the modal.
*   **Status Changes**: For existing teams, the "Status" dropdown is enabled, allowing authorized users to manually change the team's status (e.g., from "Staged" to "Assigned").

---

## Attaching Responders

Responders must be in a `Staged` status to be added to a team. This prevents a single person from being assigned to multiple teams simultaneously.

There are two primary methods for attaching responders:

1.  **Drag-and-Drop on the Planning Dashboard**: Drag a responder card from the "Staged Responders" list and drop it directly onto a team card. This immediately adds them to the team as a general member.
2.  **Drag-and-Drop within the Team Form Modal**: This method offers more control.
    *   **Assigning a Leader**: Drag a responder to the designated "Team Leader" or "Incident Commander" slot.
    *   **Assigning a Specific Role (Staff Team)**: Drag a responder to a predefined role slot (e.g., "Operations Section Chief").
    *   **Adding a General Member**: Drag a responder to the general members area, where you can then assign a custom role.

---

## Disbanding a Team

Disbanding a team is the standard procedure for releasing its resources back to the incident pool. It is a non-destructive action.

*   **Action**: A user clicks the "Disband" button on the Operations or Admin dashboard.
*   **Condition**: A team cannot be disbanded if its status is `Deployed`. It must first be moved to `Assigned` or `Staged`.
*   **Result**:
    *   The team's status is set to `Disbanded`.
    *   All assigned responders have their status automatically changed back to `Staged`.
    *   All attached vehicles are unlinked and become available.
    *   The team record remains in the database for reporting and historical tracking but is no longer considered an active resource.

---

## Special Case: The Staff Team

The **Staff Team** is a unique, singleton team that represents the incident's command and general staff. It has special properties and behaviors:

*   **Singleton**: Only one team with the type `Staff` can exist within an operational period. The UI prevents the creation of a second one.
*   **Automatic Creation**: A `Staff` team is automatically created when a new operational period begins.
*   **Predefined Roles**: Unlike other teams, the Staff team has a fixed list of ICS roles (Incident Commander, Operations Section Chief, etc.). Responders are assigned to these specific slots rather than being added as general members.
*   **First Responder Logic**: The first responder to check into a new incident is automatically made the **Incident Commander** and placed in the Staff team.
*   **Broadcasts**: Messages sent to the Staff team are treated as "Broadcast" messages and are visible to all personnel in the incident.

This structure ensures a clear and consistent command hierarchy is established and maintained for every operational period.