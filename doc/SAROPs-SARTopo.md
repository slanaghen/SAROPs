SARTopo Data Sync Instructions
Method 1: The Official Team API (Recommended for Integrations)
If you are developing a custom web application or connecting automated software, you must generate API credentials through a SARTopo/CalTopo Service Account. This requires Admin privileges on your organization's team account.
Step 1: Create a Service Account
Log into your SARTopo/CalTopo account.
Click on your username in the top left corner of the map viewer.
Click the Administer button to open the Team Admin page.
Navigate to the Details tab (scroll toward the bottom of the page).
Locate the Service Accounts section and click Create a Service Account.
Provide a functional title (e.g., Custom-SAR-App) and assign a permission level:
READ: Can view features and metadata.
UPDATE: Can add objects, but can't alter existing ones.
WRITE/MANAGE: Required if your app needs full edit, delete, or creation capabilities.
Click Create.
Step 2: Secure Your Credentials
As soon as you create the account, a dialog box will display your Credential Secret.
⚠️ Critical Note: This is the only time the secret key will ever be displayed. Copy it immediately and store it securely in your environment variables (.env). The Credential ID can be retrieved later, but the secret cannot.
Step 3: Extract the Team ID
To direct your API requests to maps housed within your organization, you need the unique Team ID (also known as the group hash).
Look at the browser URL while on your Team Admin members page.
The URL follows this format: https://caltopo.com/group/{your_team_ID}/admin/members
Copy that alphanumeric token to reference in your endpoint paths (e.g., /api/v1/acct/{team_id}/CollaborativeMap).
