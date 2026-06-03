# Pre-Alpha Invite Email Template

This is the email sent automatically via Resend when an admin invites a user from Settings → Users.

---

**Subject:** An invitation to try Orb

[Orb icon centered]

Hi [name],

I'm inviting you to try Orb, a web application I've been building. It's a conversational task manager — you talk to it like a chat and it manages your backlog. It's still in its early stages and may contain bugs. If something breaks, tell me. If something works well, tell me that too!

[ Get started with Orb ] ← button (links to invite auth link)

Orb works on most modern browsers: Safari, Chrome, Firefox, Edge, and Comet. On iPhone or iPad, you can install it as an app — open the link above in Safari, then tap Share → Add to Home Screen.

**How to give feedback:**
Just tell Orb. Say something like *"I have a suggestion"* or *"something's broken"* — it'll log it automatically as a ticket and it goes straight to me.

**Not interested?**
No pressure — [click here to decline]([DECLINE_LINK]).

I'm watching closely and iterating fast. I hope you'll give it a try!

— Stan

---

## Implementation

Email is sent from `lib/email.ts` via Resend. All variables are populated automatically from the invite form. The admin does not need to compose anything manually.
