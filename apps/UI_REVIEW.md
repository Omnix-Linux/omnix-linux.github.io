# Apps UI review

## Findings

The expanded panel gave too much space and visual weight to its framing: a repeated “— Details” heading, larger description text than the hover preview, and four separately bordered accordions. The UI review measured the original PrintCraft panel at approximately 405px natural height; closed rows and their gaps accounted for 232px. On phones, repeated headings wrapped and useful evidence choices fell below the panel's scroll boundary.

The positioning logic assumed expanded content needed only 160px, sometimes choosing a short area below the card despite more reading space above it.

## Reference patterns

Reviewed these official app-store references for hierarchy and restrained secondary information:

- [GNOME Software](https://apps.gnome.org/Software/) and its [details screenshot](https://static.gnome.org/catalog/app-screenshot/org.gnome.Software/ss-details.png).
- [KDE Discover](https://apps.kde.org/discover/) and its [overview screenshot](https://cdn.kde.org/screenshots/plasma-discover/plasma-discover.png).
- [Flathub's Firefox page](https://flathub.org/en/apps/org.mozilla.firefox).

The applicable pattern is a clear app identity and action, readable description, subdued metadata, and secondary information disclosed progressively. Omnix retains its compact app list and existing evidence model.

## Selected changes

Playwright compared the existing design, flat disclosure rows, and softly grouped rows at 1440, 390 and 320px. Flat rows were selected to avoid adding more nested surfaces.

- Compact icon/name identity without a repeated “Details” suffix.
- Consistent approximately 13px description typography between preview and expansion.
- Quiet slate border, raised background and softer shadow.
- Subdued status/date/platform metadata; the tested date stays together.
- Flat 44px disclosure rows with trailing chevrons and thin separators.
- Actual content height determines below/above placement.

The refined PrintCraft panel measured approximately 286px on desktop in the screenshot review. All four disclosure choices were visible on phones. The reviewer found no further decorative changes necessary.

## Verification

Playwright checks desktop/tablet/mobile density, 80% width and right alignment, compact previews, hover transfer and repeated re-entry, wheel scrolling, expansion/pinning, keyboard/Escape, touch, copy controls, all evidence expanded without overflow, unchanged card positions/page height, no JavaScript and missing Popover API. Generator and Apps data tests pass. Every app and its recorded evidence remain available.
