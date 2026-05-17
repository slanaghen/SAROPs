# Planning Dashboard Component

## Overview

The Planning Dashboard is a React component for the SAROps webapp that displays staged teams and allows operators to map teams to search assignments. It provides an intuitive interface for managing team-to-assignment mappings during incident response.

## Components

### PlanningDashboard.jsx
**Main component** that renders the planning interface.

**Props:**
- `operationalPeriodId` (string, required): UUID of the current operational period
- `teams` (Team[], default: []): Array of Team objects
- `assignments` (Assignment[], default: []): Array of Assignment objects
- `responders` (Responder[], default: []): Array of Responder objects (used for leader names)
- `onTeamAssigned` (function, optional): Callback when a team is assigned to an assignment

**Features:**
- Displays only teams with `status: 'Staged'`
- Shows available (unassigned) assignments
- Displays team metadata: name, type, color indicator, leader, member count, equipment
- Displays assignment details: name, status, SARTopo ID
- Provides visual feedback on selection
- Handles error states and success messages
- Accessible UI with keyboard support and ARIA labels

**Example:**
```jsx
<PlanningDashboard
  operationalPeriodId="op-uuid-123"
  teams={teamsList}
  assignments={assignmentsList}
  responders={respondersList}
  onTeamAssigned={async (mapping) => {
    // Handle the team assignment
    await updateAssignmentTeam(mapping.assignmentId, mapping.teamId);
  }}
/>
```

### usePlanningDashboard Hook
**Custom React hook** that manages state and Supabase interactions.

**Parameters:**
- `supabaseClient`: Initialized Supabase client
- `operationalPeriodId`: UUID of the operational period

**Returns:**
```javascript
{
  // State
  teams,                      // Team[]
  assignments,                // Assignment[]
  responders,                 // Responder[]
  loading,                    // boolean
  error,                      // string | null

  // Methods
  fetchDashboardData,         // () => Promise<void>
  assignTeamToAssignment,     // (teamId, assignmentId) => Promise<{success: true}>
  unassignTeam,               // (assignmentId) => Promise<{success: true}>
  updateTeamStatus,           // (teamId, newStatus) => Promise<{success: true}>

  // Computed
  stagedTeams,                // Team[] (filtered to status='Staged')
  availableAssignments,       // Assignment[] (filtered to unassigned, not orphaned)
}
```

**Example:**
```jsx
const { 
  teams, 
  assignTeamToAssignment, 
  fetchDashboardData 
} = usePlanningDashboard(supabase, operationalPeriodId);

// Fetch data on mount
useEffect(() => {
  fetchDashboardData();
}, [operationalPeriodId, fetchDashboardData]);

// Assign team to assignment
const handleAssign = async (teamId, assignmentId) => {
  try {
    await assignTeamToAssignment(teamId, assignmentId);
  } catch (err) {
    console.error('Assignment failed:', err);
  }
};
```

## Styling

The component uses modular CSS with the following features:
- Responsive grid layout (2 columns on desktop, 1 on mobile)
- Color-coded team types (Ground Search, UAS, Dogs, Transport, Helicopter)
- Status badges for assignments
- Visual feedback on selection and hover
- Accessibility features (focus states, high contrast)
- Custom scrollbars for lists
- Animation for alerts

**Key CSS Classes:**
- `.planning-dashboard`: Main container
- `.team-card`: Individual team display
- `.assignment-card`: Individual assignment display
- `.action-panel`: Action buttons and selection summary
- `.alert-error` / `.alert-success`: Alert messages

## Installation & Setup

### 1. Install Dependencies
```bash
npm install @supabase/supabase-js
```

### 2. Environment Variables
Create a `.env` file with:
```
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Create Directory Structure
```
src/
  components/
    PlanningDashboard.jsx
  styles/
    PlanningDashboard.css
  hooks/
    usePlanningDashboard.js
  pages/
    PlanningDashboardPage.jsx
