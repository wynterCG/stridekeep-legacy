# Stridekeep Privacy Policy

**Effective date:** May 4, 2026.
**Last updated:** May 4, 2026.

This is the privacy policy for **Stridekeep**, a mobile game in which your real-world step count contributes to a shared pixel-art mural. We take your privacy seriously and want to be specific about what data we collect, why, the legal basis for collecting it, and how it's stored.

This policy is a starting draft and not legal advice. Before publishing, have a lawyer or a service such as Iubenda or Termly do a compliance pass — especially if you serve players in the EU (GDPR), California (CCPA), or under-16 audiences.

## 1. Who we are

Stridekeep is operated by **Daniel Lourenço Costa Inverno**, an independent solo developer based in the Netherlands. For the purposes of GDPR, Daniel Lourenço Costa Inverno is the **data controller**.

Contact email: **privacy@stridekeep.app**
Postal address: **Van Valckensteinstraat, 3342 VP Hendrik-Ido-Ambacht, Netherlands**

If you have any question about this policy or about how your data is handled, email privacy@stridekeep.app and we will respond within 30 days.

## 2. Information we collect

### Health and fitness data

- **Daily step count**, read once per app session via Android Health Connect (or Apple HealthKit on iOS, when available).
  We never read any other Health Connect data type — not heart rate, not workouts, not sleep, not weight. Only steps.
  We never write to Health Connect.
  Steps are read in real time and converted into in-game progress; we do not retain a step-by-step history on our servers — only an aggregate "lifetime steps" counter is stored against your user identifier.

### Account information

- **Pseudonymous user identifier (UUID)**: assigned automatically the first time you open the app, before you sign in or create an account. This UUID is a stable identifier that links your tile placements and progress to your device across sessions — under GDPR this is *pseudonymous* data, not anonymous, because it can be tied back to you when combined with the email you optionally link.
- **Email and password** (optional): only stored if you choose to "link" your account so that you can recover it on another device. We never see your password — Supabase (our authentication processor) hashes it before storage.
- **Nickname**: a 3-to-20-character display name you choose on first launch. Your nickname appears on the in-game live feed alongside actions you take (tile placements, case openings, etc.) and is visible to other players. Default nicknames look like `Stridekeeper-abc123`, where the suffix is derived from your UUID and is therefore itself a pseudonymous identifier visible to other players until you choose a custom nickname.

### In-app activity

