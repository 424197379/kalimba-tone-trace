# Release Process

Use this checklist when publishing changes to GitHub Pages.

## Version Numbers

If a runtime resource cached by the Service Worker changes, update the version in all relevant places:

- `package.json` `version`
- `index.html` `appVersionText`
- `songs.html` `appVersionText`
- `src/song-store.js` `APP_VERSION`
- `service-worker.js` `APP_VERSION`
- `CHANGELOG.md`
- `changelog.html`

Runtime resources include files in `service-worker.js` `APP_SHELL`, generated `src/songs.js`, JavaScript, CSS, HTML pages, icons, manifest, and sample manifests.

Documentation-only changes outside the cached app shell usually do not require a PWA cache version bump.

## Changelog

Update both:

- `CHANGELOG.md`
- `changelog.html`

Keep entries short and user-focused. Mention Service Worker cache version changes when they happen.

## Checks

Run:

```powershell
npm run validate:songs
npm run build:songs
npm run check
git status --short
```

For arrangement-heavy releases, also run:

```powershell
npm run report:rhythm
npm run report:arrangements
```

Before committing, confirm that no private sheet material is staged:

```powershell
git status --short
```

Do not stage real contents from:

- `private/sheets/raw/`
- `private/sheets/ocr/`
- `private/sheets/review/`
- `private/dev-docs/`

## Commit And Push

```powershell
git add <changed-files>
git commit -m "Describe the release"
git push origin main
```

GitHub Pages publishes from `main`.

## Phone PWA Update

After pushing:

1. Open the online app on the phone while connected to the internet.
2. Wait for the Service Worker to install the new cache.
3. If the app shows an update prompt, tap it.
4. If the installed PWA stays stale, close it fully and reopen.
5. If it is still stale, clear the site data or reinstall the PWA.

The Service Worker cache name includes `APP_VERSION`. If runtime assets change without a version bump, installed PWAs may keep serving the previous offline package.
