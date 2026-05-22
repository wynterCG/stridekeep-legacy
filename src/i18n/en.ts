// English UI strings. This is the CANONICAL source — `pt.ts` must
// have an entry for every key that exists here (enforced via
// `Record<TKey, string>` at pt.ts's top, so missing keys surface as
// TypeScript compile errors, not runtime undefineds).
//
// Convention:
//   - Keys are dot-namespaced. First segment is the surface area
//     (common, settings, case, canvas, shop, mixing, etc.). Keep new
//     keys in alphabetical groups under their namespace.
//   - VALUES preserve the original casing of the visible string —
//     so 'CONTINUE' stays uppercase here because every button that
//     renders it does so via plain `{t('common.continue')}` without
//     a `.toUpperCase()` wrapper. Centralising the casing here keeps
//     the call sites pure.
//   - Atmospheric proper nouns (color names like "Mistfall", case
//     tier names like "Pigment Pouch", season titles) are NOT in
//     this dictionary — they live in seasonPalette / CASES data and
//     stay the same across languages by design.
//   - Variable interpolation: tokens like `{n}` are substituted at
//     resolve time. Both languages MUST use the same token names.
//
// Scope of localization in v1.0.0: high-impact gameplay surfaces
// (tabs, cases, reveal modal, canvas, shop, mixing, color detail,
// settings, season end ceremony, place errors). Lower-impact surfaces
// (onboarding tutorial copy, JIT tutorial spotlights, LiveFeed event
// templates) stay English-only for v1; they'll get pt-PT in a
// follow-up before closed testing.

