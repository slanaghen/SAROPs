Google Data Sync Instructions
Step 1: Create a Google Cloud Project
Before generating any keys, you must have a project container active in Google Cloud.
Go to the Google Cloud Console.
Log in with your Google account.
Click the project dropdown in the top-left corner (next to the Google Cloud logo) and click New Project.
Give your project a recognizable name (e.g., SARTopo-Sheets-Integration) and click Create.
Step 2: Enable the Google Sheets API
Your new project cannot talk to spreadsheets until you explicitly turn on the mapping engine.
Make sure your new project is selected in the top dropdown menu.
Click the Navigation Menu (☰) in the top-left corner, hover over APIs & Services, and select Library.
In the search bar, type Google Sheets API and hit enter.
Click on the Google Sheets API card in the results.
Click the blue Enable button. (If your app also needs to search for files or look up spreadsheet URLs dynamically, repeat this exact step to search for and enable the Google Drive API as well).
Step 3: Generate Your Credentials
Choose the option below that fits your application's privacy requirements:
Option A: Generate an API Key (Public / Read-Only Only)
Go to ☰ -> APIs & Services -> Credentials.
Click the + Create Credentials button at the top of the screen and select API key.
A dialog box will pop up displaying your newly generated string (e.g., AIzaSyD...). Copy this key.
Critical Security Step: Click Restrict Key in that dialog box. Under "API restrictions", select Restrict key, choose Google Sheets API from the dropdown, and save. This ensures that if your key is ever leaked in your frontend code, malicious actors cannot use it to run up charges on your account using other Google Cloud services.
Option B: Generate a Service Account (Private / Read & Write)
Go to ☰ -> APIs & Services -> Credentials.
Click + Create Credentials and select Service account.
Fill in a name (e.g., sheets-sync-bot). The system will automatically generate a unique email address for it (e.g., sheets-sync-bot@your-project.iam.gserviceaccount.com). Click Create and Continue.
Skip the optional role assignments by clicking Continue, then click Done.
You will be taken back to the main Credentials management screen. Look at the bottom under the Service Accounts table list and click on your newly created service account email string.
Switch to the Keys tab running across the top sub-menu.
Click Add Key -> Create new key.
Select JSON as your format type and click Create.
A configuration file (e.g., your-project-xyz.json) will automatically download to your computer. Keep this file incredibly secure—it contains the private cryptographic tracking keys your backend environment needs to securely sign write requests to Google Sheets.
Step 4: Authorize Your Service Account (If using Option B)
Because a Service Account acts like an independent user, it doesn't automatically have access to your personal spreadsheets.
To let your script write data to a specific sheet:
Open the downloaded .json file and copy the "client_email" string value.
Open the specific Google Sheet your app wants to target in your web browser.
Click the blue Share button in the top right corner.
Paste the service account's email address into the invite box, set their permission role level explicitly to Editor, uncheck "Notify people", and click Share.
Your integration framework is now fully authorized to execute programmatic spreadsheet changes via your backend functions.
