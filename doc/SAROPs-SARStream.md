# SARStream Integration Specification

SARStream provides live video streaming and session management capabilities integrated directly into the SAROps platform. This document outlines the technical implementation, API specifications, and user workflow for the feature.

---

## 1. Feature Overview & Design Decisions

SARStream allows Incident Commanders and Staff to initialize a secure live video session for an active incident. When enabled, a "Live Feed" link becomes available in the application's top banner menu for all authenticated personnel.

---

## 2. Operational Workflow

1.  **Activation**: A Staff member or Admin toggles the **SARStream** checkbox on the **Incident Management** page (`/incident`).
2.  **Initialization**: The application automatically performs a `POST` request to the SARStream API.
3.  **Persistence**: The resulting session metadata (including the view URL) is saved to the `sarstream_data` field of the `operational_periods` table in Supabase.
4.  **Access**: Once active, a "Live Feed" link appears in the global banner menu for all users currently checked into the incident.
5.  **Termination**: If the toggle is turned off, or if the incident is ended, the session metadata (`sarstream_data`) is set to `NULL` and the `sarstream_enabled` flag is set to `false`.

---

## 3. Technical Specifications

### API Configuration
*   **Endpoint**: `https://sarstream.boulderrescue.app/api/links/view`
*   **Method**: `POST`
*   **Authentication**: Custom Header `X-API-Key` using the `VITE_SARSTREAM_API_KEY` environment variable.

### Frontend API (Supabase Edge Function)
*   **Invocation Path**: `/functions/v1/sarstream-proxy`
*   **Method**: `POST`
*   **Authentication**: The client must use the authenticated Supabase client to invoke the function, which passes the user's JWT for server-side validation.

### Request Payload
The client sends the following payload to the Supabase Edge Function:
```json
{
  "requester": "SAROPs",
  "ttl_minutes": 480,
  "label": "[Incident Name]"
}
```
*   `ttl_minutes`: Set to 480 (8 hours) by default to cover a standard operational shift.
*   `label`: Uses the current incident name for session identification.

### Response Handling
The JSON response from the SARStream API is stored in its entirety in the `incidents.sarstream_data` column (JSONB).

---

## 4. Development and Proxy Logic

To bypass browser CORS (Cross-Origin Resource Sharing) restrictions during local development, requests are routed through the application's development proxy if `VITE_PROXY_URL` is configured.

*   **Target Path**: `/sarstream/api/links/view`
*   **Proxy Mapping**: Configured in `vite.config.js` to forward requests to `https://sarstream.boulderrescue.app`.

---

## 5. UI Integration

### Incident Management Page
*   Located in the **Operational Period** section.
*   Displays a status indicator (🟢/🔴) based on the presence of a valid URL in the saved session data.

### Global Banner Menu
*   The "Live Feed" link is conditionally rendered in the hamburger menu.
*   **Visibility Logic**:
    ```javascript
    const showLiveFeed = incidentData?.sarstream && 
                        (incidentData?.sarstream_data?.url || incidentData?.sarstream_data?.view_url);
    ```

---

## 6. Security Note
The `VITE_SARSTREAM_API_KEY` is a sensitive credential. While currently used in the client-side `fetch` via the development proxy, it is recommended to move this transaction to a **Supabase Edge Function** in future iterations to ensure the API key is never exposed to the client-side bundle.

---
*Last updated: June 2026*