export const en = {
  // Generic UI affordances — buttons, modals, dismissals.
  'common.continue': 'CONTINUE',
  'common.skip': 'SKIP →',
  'common.cancel': 'CANCEL',
  'common.close': 'CLOSE',
  'common.save': 'SAVE',
  'common.confirm': 'CONFIRM',
  'common.back': 'BACK',
  'common.delete': 'DELETE',
  'common.done': 'DONE',
  'common.next': 'NEXT',
  'common.ok': 'OK',
  'common.retry': 'RETRY',
  'common.loading': 'Loading…',

  // Bottom tab bar.
  'tabs.home': 'HOME',
  'tabs.inventory': 'INVENTORY',
  'tabs.shop': 'SHOP',

  // Home sub-tabs.
  'subtabs.mural': 'Mural',
  'subtabs.cases': 'Cases',
  'subtabs.profile': 'Profile',

  // SeasonCard (the stats band under the top header).
  'season.day': 'DAY {n}',
  'season.extended': 'EXTENDED · NEXT MURAL PENDING',
  'season.steps': 'STEPS',
  'season.purse': 'PURSE',
  'season.awaitingFirstPixel': 'AWAITING FIRST PIXEL',
  'season.tied': 'TIED',
  'season.leadRed': 'LEAD: RED +{n}',
  'season.leadBlue': 'LEAD: BLUE +{n}',
  'season.redSide': 'RED {n}',
  'season.blueSide': '{n} BLUE',

  // CasesPanel + CaseCard.
  'case.materialsKicker': 'MATERIALS',
  'case.open': 'OPEN',
  'case.pending': '{n} PENDING',
  'case.stepsLeft': '{n} LEFT',

  // CaseRevealModal extras (CONTINUE / SKIP already in common.*).
  // Rarity labels are not localised — they're proper-noun-like
  // taxonomy ("COMMON / RARE / EPIC / LEGENDARY") and stay the same
  // across languages by design.

  // CanvasPanel — viewing-team label + recent feed card.
  'canvas.yourTeam': 'YOUR TEAM',
  'canvas.enemyTeam': 'ENEMY TEAM',
  'canvas.swipeToSeeOpponent': '  ·  swipe to see opponent',
  'canvas.swipeToReturn': '  ·  swipe to return',
  'canvas.tilesUnit': 'TILES',
  'canvas.percentFilled': '{n}% FILLED',
  'canvas.liveFeedTitle': 'LIVE STRIDE FEED',
  'canvas.noActivityYet': 'No activity yet.',
  'canvas.awaitingNextSeason': 'Awaiting next season…',
  'canvas.loadingCanvas': 'Loading canvas…',
  'canvas.placeFailedTitle': 'Could not place tile',

  // TilePicker — modal that opens when the user taps a target cell.
  'tilePicker.title': 'PLACE TILE',
  'tilePicker.youHave': 'You have',
  'tilePicker.commit': 'PLACE',
  'tilePicker.noStock': 'No tiles of this color in inventory.',
  'tilePicker.getMore': 'Open cases to earn more.',

  // ProfilePanel (PROFILE sub-tab on Home).
  'profile.lifetime': 'LIFETIME',
  'profile.lifetimeSteps': 'STEPS',
  'profile.tilesPlaced': 'TILES PLACED',
  'profile.casesOpened': 'CASES OPENED',
  'profile.starter': 'STARTER',
  'profile.quality': 'QUALITY',
  'profile.fine': 'FINE',
  'profile.muralsSection': 'MURALS · {n}',
  'profile.muralsEmpty': 'No murals yet — win a season to earn your first.',
  'profile.bestSeason': 'BEST SEASON',
  'profile.bestSeasonEmpty': 'First completed season will be recorded here.',
  'profile.seasonNumber': 'SEASON {n}',
  'profile.peakContribution': 'Your peak contribution',
  'profile.pixelSingular': 'PIXEL',
  'profile.pixelPlural': 'PIXELS',

  // ShopScreen + ShopRow + buy flow.
  'shop.title': 'SHOP',
  'shop.empty': 'No shop colors this season — check back next rollover.',
  'shop.buy': 'BUY',
  'shop.notEnoughPurse': 'Not enough in purse.',

  // InventoryScreen (top-level Inventory tab).
  'inventory.title': 'INVENTORY',
  'inventory.colors': 'Colors',
  'inventory.mixing': 'Mixing',
  'inventory.empty':
    "Open cases to earn tiles. They'll appear here for placing on the mural.",

  // ColorsPanel (inside Inventory).
  'colors.kicker': 'PIXEL COLORS',
  'colors.loadingPalette': "Loading this season's palette…",
  'colors.muralPrepHint': 'The mural prep tool seeds colors at season start.',
  'colors.noColors': "No colors in this season's palette.",
  'colors.placeOnCanvas': 'PLACE ON CANVAS',
  'colors.sell': 'SELL',
  'colors.sellOne': 'SELL 1',
  'colors.youOwn': 'You own',
  'colors.outOfStock': 'No tiles in inventory.',

  // MixingPanel (inside Inventory).
  'mixing.recipesHeader': 'RECIPES',
  'mixing.craftWithHeader': 'CRAFT WITH',
  'mixing.loading': 'Loading recipes…',
  'mixing.noRecipesForColor': 'No recipes use this color.',
  'mixing.noRecipesThisSeason': 'No craft recipes this season.',
  'mixing.needOneMore': 'NEED 1 MORE INPUT',
  'mixing.needNMore': 'NEED {n} MORE INPUTS',
  'mixing.craft': 'CRAFT',

  // ColorDetailSheet (sheet that opens when a tile is tapped).
  'detail.youHave1Tile': 'You have 1 tile',
  'detail.youHaveTiles': 'You have {n} tiles',
  'detail.notInInventory': 'Not in inventory',
  'detail.obtainShopOnly': 'SHOP ONLY',
  'detail.obtainShopOnlyPriced': 'SHOP ONLY · {price}',
  'detail.obtainCrafted': 'CRAFTED · See MIXING tab for recipe',
  'detail.obtainDropsFrom': 'DROPS FROM {case}',
  'detail.obtainCaseDrop': 'CASE DROP',
  'detail.actionBuyOne': 'BUY 1 · {price}',
  'detail.actionSellOne': 'SELL 1 · {price}',
  'detail.actionPlace': 'PLACE ON CANVAS',
  'detail.actionCraftWith': 'CRAFT WITH',

  // SeasonEndCeremony — winners/losers/tie copy + the season-end
  // celebration modal. `headline.*` and `subhead.*` keyed by outcome.
  // Season number gets interpolated as {n}; the mural NAME from the
  // snapshot is rendered untranslated (atmospheric proper noun).
  'ceremony.headline.win': 'YOUR TEAM WON',
  'ceremony.headline.loss': 'BETTER LUCK NEXT SEASON',
  'ceremony.headline.tie': 'STALEMATE',
  'ceremony.subhead.win': 'Season {n} — you painted into history',
  'ceremony.subhead.loss': 'Season {n} — keep walking, the next mural awaits',
  'ceremony.subhead.tie': 'Both teams will remember this',
  'ceremony.seasonTag': 'SEASON {n}',
  'ceremony.youPlaced': 'YOU PLACED',
  'ceremony.pixelSingular': 'PIXEL',
  'ceremony.pixelPlural': 'PIXELS',
  'ceremony.badgeEarned': 'BADGE EARNED',
  'ceremony.badgeSeasonLine': 'Season {n}',
  'ceremony.nextUp': 'NEXT UP →',
  'ceremony.nextSeasonNum': 'SEASON {n}',
  'ceremony.untitled': 'Untitled',
  'ceremony.nextMuralComingSoon': 'Next mural coming soon',

  // Onboarding tutorial (2-card welcome shown first-launch). The
  // cards' content lives in src/data/tutorial.ts as TKey references —
  // see ONBOARDING_CARDS — and resolves through this dictionary at
  // render time. Add cards in BOTH places (data + dictionary).
  'onboarding.stepOf': 'STEP {n} OF {total}',
  'onboarding.skip': 'SKIP',
  'onboarding.next': 'NEXT',
  'onboarding.gotIt': 'GOT IT',
  'onboarding.card1.title': 'WALKING IS EVERYTHING',
  'onboarding.card1.body':
    'Real-world steps are your only resource. No purchases, no shortcuts — every move starts with a step.',
  'onboarding.card2.title': 'THE LOOP',
  'onboarding.card2.body':
    "Walk to fill cases. Open cases for coloured tiles. Place tiles to paint your team's mural.",

  // JIT tutorial — first-case spotlight chain (5 steps). Same TKey
  // pattern as onboarding: the data in src/data/tutorial.ts holds the
  // keys, copy lives here.
  'jit.skip': 'SKIP TUTORIAL',
  'jit.firstCase.step0.title': 'YOUR FIRST CASE IS READY',
  'jit.firstCase.step0.body':
    'Tap the Cases tab to see what your steps unlocked.',
  'jit.firstCase.step1.title': 'OPEN IT',
  'jit.firstCase.step1.body': 'Tap OPEN to claim your tile.',
  'jit.firstCase.step2.title': 'YOUR TILE IS IN INVENTORY',
  'jit.firstCase.step2.body': 'Tap INVENTORY at the bottom to find it.',
  'jit.firstCase.step3.title': 'THERE IT IS',
  'jit.firstCase.step3.body': 'Tap your new tile to bring up its actions.',
  'jit.firstCase.step4.title': 'PLACE IT ON THE MURAL',
  'jit.firstCase.step4.body': 'Tap PLACE ON CANVAS to send it home.',

  // Place errors (lib/placeErrors.ts). Strings match the discriminator
  // names in PlaceResult — adding a new error means adding a new key
  // here, en.ts -> pt.ts, AND the switch arm in placeErrors.ts.
  'place.pixelTaken': 'Beat you to it!',
  'place.wrongColorWithName': 'That pixel needs {name}.',
  'place.wrongColor': 'That pixel needs a different color.',
  'place.canvasComplete': 'Canvas complete — season just ended.',
  'place.seasonMismatch': 'Season changed — refreshing.',
  'place.notOwned': "You don't have this color.",
  'place.notAuthenticated': 'Not signed in.',
  'place.networkError': 'Network error — try again.',
  'place.unknown': 'Server returned an unknown response. Update the app.',

  // NicknameOnboardingModal — first-launch nickname picker.
  'nickname.title': 'PICK A NICKNAME',
  'nickname.body':
    'This is how other players see you in the live feed. You can change it any time in Settings.',
  'nickname.placeholder': 'e.g. Pixelwalker',
  'nickname.tooShort': 'At least 2 characters.',
  'nickname.tooLong': 'At most 20 characters.',
  'nickname.taken': 'Already taken. Try another.',
  'nickname.save': 'CONTINUE',

  // TopHeader (the always-visible top bar). "STRIDEKEEP" is the brand
  // name and stays the same in all locales — not in the dictionary.
  // The subtitle has two forms depending on whether the season has a
  // mural name yet: the prefix "Season {n}" gets translated; the mural
  // name itself is an atmospheric proper noun and stays untranslated.
  'header.seasonSubtitleWithName': 'Season {n} · {name}',
  'header.seasonSubtitleNoName': 'Season {n}',

  // Settings shell + drill-in row labels.
  'settings.title': '⚙  SETTINGS',
  'settings.account': 'Account',
  'settings.privacy': 'Privacy',
  'settings.notifications': 'Notifications',
  'settings.sound': 'Sound',
  'settings.language': 'Language',
  'settings.currency': 'Currency',
  'settings.about': 'About',
  'settings.linked': 'Linked',
  'settings.anonymous': 'Anonymous',

  // Section headers — shown when drilled into a section.
  'settings.section.account': 'ACCOUNT',
  'settings.section.privacy': 'PRIVACY',
  'settings.section.notifications': 'NOTIFICATIONS',
  'settings.section.sound': 'SOUND',
  'settings.section.language': 'LANGUAGE',
  'settings.section.currency': 'CURRENCY',
  'settings.section.about': 'ABOUT',

  // Language section — picker + descriptions.
  'language.kicker': 'LANGUAGE',
  'language.body':
    "Choose the language Stridekeep uses for buttons, menus, and tutorial copy. Color names and other atmospheric labels stay the same in every language.",
  'language.option.en': 'English',
  'language.option.pt': 'Português',
  'language.detected':
    'Auto-detected from your device locale. Change any time.',

  // Currency section.
  'currency.kicker': 'CURRENCY',
  'currency.body':
    "Stridekeep's purse is a fantasy currency — pick the symbol that reads natural for you. Number formatting still respects your device locale.",
  'currency.option.auto': 'Auto-detect ({code})',
  'currency.option.eur': 'Euro (€)',
  'currency.option.usd': 'US Dollar ($)',
  'currency.option.gbp': 'British Pound (£)',
  'currency.note':
    'Tip: if Auto-detect shows the wrong currency for where you live, your Android language is probably set to a different region — switch to a specific currency here to override.',

  // Account section.
  'account.kicker': 'ACCOUNT',
  'account.bodyAnon':
    'Stridekeep works without an account — your progress is tied to this device. Link an email or Google account to recover your progress on another device.',
  'account.bodyLinked':
    'Your progress is linked to this email. Sign out to switch accounts on this device.',
  'account.linkEmail': 'LINK WITH EMAIL',
  'account.linkGoogle': 'LINK WITH GOOGLE',
  'account.signOut': 'SIGN OUT',
  'account.signIn': 'SIGN IN',
  'account.emailPlaceholder': 'Email',
  'account.passwordPlaceholder': 'Password',
  'account.statusLinked': 'Linked as {email}',
  'account.statusAnon': 'Anonymous · device-only',

  // Privacy section.
  'privacy.kicker': 'POLICY',
  'privacy.body':
    'We collect step counts via Health Connect, your team and tile placements, and a nickname you chose. Read the full policy or request deletion below.',
  'privacy.termsLink': 'TERMS OF SERVICE',
  'privacy.policyLink': 'PRIVACY POLICY',
  'privacy.emailTeam': 'EMAIL PRIVACY TEAM',
  'privacy.emailTeamSub': 'Questions, support, or backup deletion path',
  'privacy.openInBrowser': 'Open in browser',
  'privacy.comingSoon': 'Coming soon',
  'privacy.deleteAccount': 'DELETE MY ACCOUNT',
  'privacy.deleting': 'DELETING…',
  'privacy.deleteAccountSub': 'Permanently remove all my data',
  // Two-step confirm dialogs.
  'privacy.deleteConfirmTitle': 'Delete your account?',
  'privacy.deleteConfirmBody':
    'This permanently removes your team, badges, lifetime stats, and account from our servers. Your tile placements stay on the canvas but become anonymous. This cannot be undone.',
  'privacy.cancel': 'Cancel',
  'privacy.deleteConfirmContinue': 'Continue',
  'privacy.deleteConfirm2Title': 'Are you absolutely sure?',
  'privacy.deleteConfirm2Body':
    'There is no recovery. You will start over as a new anonymous player.',
  'privacy.deleteConfirm2Action': 'Delete forever',
  // Failure paths.
  'privacy.errorNotAuth':
    'You are not signed in. Restart the app and try again.',
  'privacy.errorNetwork':
    'Network error. Check your connection and try again.',
  'privacy.errorGeneric':
    'Could not delete your account. Try again, or email {email}.',
  'privacy.errorOpenLink': 'Could not open {label}. Please try again.',
  'privacy.errorOpenMail':
    'Could not open your mail app. Please email {email} directly.',
  'privacy.linkLabelPolicy': 'the privacy policy',
  'privacy.linkLabelTerms': 'the terms of service',
  // Success-after-delete dialog.
  'privacy.deletedTitle': 'Account deleted',
  'privacy.deletedBody':
    'Your account and all data tied to it have been removed. You are now a fresh anonymous player — pick a nickname to start over.',
  // Pre-filled mail composer (subject + body interpolate player UUID).
  'privacy.mailSubject': 'Stridekeep support — player {uid}',
  'privacy.mailBody':
    'Hi Stridekeep team,\n\nMy player ID is {uid}.\n\n(Describe your question or request below.)',

  // Notifications section.
  'notifications.kicker': 'NOTIFICATIONS',
  'notifications.body':
    'Choose which kinds of nudges you want when push notifications arrive.',
  'notifications.dailyWalkReminderLabel': 'Daily walk reminder',
  'notifications.dailyWalkReminderSub':
    "A nudge if you haven't moved much by evening.",
  'notifications.seasonEndingSoonLabel': 'Season ending soon',
  'notifications.seasonEndingSoonSub':
    'Heads-up the day before a season closes.',
  'notifications.teamActivityLabel': 'Teammate places in your color',
  'notifications.teamActivitySub':
    "When someone fills a pixel of a color you've placed.",
  'notifications.fineprint':
    'Push notifications ship in a future update — your preferences are saved.',

  // Sound section.
  'sound.kicker': 'SOUND',
  'sound.body':
    'Independent toggles for short sound effects and the looping background music.',
  'sound.sfxLabel': 'Gameplay sounds',
  'sound.sfxSub':
    'Case opens, tile placements, ceremony celebration, place-rejection buzz.',
  'sound.musicLabel': 'Background music',
  'sound.musicSub':
    'Ambient loop that plays while you’re in the app. Pauses when you switch away.',
  'sound.silentSwitchNote':
    'Respect the iOS silent switch — flipping your phone to silent mutes Stridekeep’s sounds even with these toggles on.',

  // Health Connect gate (blocking modal at App root when the device
  // either needs the Health Connect provider installed or can't run it
  // at all). Sees daylight only on devices where the player hasn't
  // installed the HC system app yet, or on pre-Android 8 devices.
  'healthConnect.needsInstallKicker': 'ONE LAST STEP',
  'healthConnect.needsInstallTitle': 'Install Health Connect',
  'healthConnect.needsInstallBody':
    "Stridekeep reads your daily steps from Health Connect — a free Google app that keeps your step data on your phone. Tap below to install it from Play Store; come back to Stridekeep once it's installed.",
  'healthConnect.needsInstallCta': 'INSTALL HEALTH CONNECT',
  'healthConnect.unsupportedKicker': 'UNSUPPORTED DEVICE',
  'healthConnect.unsupportedTitle': "This device can't use Health Connect",
  'healthConnect.unsupportedBody':
    "Stridekeep needs Health Connect to track your steps, and Health Connect requires Android 8 or higher. Sorry — there's nothing we can do on this device.",
  'healthConnect.deniedBannerTitle': 'Steps Syncing is Disabled',
  'healthConnect.deniedBannerBody':
    'Stridekeep needs Health Connect permissions to count your strides and unlock materials cases. Grant permission in system settings to resume your journey.',
  'healthConnect.deniedBannerCta': 'ENABLE SYNCING',

  // About section.
  'about.kicker': 'STRIDEKEEP',
  'about.body':
    'A team-based walking game where every step paints a shared mural.',
  'about.versionLabel': 'VERSION',
  'about.buildLabel': 'BUILD',
  'about.credits': 'Made with care by Wynter.',
} satisfies Record<string, string>;

export type TKey = keyof typeof en;
