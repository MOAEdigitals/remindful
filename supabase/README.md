# Supabase setup — pending connection

This directory prepares the backend. It has not been applied to a live project and the app still uses demo accounts and browser storage.

## Development setup

1. Connect the Supabase integration and choose or create a development project.
2. Apply `migrations/202610190001_accounts_and_sharing.sql` to a new database.
3. Run `tests/access-control.sql` as the project database owner. It rolls back its test users and records.
4. Configure Supabase Auth site and redirect URLs for the app and localhost.
5. Add real sign-in and a data adapter using the project URL and public publishable key. Never place a secret/service-role key in browser code or GitHub.
6. Test two real accounts and a third unrelated account before enabling real data.

## Rules

- Subscriptions, profiles, and appearance preferences are owner-only.
- A user has at most one connected partner.
- Generate a 7-day invitation code, share it yourself, and have your partner explicitly accept it. Creating a new code revokes previous pending codes. There is no automatic email or message sending.
- Only connected partners can see and add/edit/delete shared events on each other's schedules.
- Private events have no connection ID and are accessible only to their owner.
- Unrelated users have no access to your records.
- Both-schedule events belong to a specific owner and reference the active connection.
- Disconnecting detaches shared events from the connection; each event remains with its owner and former partners immediately lose access.
- Creating a connection does not automatically expose historical events. Sharing attaches an event to the active connection explicitly. The final default-sharing behavior still needs product confirmation.
- The live UI remains at the user's requested restored draft until backend integration can be completed and tested.

## API surface

Tables: `profiles`, `user_preferences`, `subscriptions`, `events` (CRUD under RLS); `partner_memberships` and `partner_connections` (read-only under RLS).

RPCs: `create_partner_invite()`, `accept_partner_invite(invite_code)`, `revoke_partner_invite(invite_code)`, `disconnect_partner()`.

The `private` schema must remain outside Supabase's exposed API schemas. Invite codes and authorization helpers are not application tables. Public RPCs explicitly check the signed-in caller. Helper functions pin their search paths and have restricted execution grants.

References: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/database/functions
