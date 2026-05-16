# Responder Check-In Component Documentation

Complete guide for implementing the Responder Check-In system in SAROps.

## Overview

The Responder Check-In component allows search and rescue personnel to register their arrival at an incident. It captures personal information, generates a unique device ID for offline tracking, and facilitates optional team assignment.

## Features

✅ **Form Validation** - Real-time validation of all required fields
✅ **Confirmation Screen** - Review information before submitting
✅ **Device ID Generation** - Unique identifier for offline tracking
✅ **Status Management** - Automatically sets responder status to 'Staged'
✅ **Team Assignment** - Optional integration with team assignment
✅ **Responsive Design** - Works on all device sizes
✅ **Accessibility** - Full ARIA support and keyboard navigation
✅ **Error Handling** - User-friendly error messages
✅ **Dark Mode Support** - Automatic dark mode styling

## Components & Files

### [src/components/ResponderCheckin.tsx](src/components/ResponderCheckin.tsx)
Main form component for check-in.

**Props:**
```typescript
interface ResponderCheckinProps {
  onCheckIn?: (responder: Responder) => Promise<void> | void;
  isLoading?: boolean;
  error?: string | null;
  successMessage?: string | null;
}
```

**Features:**
- Form inputs: Name, Agency, Identifier, Cell Phone
- Real-time validation
- Confirmation screen before submission
- Device ID generation
- ISO timestamp capture

### [src/hooks/useResponderCheckin.ts](src/hooks/useResponderCheckin.ts)
Custom React hook for state management.

**Returns:**
```typescript
{
  checkedInResponder: Responder | null;
  isCheckedIn: boolean;
  loading: boolean;
  error: string | null;
  checkIn: (responder: Responder) => Promise<Responder>;
  checkOut: (responderId: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}
```

### [src/services/responderService.ts](src/services/responderService.ts)
Supabase service with 15+ utility functions:
- `checkInResponder()` - Save check-in to database
- `checkOutResponder()` - Record checkout
- `updateResponderStatus()` - Change status
- `getCheckedInResponders()` - List active responders
- `assignResponderToTeam()` - Add to team
- `removeResponderFromTeam()` - Remove from team
- `getResponderTeamHistory()` - Audit trail
- `searchResponders()` - Find by name/ID
- `getResponderStats()` - Statistics

### [src/pages/ResponderCheckinPage.jsx](src/pages/ResponderCheckinPage.jsx)
Full page component with Supabase integration and team assignment.

### [src/styles/ResponderCheckin.css](src/styles/ResponderCheckin.css)
Professional styling with gradient background, smooth animations, and responsive design.

## Data Schema

### Responder Interface
```typescript
interface Responder {
  responder_id: string;           // UUID (auto-generated)
  name: string;                   // Full name
  agency: string;                 // Organization
  identifier: string;             // Badge #, Call sign, etc.
  cell_phone: string;             // Phone number
  device_id: string;              // Unique device identifier
  checkin_datetime: string;       // ISO timestamp
  checkout_datetime: string | null; // ISO timestamp (null until checkout)
  status: ResponderStatus;        // 'Staged', 'Attached', 'Assigned', etc.
}
```

### Device ID Generation
```typescript
// Format: device_<timestamp_36>_<random>
// Example: device_qh3ov_abc123def4
// Purpose: Offline tracking, session management
```

## Installation & Setup

### 1. Install Dependencies
```bash
npm install @supabase/supabase-js uuid
```

### 2. Ensure Database Tables Exist
Run `sarops-schema.sql` to create:
- `responders` table
- `team_responders` table
- `responder_team_history` table

### 3. Set Up Environment Variables
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. File Structure
```
src/
  components/
    ResponderCheckin.jsx
  styles/
    ResponderCheckin.css
  hooks/
    useResponderCheckin.ts
  services/
    responderService.ts
  pages/
    ResponderCheckinPage.jsx
```

## Usage Examples

### Basic: Standalone Component
```typescript
import ResponderCheckin from '../components/ResponderCheckin';

function MyPage() {
  const handleCheckIn = async (responder) => {
    console.log('Responder checked in:', responder);
    // Save to your database or state
  };

  return <ResponderCheckin onCheckIn={handleCheckIn} />;
}
```

