# NyxHICSlab - Google Play packaging

Capacitor shell for Google Play, same pattern as NyxEcho: the app loads
the live site (server.url https://www.nyxhicslab.com) inside a native
shell. Package: com.nyxcollective.nyxhicslab.

Layout:
- native/ - Capacitor project (package.json, capacitor.config.json,
  www/ placeholder). The generated native/android/ project is NOT kept
  in the repo; the GitHub workflow (.github/workflows/android.yml)
  regenerates it on every build.
- assets/icons/ - icon-1024.png (full-bleed, logo on the app's deep
  plum #241D2B) and icon-foreground.png (adaptive foreground), both
  derived from hics-app/public/hicslogo.png.
- assets/splash.png - splash source (plum with the logo), applied over
  the template splash drawable at build time.
- store-assets/icon-512.png - the 512x512 Play listing icon.

External links: capacitor.config.json allowNavigation lists only
nyxhicslab.com (plus accounts.google.com so Google sign-in redirects
work). Any other host - including the nyxcollectivellc.com footer
links, which use target=_blank - is handed to the system browser
instead of navigating inside the WebView.

Signing: upload keystore lives outside the repo
(~/workspace/hics-keys/nyxhicslab-upload.jks). The workflow takes it
from the ANDROID_KEYSTORE_BASE64 GitHub secret and verifies it unlocks
before building; see .github/workflows/android.yml for the full secret
list. The finished AAB comes back as a run artifact and as text pieces
on the aab-drop branch with a sha256 manifest.
