# Google Play Data Safety Draft

This is a draft for Play Console. Review it before submission.

## Data Collected

### App Activity
Collected: Yes

Examples:
- Planner settings such as selected load, duration, and cost assumptions are stored locally.
- Demo charger plans and command logs are stored in the backend when the demo connector is used.

Purpose:
- App functionality
- Analytics/support for demo connector behavior

Shared:
- No sale of data.
- Cloudflare acts as hosting/infrastructure service provider.

### Personal Info
Collected: No account name, email, phone number, or address in the current release.

### Location
Collected: No precise or approximate location permission.

### Financial Info
Collected: No payment card, bank account, credit, or purchase history.

### Device or Other IDs
Collected: The app creates a random app user ID in local storage for demo connector state. It does not use Android advertising ID.

Purpose:
- App functionality

## Security Practices

- Data is encrypted in transit over HTTPS.
- Users can request deletion of demo connector records through privacy@powerwindow.energy.
- The current release does not store real car or charger credentials.

## Notes Before Submission

- Confirm that privacy@powerwindow.energy is active before publishing.
- If real charger connectors are added later, update Data Safety for credentials, OAuth tokens, device status, and command history.
- If analytics SDKs are added later, update Data Safety for diagnostics and app interactions.