```

### 4. Database Setup

Ensure your Supabase database has the tables created using the `sarops-schema.sql` file:

**Required tables:**
- `teams` (team_id, op_period_id, team_name_number, status, leader_responder_id, etc.)
- `assignments` (assignment_id, op_period_id, team_id, status, is_orphaned, etc.)
- `responders` (responder_id, name, agency, etc.)
- `operational_periods` (op_period_id, incident_id, etc.)

**Row Level Security (RLS) Policy Example:**
```sql
-- Allow authenticated users to view teams in their operational period
CREATE POLICY "Users can view teams"
ON teams FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to create new teams
CREATE POLICY "Users can create teams"
ON teams FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to update team assignments
CREATE POLICY "Users can update assignments"
ON assignments FOR UPDATE
USING (auth.uid() IS NOT NULL);
```

## Data Flow

```
User Interface
    ↓
PlanningDashboard Component
    ↓
onTeamAssigned callback
    ↓
PlanningDashboardPage.jsx (handles update)
    ↓
usePlanningDashboard Hook
    ↓
assignTeamToAssignment()
    ↓
Supabase REST API
    ↓
PostgreSQL Database
    ↓
Teams & Assignments Updated
```

## Example Implementation

See `PlanningDashboardPage.jsx` for a complete example that integrates:
- Supabase client initialization
- Data fetching on mount
- Error handling
- Real-time subscription setup (commented)

## Features

### Selection & Assignment
- Click a team card to select it
- Click an assignment card to select it
- Both selections are highlighted
- Summary shows current selections
- "Assign Team to Assignment" button becomes enabled when both are selected

### Status Management
- Teams: Draft → Staged → Assigned → Deployed → Demobilized
- Assignments: Draft → Planned → Assigned → Deployed → Completed
- Component auto-advances statuses on assignment

### Visual Indicators
- Team color hex from SARTopo
- Team type badges with semantic colors
- Assignment status badges
- Selection highlighting
- Hover effects

### Accessibility
- Keyboard navigation (Tab, Enter)
- ARIA labels for screen readers
- Focus indicators on interactive elements
- Color not the only indicator (icons + text)

### Error Handling
- Validation before assignment
- User-friendly error messages
- Network error recovery
- Try/catch blocks with proper logging

## Responsive Design

**Desktop (>1024px):**
- Two-column grid layout
- Teams on left, assignments on right
- Full-width action panel

**Tablet (768px-1024px):**
- One-column layout
- Teams, then assignments, then actions
- Optimized spacing

**Mobile (<768px):**
- Single column
- Stack all sections
- Larger touch targets

## TypeScript Support

If you want to add TypeScript, create `PlanningDashboard.d.ts`:
```typescript
import { FC } from 'react';
import { Team, Assignment, Responder } from '../types/sarops-types';

interface PlanningDashboardProps {
  operationalPeriodId: string;
  teams?: Team[];
  assignments?: Assignment[];
  responders?: Responder[];
  onTeamAssigned?: (mapping: TeamAssignmentMapping) => Promise<void>;
}

interface TeamAssignmentMapping {
  teamId: string;
  assignmentId: string;
  team: Team;
  assignment: Assignment;
}

declare const PlanningDashboard: FC<PlanningDashboardProps>;
export default PlanningDashboard;
```

## Performance Optimization

For large datasets, consider:
1. Virtualization: Use `react-virtual` for long lists
2. Memoization: Wrap component with `React.memo()`
3. Pagination: Load teams/assignments in batches
4. Debouncing: Debounce search/filter operations
5. Caching: Cache API responses with React Query or SWR

## Future Enhancements

- [ ] Search/filter teams and assignments
- [ ] Bulk assignment operations
- [ ] Drag-and-drop team-to-assignment mapping
- [ ] Team composition editor (manage responders on team)
- [ ] Assignment cloning
- [ ] Undo/redo for assignments
- [ ] Real-time collaboration indicators
- [ ] Export operations plan

## Troubleshooting

**Teams not appearing?**
- Check that teams have `status = 'Staged'`
- Verify `op_period_id` matches current operational period
- Check Supabase RLS policies

**Assignments won't update?**
- Verify Supabase connection
- Check RLS policies for UPDATE permission
- Ensure `assignment_id` exists in database
- Review browser console for errors

**Styling issues?**
- Ensure `PlanningDashboard.css` is imported in the component
- Check that CSS module paths are correct
- Verify no conflicting global styles

**Performance issues?**
- Use React DevTools Profiler to identify bottlenecks
- Consider virtualizing long lists
- Optimize Supabase queries (indexes, filters)
- Implement pagination for large datasets

## License

Part of SAROps - Search and Rescue Operations Platform
