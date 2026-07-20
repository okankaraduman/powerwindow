# Google Play Data Safety Draft

This is a draft for Play Console. Review it before submission.

## Data Collected

### App Activity
Collected: Yes

Examples:
- Planner settings such as selected load, duration, and cost assumptions are stored locally.
- Demo charger plans and command logs are stored in the backend when the demo connector is used.
- If the user allows analytics, Google Analytics measures page views and basic app interaction
  patterns.

Purpose:
- App functionality
- Analytics and product improvement
- Support for demo connector behavior

Shared:
- No sale of data.
- Cloudflare acts as hosting/infrastructure service provider.
- Google acts as analytics service provider only after the user allows analytics.

### Personal Info
Collected: No account name, email, phone number, or address in the current release.

### Location
Collected: No precise or approximate location permission.

### Financial Info
Collected: No payment card, bank account, credit, or purchase history.

### Device or Other IDs
Collected: The app creates a random app user ID in local storage for demo connector state. If
analytics is allowed, Google Analytics may use app/browser identifiers for measurement. The app
does not use Android advertising ID.

Purpose:
- App functionality
- Analytics

## Security Practices

- Data is encrypted in transit over HTTPS.
- Users can request deletion of demo connector records through privacy@powerwindow.energy.
- The current release does not store real car or charger credentials.

## Notes Before Submission

- Confirm that privacy@powerwindow.energy is active before publishing.
- If real charger connectors are added later, update Data Safety for credentials, OAuth tokens, device status, and command history.
- Confirm the final Google Analytics and Play Console classifications before production release.
