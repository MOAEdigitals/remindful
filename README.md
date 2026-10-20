# Remindful draft

A responsive, buildless web app draft with subscriptions, birthdays, church programs, personal reminders, three interchangeable layouts, light/dark/system themes, and two simulated partner accounts.

Run with Node.js:

```sh
npm run dev
```

Open http://127.0.0.1:4173. Run domain checks with `npm test`.

## Draft behavior

- Data is stored in browser localStorage. Account switching is a demo, not real authentication or secure account isolation.
- Both demo accounts can edit shared schedule entries. A private event is accessible only to its owner. Subscriptions are always owner-only within the demo UI.
- Shared-by-default event visibility is a draft assumption, configurable per event. This rule still needs final product confirmation.
- Settings remember all three layouts and theme preferences separately for each demo account.
- Browser notifications require permission and only check while the page is running. No closed-page push delivery or backend scheduling is implemented.
- Export includes the active demo account’s accessible records. Reset replaces both demo accounts’ local data.
- Prices and events are illustrative, not current service pricing.

## Next implementation stages

1. Review the draft and agree on sharing defaults.
2. Add Supabase Auth, schema migrations, and server-enforced subscription ownership and partner permissions. Add partner invitations and revocation.
3. Add scheduled web push with delivery logs, retries, timezone-aware scheduling, and recurrence handling.
4. Add server history, conflict handling, and recovery for partner edits/deletes.
5. Complete browser/mobile accessibility and delivery testing before Android integration.

The static draft does not require credentials or third-party application accounts.

## Backend preparation

The Supabase schema is deployed and its database access tests pass in the Remindful project under MARIUS. See [supabase/README.md](supabase/README.md) for deployment details. The UI remains the restored draft: real sign-in and the data adapter still need to be connected.

## Android interaction requirements

- Keep visible Edit and Delete buttons in the current web draft.
- In Android, use a consistent press-and-hold interaction on subscription and event entries across all four tabs to open an action menu with Edit and Delete.
- A long press opens the menu; deletion still requires an explicit Delete selection and confirmation, with recovery where supported.
- Provide an accessible alternative to long press, such as an item details action menu and screen-reader actions.
- Apply the same ownership and partner permissions regardless of how actions are opened.