- **Team assignment** (Red or Blue), assigned randomly the first time you open the app.
- **Tile placements** on the canvas — which colour you placed on which pixel, and when.
- **Case openings, sells, crafts, and shop purchases** (in-game economy actions only — no real money).
- **Lifetime statistics**: aggregate counters such as total steps walked, total tiles placed, total cases opened.
- **Notification preferences** (toggles you set in the app's Settings screen).

### Diagnostic / device data

We do not collect any device identifiers, advertising IDs, IP addresses (beyond what's needed for normal HTTP traffic to our backend), location data, contacts, or any other information not listed above.
We do not use any third-party analytics, advertising SDKs, or behavioural tracking.

## 3. Legal basis for processing

Under the EU General Data Protection Regulation (GDPR) and the Dutch UAVG, we rely on the following lawful bases for processing your data:

- **Step count from Health Connect** — explicit consent under Article 9(2)(a) GDPR. Step data is treated as health data and falls under the special-category provisions of Article 9. You grant this consent via the Health Connect (or HealthKit) permission prompt at the operating-system level. You can withdraw this consent at any time via your device's Health Connect settings; doing so prevents further reads but does not delete progress already earned.
- **Account, tile placements, nickname, and live feed activity** — performance of a contract under Article 6(1)(b) GDPR. Processing these data points is necessary to provide the game you've chosen to play.
- **Aggregated, anonymised statistics used to balance the game economy across seasons** — legitimate interests under Article 6(1)(f) GDPR. Our legitimate interest is maintaining a fair and functional game; we balance this against your privacy by ensuring this data is fully de-identified before use.

We do **not** engage in automated decision-making with legal or similarly significant effects within the meaning of Article 22 GDPR.

## 4. How we use your information

We use the information above only to:

- Run the game (assign you to a team, count your steps toward case progress, place your tiles on your team's canvas, show you the live feed of community activity).
- Let you recover your progress on a different device (if you choose to link an account).
- Display your in-game actions to teammates and opponents on the live feed.
- Improve the app by aggregating anonymous, non-personal play patterns (e.g. how often a season completes before its 14-day cap).

We do **not** sell your data, share it with advertisers, or use it for any purpose unrelated to running the game.

## 5. How we share your information

The information below is **shared with other players** by design — it's how the game works:

- Your nickname.
- Your team (Red or Blue).
- Your tile placements (other players see them on the canvas and in the live feed).
- Your case-opening, sell, craft, and shop events (visible on the live feed).

The information below is **shared with third-party processors** (acting on our behalf under Article 28 GDPR) so the app can run:

- **Supabase Inc.** — our authentication and database processor. Supabase stores your account row, your tile placements, and your lifetime stats. The Supabase platform is operated by a US company; data for our project is stored in the European Union (Ireland, region `eu-west-1`). Where any data transfer outside the EEA occurs (for example, when Supabase support staff access our project from outside the EEA), the transfer is covered by Standard Contractual Clauses (SCCs) under Supabase's [Data Processing Addendum](https://supabase.com/legal/dpa) and its [Privacy Policy](https://supabase.com/privacy).
- **Expo / EAS** — our build, distribution, and update sub-processor. Expo is a US company. They do not receive any of your gameplay data — only standard build metadata required to deliver the app and any over-the-air updates. Any incidental data transfer is covered by SCCs under Expo's [Privacy Policy](https://expo.dev/privacy).
- **Google Health Connect** (or Apple HealthKit on iOS, when available) is the source of your step data. We read from it; we do not share data with it. Health Connect itself is governed by Google's own privacy terms.

We do not share your data with anyone else.

## 6. How we store and protect your data

- All gameplay data is stored on Supabase servers in the European Union (specifically the `eu-west-1` region, in Ireland).
- Connections between the app and our backend are encrypted in transit (HTTPS / TLS).
- Passwords are hashed by Supabase before storage; we never see them in plaintext.
- We do not store your step count's per-day history on our servers — only an aggregate counter.
- International transfers: as noted in §5, where data is accessed from outside the EEA by our processors (Supabase, Expo), such transfers are covered by EU Standard Contractual Clauses.

## 7. How long we keep your data

- We keep your account data, tile placements, and live feed events (case openings, sells, crafts, shop purchases) for as long as your account exists — they form the game record visible to other players on the live feed.
- If you request deletion (see §8) we delete your account and all data tied to it within 30 days.
- Aggregated, anonymised statistics that no longer identify you may be retained indefinitely for game-balance purposes.

## 8. Your rights and choices

You have the right to:

- **Access** the data we hold about you.
- **Correct** inaccurate data (e.g. your nickname).
- **Delete** your data and your account.
- **Restrict** or **object** to certain processing.
- **Data portability** — receive your data in a structured, machine-readable format.
- **Withdraw consent** to Health Connect access (Article 9(2)(a) GDPR consent) at any time, via your device's Health Connect settings. Doing so does not delete in-game progress already earned.

To exercise any of these rights, email **privacy@stridekeep.app** with the user identifier shown in the in-app Settings → Privacy → Request data deletion screen, OR tap that screen to compose a pre-filled deletion email.

**Self-serve account deletion** is available inside the app: open Settings → Privacy → DELETE MY ACCOUNT, confirm twice, and your account and all data tied to it are removed immediately. If you have already uninstalled the app, you can still request deletion via the web form at [stridekeep.app/delete-account.html](https://stridekeep.app/delete-account.html).

### If you are in the EU / EEA

You have the right to **lodge a complaint with your supervisory authority**. In the Netherlands this is the **Autoriteit Persoonsgegevens** ([autoriteitpersoonsgegevens.nl](https://autoriteitpersoonsgegevens.nl)). If you live in another EU/EEA country, you may complain to your local authority instead.

### If you are in California

You have the rights granted by the CCPA — right to know, right to delete, right to correct, right to limit the use of sensitive personal information, and the right to non-discrimination for exercising these rights. **We do not sell or share personal information as defined by the CCPA**, so no opt-out is required. To exercise any other CCPA right, contact us at privacy@stridekeep.app.

## 9. Children

Stridekeep is rated for ages 13 and older worldwide. However, under the Dutch UAVG (and most EU member states' implementations of GDPR Article 8), children **under 16** in the European Economic Area cannot validly consent to the processing of their personal data without their parent's or guardian's authorisation.

- **If you are in the EU/EEA and under 16**: Stridekeep is not intended for you. Do not create an account.
- **If you are outside the EU/EEA and at least 13**: you may use Stridekeep.
- **If you are under 13** anywhere in the world: Stridekeep is not intended for you.

We do not knowingly collect personal information from children for whom parental consent would be required and has not been obtained. If you believe such a child has provided us with personal information, contact privacy@stridekeep.app and we will delete it.

## 10. Changes to this policy

We may update this policy from time to time. Material changes will be announced inside the app via a banner or modal before they take effect. The "last updated" date at the top of this policy will always reflect the most recent revision.

## 11. Contact

Questions, concerns, or requests:

- **privacy@stridekeep.app** (preferred for data-related requests)
- **support@stridekeep.app** (everything else)

---

*Stridekeep is a small, independent project. We try to match the way we handle your data to the way we hope a small, independent operator would handle ours: minimally, transparently, and with a real human on the other end of the email address.*
