# Clinic tools release notice

The authenticated layout shows the approved bilingual release card. Public
pages, demonstration accounts and an open payment-result dialog do not show it.
The visual is shared with the development-only `/updates-preview.html` page.

`dc_seen_clinic_tools_20261013` is stored as a single merged field in Supabase
Auth user metadata. Each new device reads the server's user record before
showing this release; a successful marker save is required before display.
The field grants no authorization and does not modify billing or clinic data.
Local storage caches the account-specific marker. Web Locks serialize tabs
on one origin, and an in-memory guard serializes repeated checks. Separate
devices opened at precisely the same moment can both read an unseen marker;
Auth metadata does not provide an atomic cross-device compare-and-set.

Offline and failed writes defer display. Online/visibility events retry.
Closing via the button, Escape or backdrop does not clear the seen marker.
Changing language or moving between pages does not reset it. A new release
requires a new key and reviewed copy. No database migration is needed.

Tests cover sequential web/desktop sessions, concurrent checks in one runtime,
account isolation, cancelled checks, write failures and unavailable storage.
