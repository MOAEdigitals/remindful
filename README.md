# Remindful

A responsive web app with subscriptions, birthdays, church programs, personal reminders, three interchangeable layouts, and light/dark/system themes. The pending real-account release uses Supabase Auth and Postgres instead of simulated accounts and browser-only records.

Run with Node.js:

```sh
npm run dev
```

Open http://127.0.0.1:4173. Run domain checks with `npm test`.

## Real-account release (deployment pending)

- Sign in with a username and password. Accounts are created by the owner from Profile → Settings; there is no public signup or email recovery.
- Subscriptions and preferences are owner-only under database RLS. Shared schedule entries require an active partner connection. Private events remain owner-only.
- Partner invitation codes expire after seven days and are accepted explicitly. New nonprivate events are shared with the current connected partner. Older unshared records are not automatically exposed upon pairing.
- Changes are saved to Supabase before the UI reports success. Accessible records refresh when returning to the page and every 30 seconds while viewing a tab.
- Settings are reached from the header profile button. The owner can create accounts and reset another account's password. Users change their own password by entering their current password.
- Browser notifications require permission and only check while the page is running. No closed-page push delivery or backend scheduling is implemented.
- Export includes only records available to the signed-in account. No sample records are inserted. Existing browser demo storage is left untouched and is not uploaded automatically.
- Browser storage holds the Supabase session and notification deduplication ledger, not subscription or event records.

## Next implementation stages

1. Approve/deploy the restricted account-management endpoint, establish the owner with a single-use setup link, and verify two real accounts end to end.
2. Add scheduled web push with delivery logs, retries, timezone-aware scheduling, and recurrence handling.
3. Add server history, conflict handling, and recovery for partner edits/deletes.
4. Complete browser/mobile accessibility and delivery testing before Android integration.

The browser uses only a public publishable key. Administrator credentials are environment variables available only to the account-management Edge Function. The first owner setup link must be generated separately and must never be committed to GitHub.

## Backend preparation

The Supabase schema is deployed in the Remindful project under MARIUS. See [supabase/README.md](supabase/README.md) for deployment and verification status. The public site remains the demo until the new endpoint is approved and real-account validation is complete.

## Android interaction requirements

- Keep visible Edit and Delete buttons in the current web draft.
- In Android, use a consistent press-and-hold interaction on subscription and event entries across all four tabs to open an action menu with Edit and Delete.
- A long press opens the menu; deletion still requires an explicit Delete selection and confirmation, with recovery where supported.
- Provide an accessible alternative to long press, such as an item details action menu and screen-reader actions.
- Apply the same ownership and partner permissions regardless of how actions are opened.