### Intermediate: With Supabase
```typescript
import { createClient } from '@supabase/supabase-js';
import { useResponderCheckin } from '../hooks/useResponderCheckin';
import ResponderCheckin from '../components/ResponderCheckin';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

function CheckInPage() {
  const { checkIn, loading, error } = useResponderCheckin(supabase);

  return (
    <ResponderCheckin
      onCheckIn={checkIn}
      isLoading={loading}
      error={error}
    />
  );
}
```

### Advanced: With Team Assignment
```typescript
import ResponderCheckinPage from '../pages/ResponderCheckinPage';

function IncidentPage({ incidentId, operationalPeriodId }) {
  return (
    <ResponderCheckinPage
      incidentId={incidentId}
      operationalPeriodId={operationalPeriodId}
      onResponderCheckedIn={(responder) => {
        console.log('Responder ready:', responder);
        // Navigate to next screen or dashboard
      }}
    />
  );
}
```

## Service Usage

### Check In a Responder
```typescript
import { checkInResponder } from '../services/responderService';

const responder = await checkInResponder(supabase, {
  responder_id: uuidv4(),
  name: 'John Doe',
  agency: 'Sheriff\'s Office',
  identifier: 'S-1234',
  cell_phone: '(555) 123-4567',
  device_id: 'device_abc123_xyz789',
  checkin_datetime: new Date().toISOString(),
  checkout_datetime: null,
  status: 'Staged',
});
```

### Get Checked-In Responders
```typescript
import { getCheckedInResponders } from '../services/responderService';

const responders = await getCheckedInResponders(supabase);
console.log(`${responders.length} responders checked in`);
```

### Assign to Team
```typescript
import { assignResponderToTeam } from '../services/responderService';

await assignResponderToTeam(supabase, responderId, teamId);
```

### Get Team History
```typescript
import { getResponderTeamHistory } from '../services/responderService';

const history = await getResponderTeamHistory(supabase, responderId);
history.forEach(entry => {
  console.log(`Attached: ${entry.attached_datetime}`);
  if (entry.detached_datetime) {
    console.log(`Detached: ${entry.detached_datetime}`);
  }
});
```

## Form Flow

```
Start
  ↓
User enters form data
  ↓
Real-time validation
  ↓
User submits
  ↓
Validate all fields
  ↓
Create Responder object
  ↓
Show confirmation screen
  ↓
User confirms
  ↓
Save to database (via onCheckIn callback)
  ↓
Show success message
  ↓
Reset form / navigate to next step
```

## Validation Rules

| Field | Rule | Example |
|-------|------|---------|
| Name | Required, min 2 chars | "John Smith" |
| Agency | Required, min 2 chars | "Fire Department" |
| Identifier | Required, unique per responder | "S-1234" or "Unit-5" |
| Cell Phone | Required, valid phone format | "(555) 123-4567" |

## Styling

### CSS Classes
- `.responder-checkin` - Root container
- `.checkin-form` - Form wrapper
- `.form-group` - Input group
- `.confirmation-screen` - Confirmation view
- `.detail-item` - Confirmation details
- `.btn-primary` / `.btn-secondary` - Buttons
- `.alert-error` / `.alert-success` - Alerts

### Customization
```css
/* Override gradient background */
.responder-checkin {
  background: linear-gradient(135deg, #your-color1 0%, #your-color2 100%);
}

/* Override button color */
.btn-primary {
  background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%);
}
```

## Responsive Breakpoints

- **Desktop (>600px):** 2-column layouts, full sizing
- **Tablet (400px-600px):** Single column, optimized spacing
- **Mobile (<400px):** Touch-friendly sizing, reduced font size

## Accessibility

✅ **ARIA Labels** - All interactive elements labeled
✅ **Keyboard Navigation** - Tab through form fields, Enter to submit
✅ **Focus Management** - Clear focus indicators
✅ **Color Contrast** - WCAG AA compliant
✅ **Screen Reader Support** - Semantic HTML structure
✅ **Motion Preferences** - Respects `prefers-reduced-motion`

## Error Handling

### Validation Errors
```
"Name is required"
"Please enter a valid phone number"
"Identifier is required (e.g., badge number, radio call sign)"
```

### Database Errors
```
"Database error: ..."
"Failed to create responder record"
"Failed to check out responder"
```

### Recovery
- All errors are clearable by user
- Form remains filled on error
- User can edit and resubmit

## Offline Support

The device ID enables offline check-in tracking:

