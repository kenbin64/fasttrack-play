# Getting FastTrack onto Google Play

Written after scaffolding the Android build and auditing what a store submission
would actually have to declare. The build is ready to compile. The submission is
not ready, and the reasons are specific.

## Why Capacitor and not a Java framework

FastTrack is 341,573 lines of JavaScript and three.js. Capacitor wraps that
unchanged: the app loads `www/` in a native webview, so kensgames.com and the
store builds serve the same code and there is no second version to keep in step.

A Java framework that targets Android, iOS and web from one source (Codename One
and libGDX both do this, and libGDX is built for games) would mean rewriting the
whole game. That is a rebuild, not a packaging step.

## What exists now

| piece | state |
|---|---|
| `package.json`, `capacitor.config.json` | at the repo root, `webDir: "www"` |
| `android/` | generated, `com.butterflyfx.fasttrack`, versionCode 1, versionName 1.0 |
| compileSdk / targetSdk | 35 |
| minSdk | 22 |
| `scripts/prepare-mobile.mjs` | syncs, then prunes what does not belong in a store build |
| absolute paths | all nine in `3d.html` verified to resolve under `webDir` |
| the mobile input path | fixed and unit tested, 26 checks, see `test_tap_input.js` |

**Run `npm run sync`, not `cap sync`.** Capacitor copies the whole of `www`, which
is right for the game and wrong for everything beside it. 42 test suites, a crash
probe, the Electron desktop source and the archive were all going into the bundle.
The prune takes them out and leaves the web deploy alone.

## Blockers

### 1. There is no way to delete an account

**This is the one that will get the submission rejected.** Google requires that
any app which lets users create an account also lets them delete it: in the app,
and through a web URL that works without installing anything.

The audit found account creation and no deletion anywhere:

- OAuth sign-in through `accounts.google.com`
- `/api/auth/oauth/exchange`, `/api/auth/validate`, `/api/profile`
- profile writes to `/api/auth/profile/displayName` and `/api/auth/profile/avatar`
- a search for `delete.?account`, `deleteUser`, `account.?deletion` across every
  `.js` and `.html` in `www/` returned nothing

Two things are needed: a deletion endpoint and a screen that reaches it, and a
page on kensgames.com where somebody who has uninstalled the app can still ask.

### 2. There is no signing key

No `.keystore` or `.jks` anywhere on the machine. The upload key is permanent for
the life of the listing: generate it wrong or lose it and you cannot publish an
update to your own app. Generate it once, back it up somewhere that will still
exist in five years, and do not put it in this repository. `.gitignore` already
refuses `*.keystore` and `*.jks`.

### 3. The privacy policy does not cover everything the app does

`kensgames.com/privacy/` exists, 4,696 bytes, and already mentions display names,
avatars, tokens and deletion. It does not mention:

- **Google OAuth**, which means a third party receives a sign-in request
- **leaderboards**, which transmit game activity tied to a user identity

Both have to be named. Play checks the policy against the Data safety answers and
a mismatch is a policy strike rather than a correction request.

### 4. Nothing has been built or run on a device

There is no Android SDK and no Android Studio on this machine, so the project has
been scaffolded and verified but never compiled. And the mobile input path was
rewritten today: it passes 26 unit checks and is live on the web, but no thumb has
touched the packaged app. Shipping a touch-input change to a store without running
it on hardware is the wrong order.

### 5. The target SDK floor needs checking

Set to 35. Google raises the minimum for new submissions every year and I do not
know the current floor with certainty. Check the Play Console requirement before
building the bundle rather than after it is rejected.

## What the Data safety form will have to say

From the audit. Every key below is written by the app to local storage, and every
endpoint is one it calls.

**Personal information collected**

| what | where it comes from |
|---|---|
| Name | `display_name`, `/api/auth/profile/displayName` |
| User IDs | `ft_my_user_id`, `ft_host_user_id`, `kg_guest_id` |
| Photos | `kg_avatar`, `/api/auth/profile/avatar` if users upload one |

**App activity**: game results submitted to `/api/leaderboards/submit`.

**Stored on the device**: `sessionToken`, `user_session`, `kg_session`,
`kg_session_dimensional`, `kg_mp_session_token`, `kg_guest_token`,
`oauth_state_${provider}`, plus settings (`fasttrack-settings`, `ft_quality`,
`kg_setup`, `KG_Game`, `KG_Player`).

**Third party**: Google, via OAuth at `accounts.google.com`.

You will also be asked whether data is encrypted in transit, whether users can
request deletion, and whether any of it is shared. The first is a question about
the API endpoints and should be a plain yes. The second is blocker 1.

## Store listing, which is yours to write

- app icon, 512 by 512
- feature graphic, 1024 by 500
- screenshots: at least two phone, and tablet shots if tablets are supported
- short description, full description
- content rating questionnaire
- a contact email

## The order I would do it in

1. Build account deletion, endpoint and screen, plus the web page. Blocker 1.
2. Install Android Studio, generate the upload key, back it up.
3. `npm run sync`, then `npx cap open android`, then build a debug APK.
4. **Put it on real phones and have people play it**, particularly the tap handling.
5. Update the privacy policy for OAuth and leaderboards.
6. Fill in Data safety from the table above.
7. Check the target SDK floor, bump if needed.
8. Store listing, then internal testing track, then production.

Steps 1 and 4 are the ones that decide whether this goes well. The rest is process.
