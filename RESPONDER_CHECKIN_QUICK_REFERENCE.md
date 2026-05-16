# Responder Check-In Quick Reference

Copy-paste ready examples for common tasks.

## 1. BASIC CHECK-IN FORM

```typescript
import ResponderCheckin from '../components/ResponderCheckin';

function CheckInPage() {
  const handleCheckIn = async (responder) => {
    console.log('Checked in:', responder);
  };

  return (
    <ResponderCheckin 
      onCheckIn={handleCheckIn}
    />
  );
}
```

## 2. WITH SUPABASE INTEGRATION

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

## 3. WITH TEAM ASSIGNMENT

```typescript
import ResponderCheckinPage from '../pages/ResponderCheckinPage';

function IncidentPage({ incidentId, opPeriodId }) {
  return (
    <ResponderCheckinPage
      incidentId={incidentId}
      operationalPeriodId={opPeriodId}
      onResponderCheckedIn={(responder) => {
        // Navigate to team dashboard
        navigate('/dashboard');
      }}
    />
  );
}
```

## 4. DEVICE ID GENERATION

```typescript
// Device ID is auto-generated
// Format: device_<timestamp>_<random>
// Example: device_qh3ov_abc123def4

// Access from responder object
const { device_id } = responder;
console.log('Device tracking ID:', device_id);

// Use for offline tracking
const storedResponder = localStorage.getItem(responder.device_id);
```

## 5. CHECK OUT A RESPONDER

```typescript
import { checkOutResponder } from '../services/responderService';

async function handleCheckOut(responderId) {
  try {
    const updated = await checkOutResponder(supabase, responderId);
    console.log('Checked out:', updated);
  } catch (err) {
    console.error('Error:', err);
  }
}
```

## 6. GET ALL CHECKED-IN RESPONDERS

```typescript
import { getCheckedInResponders } from '../services/responderService';

async function loadResponders() {
  const responders = await getCheckedInResponders(supabase);
  console.log(`${responders.length} responders checked in`);
  responders.forEach(r => {
    console.log(`${r.name} - ${r.agency}`);
  });
}
```

## 7. SEARCH RESPONDERS

```typescript
import { searchResponders } from '../services/responderService';

const results = await searchResponders(supabase, 'John');
// Returns responders matching "John" in name or identifier
```

## 8. ASSIGN RESPONDER TO TEAM

```typescript
import { assignResponderToTeam } from '../services/responderService';

async function handleAssignTeam(responderId, teamId) {
  try {
    await assignResponderToTeam(supabase, responderId, teamId);
    console.log('Responder assigned to team');
  } catch (err) {
    console.error('Error:', err);
  }
}
```

## 9. REMOVE RESPONDER FROM TEAM

```typescript
import { removeResponderFromTeam } from '../services/responderService';

async function handleRemoveFromTeam(responderId, teamId) {
  try {
    await removeResponderFromTeam(supabase, responderId, teamId);
    console.log('Responder removed from team');
  } catch (err) {
    console.error('Error:', err);
  }
}
```

## 10. GET RESPONDER TEAM HISTORY

```typescript
import { getResponderTeamHistory } from '../services/responderService';

const history = await getResponderTeamHistory(supabase, responderId);
history.forEach(entry => {
  console.log(`${entry.teams.team_name_number}`);
  console.log(`  Attached: ${entry.attached_datetime}`);
  if (entry.detached_datetime) {
    console.log(`  Detached: ${entry.detached_datetime}`);
  }
});
```

## 11. GET RESPONDER'S CURRENT TEAM

```typescript
import { getResponderCurrentTeam } from '../services/responderService';

const assignment = await getResponderCurrentTeam(supabase, responderId);
if (assignment) {
  console.log('Team:', assignment.teams.team_name_number);
  console.log('Type:', assignment.teams.type);
} else {
  console.log('Responder not assigned to a team');
}
```

## 12. GET TEAM RESPONDERS

```typescript
import { getTeamResponders } from '../services/responderService';

const teamMembers = await getTeamResponders(supabase, teamId);
teamMembers.forEach(r => {
  console.log(`${r.name} (${r.agency})`);
});
```

