# Supabase database setup

The database is deployed to **Remindful** under **MARIUS** (project `kfdohhtqyboffcvgvjei`, Tokyo). Username sign-in, cloud data access, profile settings, and account-management source are prepared. Their public deployment is pending account-endpoint approval and end-to-end validation.

## Username account provisioning

- `account-access.sql` records the applied username/account-administrator schema additions. The CLI launch failed in this Windows environment, so this is a deployment record, not a generated CLI migration. Reconcile the existing migration baseline before any CLI push.
- `user_accounts` exposes only the caller's own username. Only server credentials can insert or change account records. Administrative membership and owner setup tokens are in the private schema with no client table access.
- The `manage-accounts` Edge Function is **not deployed**. Automatic approval review rejected deployment of its privileged public endpoint; explicit approval is required before retrying.
- The function validates Supabase user tokens and checks the database administrator role for account creation/password reset. Its first-owner flow uses a random, expiring, single-use token, consumed under an advisory lock; a failed competing claim deletes its provisional account.
- Password authentication uses internal, non-deliverable identifiers derived from validated usernames. These identifiers are not email accounts and are never used to send mail. Public signups must be disabled in Supabase Auth; email confirmations are not disabled globally.
- After approval, generate a setup token into `private.owner_setup` outside source control, then let the human owner choose their username and password in the setup form. Do not publish a usable setup token in a repository, source file, or public deployment configuration.
- Account recovery requires the owner to reset another user's password. Owner recovery requires project-administrator intervention; there is no email recovery.

## Verified on 20 October 2026

- Applied the initial schema through the Supabase SQL Editor, then the `harden_partner_api` migration through the Supabase integration.
- Ran `tests/access-control.sql` against the live development project: passed, including partner subscription isolation, private event isolation, shared event CRUD, ownership spoofing, invitation replacement/reuse, and disconnect revocation.
- Confirmed all public application tables have RLS enabled and anonymous users have no read privileges.
- Confirmed test accounts and records were rolled back; subscriptions, events, memberships, and invites are empty.
- Supabase security advisor reports no findings. Performance advisor reports only unused-index information, expected before application traffic. See [unused-index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
- Public RPCs run as the caller and delegate to restricted implementations in the unexposed `private` schema.

## Development setup

1. For a fresh development project, apply `migrations/202610190001_accounts_and_sharing.sql` once. This bootstrap file includes the final hardened schema; do not rerun it on the existing project.
2. The existing project's initial schema was initialized manually. Reconcile its migration baseline before using CLI migration push; do not blindly push the bootstrap file into an already initialized database.
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

The `private` schema must remain outside Supabase's exposed API schemas. Invite codes and authorization helpers are not application tables. The private RPC implementations explicitly check the signed-in caller. Helper functions pin their search paths and have restricted execution grants.

References: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/database/functions
