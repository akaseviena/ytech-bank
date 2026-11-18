// Facts about the product that the legal pages state, in one place, so two pages cannot disagree.

/**
 * Can a person delete their own account from inside the app (Settings -> Delete account, confirmed
 * with their PIN)? The privacy policy and the terms both say so when this is true, and say the older
 * thing (ask by email) when it is false. It is the switch to turn back if the build that has the
 * screen is pulled; do not turn it on for a screen that does not exist.
 *
 * Checked against what the database function and the route really do on 18 November 2026: the
 * sentences in app/privacy/page.tsx ("Deleting your account") list exactly what is erased and what
 * stays. Change the function, change that section.
 */
export const ACCOUNT_DELETION_LIVE = true;
