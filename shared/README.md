# Shared public footer and analytics

Edit footer.html for footer text, links and styling. Every connected public page
loads this one file through footer.js with revalidation. No HTML copies to edit.

New public pages need a fallback <footer data-site-footer> with basic links and
<script defer src="/shared/footer.js"></script> before the closing body tag.
Keep per-page legal notes outside the shared footer. Retain controls bound by
application code inside a data-footer-actions container; the loader moves the
existing nodes into the shared slot and preserves their listeners.

footer.js also loads analytics.js once, independently of footer fetch success.
analytics.js initializes the existing GA4 measurement ID only for allowed public
paths and production hostnames, with a static title and canonical path without
query/hash. Add each new public path to its title map. Do not add document IDs,
filenames, contents, BINs, QR links or auth tokens to telemetry. Unknown paths,
admin pages and shared-card token routes are intentionally excluded.

blog/analytics.js is a compatibility loader for cached older blog pages, not a
second measurement implementation. Do not add inline GA copies to new pages.

QA: shared footer on 16 pages; desktop/mobile; offline fallback; duplicate-load
guard; actual GA collect requests intercepted in tests; synthetic PDF only for
telemetry checks; monitor share control retained. Revalidate after changes.