## 13. GET RESPONDER STATISTICS

```typescript
import { getResponderStats } from '../services/responderService';

const stats = await getResponderStats(supabase);
console.log(`Total: ${stats.total}`);
console.log(`Checked in: ${stats.checkedIn}`);
console.log(`Deployed: ${stats.deployed}`);
console.log(`Debriefed: ${stats.debriefed}`);
```

## 14. BULK UPDATE RESPONDER STATUS

```typescript
import { bulkUpdateResponderStatus } from '../services/responderService';

const updated = await bulkUpdateResponderStatus(
  supabase,
  [responder1Id, responder2Id, responder3Id],
  'Deployed'
);
console.log(`Updated ${updated} responders`);
```

## 15. UPDATE RESPONDER STATUS

```typescript
import { updateResponderStatus } from '../services/responderService';

const updated = await updateResponderStatus(
  supabase,
  responderId,
  'Briefed'
);
console.log('Status:', updated.status);
```

## 16. GET RESPONDER BY ID

```typescript
import { getResponder } from '../services/responderService';

const responder = await getResponder(supabase, responderId);
if (responder) {
  console.log(`${responder.name} - ${responder.status}`);
} else {
  console.log('Responder not found');
}
```

## 17. GET RESPONDER BY DEVICE ID (OFFLINE TRACKING)

```typescript
import { getRespondersByDeviceId } from '../services/responderService';

const responder = await getRespondersByDeviceId(supabase, deviceId);
if (responder) {
  console.log('Found responder:', responder.name);
} else {
  console.log('Device not registered');
}
```

## 18. GET RESPONDERS BY AGENCY

```typescript
import { getRespondersByAgency } from '../services/responderService';

const sherifsOfficer = await getRespondersByAgency(
  supabase,
  "Sheriff's Office"
);
console.log(`Found ${sherifsOfficer.length} responders`);
```

## 19. GET RESPONDERS BY STATUS

```typescript
import { getRespondersByStatus } from '../services/responderService';

// Get all deployed responders
const deployed = await getRespondersByStatus(supabase, 'Deployed');
console.log(`${deployed.length} responders deployed`);

// Get all staged responders
const staged = await getRespondersByStatus(supabase, 'Staged');
console.log(`${staged.length} responders staged`);
```

## 20. RESPONDER STATUS LIFECYCLE

```typescript
// Responder statuses:
// 'Staged'     - Checked in, awaiting assignment
// 'Attached'   - Assigned to a team
// 'Assigned'   - Given specific assignment
// 'Briefed'    - Received operational briefing
// 'Deployed'   - In field conducting search
// 'Debriefed'  - Completed debrief after deployment
// 'CheckedOut' - Left the incident

import { updateResponderStatus } from '../services/responderService';

// Workflow example:
await updateResponderStatus(supabase, responderId, 'Staged');      // Check-in
await updateResponderStatus(supabase, responderId, 'Attached');    // Assign team
await updateResponderStatus(supabase, responderId, 'Briefed');     // Give briefing
await updateResponderStatus(supabase, responderId, 'Deployed');    // Deploy to field
await updateResponderStatus(supabase, responderId, 'Debriefed');   // Debrief
await updateResponderStatus(supabase, responderId, 'CheckedOut');  // Check-out
```

## 21. USE HOOK IN COMPONENT

```typescript
import { useResponderCheckin } from '../hooks/useResponderCheckin';

function MyComponent() {
  const {
    checkedInResponder,
    isCheckedIn,
    loading,
    error,
    checkIn,
    checkOut,
    reset,
  } = useResponderCheckin(supabase);

  if (isCheckedIn) {
    return (
      <div>
        <p>Welcome {checkedInResponder.name}!</p>
        <button onClick={() => checkOut(checkedInResponder.responder_id)}>
          Check Out
        </button>
      </div>
    );
  }

  return (
    <ResponderCheckin
      onCheckIn={checkIn}
      isLoading={loading}
      error={error}
    />
  );
}
```