1. **Offline:** Store check-in locally (IndexedDB)
2. **Online:** Sync via `checkInResponder()` service
3. **Tracking:** Match device_id to identify responder sessions

```typescript
// Get responder by device ID (useful for offline scenarios)
const responder = await getRespondersByDeviceId(supabase, device_id);
```

## Database Row Level Security

### Recommended RLS Policies

```sql
-- Allow authenticated users to view responders
CREATE POLICY "Users can view responders"
ON responders FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to insert responders
CREATE POLICY "Users can check in responders"
ON responders FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to update responders
CREATE POLICY "Users can update responders"
ON responders FOR UPDATE
USING (auth.uid() IS NOT NULL);
```

## Performance Optimization

### Queries
```typescript
// Use indexes on:
- responder_id (primary key)
- device_id (for offline lookup)
- status (for filtering)
- checkin_datetime (for sorting)

// Example indexed query
const { data } = await supabase
  .from('responders')
  .select('*')
  .eq('status', 'Staged')
  .order('checkin_datetime', { ascending: false })
  .limit(50);
```

### Caching
```typescript
// Cache checked-in responders
const cache = new Map();

const getResponders = async () => {
  if (cache.has('checked_in')) {
    return cache.get('checked_in');
  }
  
  const responders = await getCheckedInResponders(supabase);
  cache.set('checked_in', responders);
  
  // Clear cache after 5 minutes
  setTimeout(() => cache.delete('checked_in'), 300000);
  
  return responders;
};
```

## Testing

### Unit Test Example
```typescript
describe('ResponderCheckin', () => {
  test('validates name field', () => {
    const { getByPlaceholderText, getByText } = render(
      <ResponderCheckin />
    );
    
    fireEvent.click(getByText('Continue to Confirmation'));
    expect(getByText('Name is required')).toBeInTheDocument();
  });

  test('generates unique device ID', () => {
    const responder1 = createResponderObject();
    const responder2 = createResponderObject();
    expect(responder1.device_id).not.toBe(responder2.device_id);
  });
});
```

### Integration Test Example
```typescript
test('checks in responder to database', async () => {
  const { getByText, getByPlaceholderText } = render(
    <ResponderCheckinPage incidentId="inc-123" />
  );
  
  // Fill form
  fireEvent.change(getByPlaceholderText('First and Last Name'), {
    target: { value: 'John Doe' },
  });
  // ... fill other fields
  
  // Submit
  fireEvent.click(getByText('Continue to Confirmation'));
  fireEvent.click(getByText('Confirm Check-In'));
  
  // Verify in database
  const responders = await getCheckedInResponders(supabase);
  expect(responders).toContainEqual(
    expect.objectContaining({ name: 'John Doe' })
  );
});
```

## Troubleshooting

### Form Not Submitting
- Check all required fields are filled
- Verify phone number format
- Check browser console for errors

### Can't Save to Database
- Verify Supabase credentials in .env
- Check Row Level Security policies
- Ensure `responders` table exists
- Check network tab for API errors

### Device ID Not Generating
- Verify browser allows localStorage
- Check for JavaScript errors in console
- Ensure navigator API is available

### Styling Issues
- Verify CSS file is imported
- Check for conflicting global styles
- Use browser DevTools to inspect elements
- Test in different browsers

## Real-World Scenarios

### Scenario 1: First Responder Arrival
1. Responder arrives at incident
2. Opens SAROps on tablet/phone
3. Fills in check-in form
4. Reviews confirmation
5. Confirms and gets assigned to team
6. Receives operational briefing

### Scenario 2: Offline Check-In
1. No internet available
2. Responder checks in offline (stored locally)
3. Device ID generated for tracking
4. Later: Online sync happens automatically
5. Check-in recorded with device_id for audit

### Scenario 3: Multi-Incident Operations
1. Responder checks in to Incident A
2. Later checks out from Incident A
3. Checks in to Incident B
4. History tracked across incidents

## See Also
- [sarops-types.d.ts](sarops-types.d.ts) - Type definitions
- [sarops-schema.sql](sarops-schema.sql) - Database schema
- [PLANNING_DASHBOARD_README.md](PLANNING_DASHBOARD_README.md) - Team assignment
- [OFFLINE_CLUE_STORAGE_README.md](OFFLINE_CLUE_STORAGE_README.md) - Offline support
