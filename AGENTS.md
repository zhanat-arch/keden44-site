# Public Website Publication Checklist

Before editing, follow the workspace backup requirements. Never include untracked
owner/admin candidate folders, credentials, customer XML/PDFs or live account data
in a public commit.

For every new or changed public page:

- Use the existing common footer: `footer[data-site-footer]` and
  `/shared/footer.js`. Do not copy a separate footer implementation into the page.
- Verify that the footer actually renders `.k44-footer-inner` with the standard
  links on desktop and mobile. A script tag alone is not proof.
- Verify a `page_view` is generated once with the canonical pathname and useful
  page title. `/blog/` and `/tools/` sections inherit analytics from the shared
  loader; new top-level sections require an explicit privacy-reviewed decision.
- Never send query strings, fragments, account information or document contents
  to analytics. Private owner paths and API-host pages must remain untracked.
- Test the page through the real shared footer/analytics scripts in an isolated
  browser. Stub the Google collection script in local tests to avoid polluting
  production statistics.
- Check 390px and 1440px layouts, links, images, browser tabs and console errors.
- For downloads, inspect archive contents and permissions; verify the actual
  downloaded ZIP's SHA256, vendor files and integrity.
- Verify the deployed-file backup on the server before publication. Record the
  previous Git release, backup paths and a rollback limited to affected files.
- Stage only intended public files; inspect the staged diff before pushing.
- After publication, verify the live page and download, not merely Git push.
- In the final report, distinguish analytics event generation from confirmed
  Google Analytics receipt. Do not claim historical events were backfilled.

Run the shared footer/analytics regression test when editing either shared file.
Update this checklist whenever a new recurring publication mistake is found.