## 22. RESPONDER FORM OBJECT

```typescript
import { v4 as uuidv4 } from 'uuid';

// Create responder object for direct save
const newResponder = {
  responder_id: uuidv4(),
  name: 'John Doe',
  agency: 'Fire Department',
  identifier: 'FD-1234',
  cell_phone: '(555) 123-4567',
  device_id: 'device_abc123_xyz789',
  checkin_datetime: new Date().toISOString(),
  checkout_datetime: null,
  status: 'Staged',
};

// Save directly
const { checkIn } = useResponderCheckin(supabase);
await checkIn(newResponder);
```

## 23. HANDLE FORM ERRORS

```typescript
function CheckInPage() {
  const [error, setError] = useState('');

  const handleCheckIn = async (responder) => {
    try {
      await checkInResponder(supabase, responder);
    } catch (err) {
      setError(err.message);
      // Show error to user
    }
  };

  return (
    <div>
      {error && <div className="error">{error}</div>}
      <ResponderCheckin onCheckIn={handleCheckIn} error={error} />
    </div>
  );
}
```

## 24. PERSIST CHECKED-IN RESPONDER TO LOCALSTORAGE

```typescript
const handleCheckIn = async (responder) => {
  // Check in to database
  await checkInResponder(supabase, responder);

  // Save to local storage for quick access
  localStorage.setItem('currentResponder', JSON.stringify(responder));
  localStorage.setItem('currentResponderDeviceId', responder.device_id);
};

// Retrieve later
const currentResponder = JSON.parse(
  localStorage.getItem('currentResponder') || 'null'
);
if (currentResponder) {
  console.log('Resuming as:', currentResponder.name);
}
```

## 25. RESPONDER DASHBOARD

```typescript
import { getCheckedInResponders } from '../services/responderService';

function ResponderDashboard() {
  const [responders, setResponders] = useState([]);

  useEffect(() => {
    const loadResponders = async () => {
      const data = await getCheckedInResponders(supabase);
      setResponders(data);
    };

    loadResponders();

    // Refresh every 10 seconds
    const interval = setInterval(loadResponders, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1>Checked-In Responders ({responders.length})</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Agency</th>
            <th>Status</th>
            <th>Check-In Time</th>
          </tr>
        </thead>
        <tbody>
          {responders.map(r => (
            <tr key={r.responder_id}>
              <td>{r.name}</td>
              <td>{r.agency}</td>
              <td>{r.status}</td>
              <td>{new Date(r.checkin_datetime).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## ENVIRONMENT VARIABLES

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

## REQUIRED PACKAGES

```bash
npm install @supabase/supabase-js uuid
```

## DATABASE SETUP

Run this SQL to create the responders table:

```sql
CREATE TABLE responders (
  responder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  agency TEXT NOT NULL,
  identifier TEXT NOT NULL,
  cell_phone TEXT,
  device_id TEXT NOT NULL UNIQUE,
  checkin_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  checkout_datetime TIMESTAMP WITH TIME ZONE,
  status responder_status NOT NULL DEFAULT 'Staged',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_responders_status ON responders(status);
CREATE INDEX idx_responders_device_id ON responders(device_id);
CREATE INDEX idx_responders_checkin ON responders(checkin_datetime);
```

## CSS CUSTOMIZATION

```css
/* Change gradient background */
.responder-checkin {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Change button color */
.btn-primary {
  background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%);
}

/* Change form container width */
.checkin-container {
  max-width: 800px;
}
```

## TESTING

```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test ResponderCheckin.test.js
```

## COMMON ISSUES & SOLUTIONS

**Issue:** Form not showing
- Solution: Ensure CSS file is imported

**Issue:** Database errors
- Solution: Check Supabase credentials in .env

**Issue:** Device ID not unique
- Solution: This shouldn't happen, but clear localStorage and try again

**Issue:** Phone validation too strict
- Solution: Edit validation regex in ResponderCheckin.tsx

**Issue:** Can't check out
- Solution: Verify responder_id is correct and exists in database
