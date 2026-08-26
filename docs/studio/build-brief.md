# PureLuxe — Core Modules Build Brief

**Audience:** Founder + solo engineer  
**Status:** Working product brief (extract / Inbox / Queue-from-mail **out of scope**)  
**Sources consolidated:**
- [*PureLuxe Studio Internal Team Product*](./internal-team-product.pdf) / End-to-End Product Flow  
- Prior product-flow and solo-architecture notes (folded into this brief)

**What this file is:** One place for **Login, RBAC, Settings, Trip Builder, Rate Layer, Clients, and Bookings** — what each means, how it works, and what to build.  
**What this file is not:** Email extract, batch extract, Inbox sync-as-creation, Queue-from-mail, commissions-from-mail, or scraper platforms.

**Technical companion (folders, npm, UI, APIs, DB schemas):** [`technical-design.md`](./technical-design.md)

---

## 0. Big picture (fixed)

PureLuxe is **two websites, one trip truth**.

| Product | Who | Job |
|---|---|---|
| **PureLuxe Studio** | Advisors, ops, finance, admin | Plan, price, book, manage trips |
| **PureLuxe Client App** | Guests | Chat-first plan / review / (later) book — not Booking.com |

**Rules that never break**

1. **Trip Builder is the creation path** for trips, clients, and bookings.  
2. **Nothing reaches a guest** without advisor review (or later: system-verified inventory).  
3. **Rates are commercial advantage** — best PureLuxe sources first; safari/yacht/specialist never go generic.  
4. **Knowledge Base holds no sell prices** — Rate Layer owns money.  
5. **Separate logins** — Studio cookie ≠ Client cookie. Guests never see margins, costs, or internal notes.  
6. **Chat is the interface; structured trip data is the product state.** PDFs and Client UI are views of the same trip.

**Explicitly ignored in this brief**

- Email → Claude extract → create bookings/clients  
- Extract crons / admin extract  
- Inbox as primary intake  
- Queue as “approve extracted bookings from mail”

Bookings and clients are created from **Trip Builder** (and explicit Studio actions that are the same idea). Ops may still **manually** enter or edit a confirmed stay in Bookings.

---

## 1. Login

### 1.1 Studio login (team)

**Purpose:** Front door to Studio. Only invited, active KFT team members. No public register.

**Look:** Dark, minimal — PureLuxe / Studio · “Internal team only” · **Sign in with Google**.

**Flow**

1. Open Studio → if already signed in and allowed → Home.  
2. Else → Login → **Sign in with Google**.  
3. System checks: email **invited + active** in Team & Roles; load **role**.  
4. Allowed → Studio shell + Home. Denied → “Ask admin to invite this email” + try another account.

**New teammate:** Admin invites email + role in Team & Roles → person Google-signs-in → Active → Home for that role.

**Not:** Guest login · self-registration · “I am advisor / I am client” on one screen · redirect into Client App.

### 1.2 Client App login (guest)

**Purpose:** Separate front door for travellers.

**Look:** Quiet brand · short line (“Your trips, in one conversation”) · **Continue with Google**.

**Flow**

1. Guest authenticates with Google.  
2. Account binds to **their** client/family record.  
3. Unknown guest → calm “request access / we will be in touch” (no public self-serve membership in V1).  
4. Success → **trip workspace** (three columns). No marketing home.

**They never see:** Studio nav, other families, commission, internal notes, margins, cost.

### 1.3 Session rules (engineering)

| Rule | Meaning |
|---|---|
| Separate cookies | Studio session ≠ guest session |
| One role per session | Founder who also travels uses two accounts or explicit switch that signs out the other |
| Guest cannot open `/studio` | Middleware / `APP_NAME` gate |
| Idle | Generous for advisors; slightly tighter for guests |

**Stack (from architecture):** Studio = Google OAuth + encrypted session + role gate. Guest = separate guest session (Google / magic link later).

---

## 2. RBAC (Team & Roles)

Roles are assigned by an **Admin**. Permissions are **what you can see and do**, not hidden buttons.

### 2.1 Roles (V1)

| Role | Typical person | Default focus |
|---|---|---|
| **Guest** | Traveller | Client App only |
| **Advisor** | Planner | Trip Builder, Clients, Trips, Bookings (view/edit) |
| **Operations** | Booking hygiene | Bookings, Trips, Trip Builder as needed |
| **Finance** | Money | Totals / commission fields when live; not full Trip Builder create |
| **Admin / Owner** | Leadership | Team & Roles, Settings, full Studio |

A person can hold **Advisor + Ops**. Guests never hold Studio roles.  
*(Family member invite on Client App = later.)*

### 2.2 Permission matrix (core modules only)

| Capability | Guest | Advisor | Ops | Finance | Admin |
|---|---|---|---|---|---|
| Studio login | No | Yes | Yes | Yes | Yes |
| Client App — own trips | Yes | — | — | — | — |
| Create trip / client / booking via Trip Builder | No* | Yes | Yes | No | Yes |
| Edit booking money & refs | No | Yes | Yes | View + commission fields | Yes |
| Merge clients | No | Yes | Yes | No | Yes |
| Paste / search rates · set sell · lock | See sell only | Yes | Yes | No | Yes |
| Generate itinerary / rate PDFs | Own confirmation later | Yes | Yes | No | Yes |
| Invite team · assign roles | No | No | No | No | Yes |
| Settings (branding · rate sources) | No | No | No | No | Yes |
| Internal client notes | Never | Yes | Yes | No | Yes |
| Guest profile (passport, loyalty) | Own | Yes | Yes | No | Yes |

\*Guests may **start a trip conversation** for themselves (building state). Confirming a stay still needs inventory rules + advisor/system verification in early phases.

### 2.3 Data visibility

- **Guest:** name, preferences, their trips, guest-facing itinerary, sell rates shown to them, confirmation docs. Never: other clients, cost, margin, internal notes, Queue, contracts.  
- **Advisor / Ops:** full commercial trip in Studio.  
- **Client APIs:** always `getTripForClient` — strip cost, margin, internal notes.  
- **Audit:** rate-approve, document generate, role changes, booking edits → who / when.

### 2.4 Team & Roles page (Admin)

**Nav:** System → Team & Roles.

| Tab | Job |
|---|---|
| **Members** | Invite email + role; Active / Pending / Inactive; change role; deactivate |
| **Role permissions** | Per role, toggle module actions (Trip Builder, Clients, Bookings, Settings, …) |

**V1:** permissions by **role**, not one-off per email.

**Remember:** Members = who gets in · Role permissions = what that role can do · Login = Google + invited + active.

---

## 3. Settings

**Purpose:** Company defaults that apply **across Studio**, not one trip. Advisors do not live here.

**Nav:** System → Settings · **Admin only**.

### 3.1 What to build now (extract ignored)

| Section | Job | Used by |
|---|---|---|
| **Branding** | Company name, logo, accent, proposal footer | Trip Builder Proposal PDFs |
| **Rate sources** | Preference order + toggles (allow offline paste; destination/wholesale rules) | Rate Layer / Trip Builder “Search suppliers” & paste |

**Out of scope for this brief:** Connected mailboxes (feeds Inbox / extract). Revisit only if founder reopens correspondence matching **without** extract-as-creation.

### 3.2 Rate sources (company rules)

Example toggles / rules:

- Preference: Special / wholesale / offline **first** → then GDS / bedbank APIs  
- Allow offline paste in Trip Builder  
- Destination rules (e.g. Maldives wholesale first)  
- Offline trip types / high-value properties (config lists)

Daily rate work still happens **inside Trip Builder**, not on a separate advisor “Rates” tab.

### 3.3 What Settings is not

- Not Team & Roles  
- Not Trip Builder Rates & pricing for one client  
- Not a place to edit one booking or proposal body  

---

## 4. Trip Builder

**Purpose:** Main advisor workspace. Create and build a trip **by chat**. Hotel options, sell price, itinerary/rate PDFs — all on **one trip**.

**One-line job**

> Chat to build the trip → Overview shows truth → Rates & pricing locks sell → Proposal ready as PDFs.

### 4.1 Who

Advisors (primary). Ops may help with specialist/offline quotes.

### 4.2 Layout (three columns)

1. **Studio nav** (Trip Builder active)  
2. **Chat (centre)** — main work; hotel cards with photos when available  
3. **Trip sidebar (right)** — three tabs only: **Overview · Rates & pricing · Proposal**

### 4.3 Starting a trip

1. Advisor names client (+ companions).  
2. Assistant finds matches → advisor chooses; if none → advisor **confirms spelling** → create client (no speculative creates).  
3. One family trip = one start (not one trip per person).  
4. Until trip exists = short setup; after = full toolkit.

### 4.4 Once a trip exists — chat can

- Add / move legs (destination + dates; date change edits leg, does not silently duplicate)  
- Add travellers to **this** trip  
- Ask KB for hotel / dining / activity colour (tiers: Verified · General · Advisor-added)  
- Save day-by-day itinerary (written for the **guest**)  
- Paste rates or (later) pull live rates → **draft** → advisor approve / edit / reject  
- Select which room/package option wins  
- Generate itinerary + rate-sheet documents  

### 4.5 Sidebar tabs

#### Overview

- Status (Building · Quoted · …), client, VIP  
- Next-action callout  
- Travellers · legs · selected stay · **client sell**  
- **Team only:** cost · margin  
- Buttons: Open Rates & pricing · Open Proposal  
- Client App sees prices only after publish / advisor-ready

#### Rates & pricing

See **§5 Rate Layer** (UI lives here; brain is Rate Layer).

#### Proposal

- Itinerary PDF + Rate PDF: generate, preview, download, edit wording, regenerate  
- If trip/rates change after generate → **STALE** → regenerate before send  
- Guests never see margin on any PDF

### 4.6 Happy path (example — Mehta Maldives)

| Step | Where | What |
|---|---|---|
| 1 | Chat | “Start trip Mehta Maldives Oct 10–15” → trip + two hotel options |
| 2 | Chat | Select Soneva |
| 3 | Overview | Travellers, leg, selected stay, sell vs cost/margin |
| 4 | Rates & pricing | Confirm sell, payment plan, **Lock for proposal** |
| 5 | Proposal | Itinerary + Rate PDFs Ready → preview / download |
| 6 | After | Share via agreed client flow; guest never sees margin |

### 4.7 What Trip Builder is not

- Not guest Client App chat (similar feel, different product)  
- Not email extract intake  
- Not commission reconciliation  

### 4.8 Build checklist (Trip Builder)

- [ ] Chat + tools: start trip, match/create client, legs, travellers, itinerary days  
- [ ] Overview / Rates / Proposal sidebar  
- [ ] Draft → advisor approve for rates  
- [ ] Lock sell for proposal  
- [ ] Document generate + stale detection  
- [ ] KB suggestion + honest provenance labels  
- [ ] Publish / client-visible gate before guest sees numbers  

---

## 5. Rate Layer

**Purpose (founder language):** The system that decides **which price we use** and **which source wins** — PureLuxe’s commercial edge.

**Trip Builder** = workspace to compose the trip.  
**Rate Layer** = money engine behind Rates & pricing (and later Client Assistant).

**KB never stores sell rates.**

### 5.1 Source order (architecture — best → last)

1. **Negotiated / PureLuxe special**  
2. **Specialist / offline** (safari, yacht, named specialist properties — **never** fall through to generic)  
3. **GDS** (e.g. Sabre)  
4. **Bedbank** (e.g. Hotelbeds)  
5. **`consultant_required` / advisor manual** (paste)

Company preference and destination rules come from **Settings → Rate sources**.

### 5.2 Where the advisor sees it

| Place | What shows |
|---|---|
| **Chat** | Hotel option cards (image when available) |
| **Rates & pricing** | Full options + sell / margin / Lock for proposal |
| **Overview** | Selected stay + client sell; team-only cost/margin |
| **Proposal** | Locked sell on Rate / Itinerary PDFs |
| **Client App** | Sell price only — never margin |

### 5.3 Rates & pricing tab (product UI)

**Job:** Compare options → select one → set sell / payment plan → **Lock for proposal**.

Controls:

| Control | Meaning |
|---|---|
| **Search suppliers** | Refresh options via Rate Layer for this trip’s dates/destination (stays on tab) |
| **Paste offline quote** | Specialist / offline when no live path or path says consultant |
| Select option | Becomes cost basis |
| **Sell to client** | Client package price; margin recalculates (team only) |
| **Lock for proposal** | Freezes selected stay + sell for PDFs |

### 5.4 Simple example

Ada needs One&Only Reethi Rah, 12–16 Oct, 2 adults.

1. Rate Layer checks: not safari → try negotiated/wholesale if configured.  
2. Else Sabre, then Hotelbeds.  
3. Or Ada **pastes** a quote → draft.  
4. Options appear in chat + Rates tab.  
5. She picks one, sets sell **$12,200**, locks → Proposal PDFs use that sell. Guest never sees **$10,800** cost.

### 5.5 What to build now vs next

| Now (V1) | Next |
|---|---|
| Manual / paste as **first-class** adapter | Live Sabre + Hotelbeds behind same router |
| Routing config (offline types, high-value, wholesaler destinations) | Wholesaler API adapters (today stubs OK) |
| One shared `resolveRates` / selection entry used by Trip Builder | Same entry used by Client Assistant |
| Draft → approve → selected line item → docs | Surfacing “source that won” clearly in UI |
| Unit tests for order + “specialist never skips to generic” | Settings UI for rate-source rules |

**Engineering home:** `packages/domain/rates` or `lib/domain/rates` (and existing `lib/trip-builder/rate-routing.ts` / `rate-selection.ts` / `rate-sources.ts` fold toward that).

### 5.6 What Rate Layer is not

- Not putting prices in the Knowledge Base  
- Not email rate extract as the product path  
- Not Rate Assistant chat (future, separate from KB)  
- Not auto-book without advisor approve (early phases)

---

## 6. Clients

**Purpose:** People CRM — who the guest is, VIP, preferences, family, history — so every trip is personal.

**One-line job**

> Find client → check VIP / preferences / family → edit if needed → **Start trip**.

### 6.1 Who

Advisors (main). Ops (cleanup / merge). Finance: spend stats only. Guest: **own** profile in Client App, not this Studio page.

### 6.2 Page shape

- **List:** search; filters All / VIP / VVIP; sort by name, last booking, spend  
- **Profile:** name, VIP, family, contacts, preferences, loyalty  
- Notes: **general** (may inform guest agent) vs **internal** (never guest-visible)  
- Booking / trip history  
- Actions: **Edit · Merge · Manage family · Start trip**

### 6.3 Creation rule (no extract)

- Prefer create from **Trip Builder** after failed match + advisor confirm.  
- Studio Clients may also create explicitly when needed — same idea, human-confirmed.  
- **Never** invent a second client from mail/AI alone.

### 6.4 Family

Explicit links (spouse, child, assistant). Do not auto-join by surname alone.

### 6.5 Build checklist (Clients)

- [ ] Search + list + profile  
- [ ] Edit contacts / VIP / preferences / notes (internal vs general)  
- [ ] Merge duplicates  
- [ ] Family links  
- [ ] Start trip → opens Trip Builder for that client  
- [ ] Guest profile fields sync with Client App self-edit where allowed  

---

## 7. Bookings

**Purpose:** Trusted list of **real** supplier stays/services — ops inventory truth.

**One-line job**

> Search and open the real booking → check or update status/refs → keep ops truth clean.

### 7.1 How it differs

| Page | Question |
|---|---|
| **Trip Builder** | What are we planning / proposing? |
| **Bookings** | What is already booked / confirmed with suppliers? |
| **Trips** (supporting) | How do stays form one client journey? |

*(Queue-from-extract is out of scope. Do not design Bookings as “approve mail extracts.”)*

### 7.2 Who

Ops (main). Advisors (their clients’ stays). Finance (cost/commission context when needed). Guests never see this Studio list (they see guest-safe confirmation in Client App).

### 7.3 How bookings get here (no extract)

| Source | Path |
|---|---|
| Advisor booked after client approval | Created/updated from Trip Builder / booking action → Bookings |
| Offline specialist confirmation | Entered/updated by ops in Bookings |
| Amendment | Manual amend / supersede on the booking (or later: match-only mail link — **not** extract-create) |

### 7.4 Page shape

- Search: client, hotel, confirmation ref  
- Filters: Confirmed / Pending / Cancelled / Checked out / Superseded  
- Row → detail panel: property, dates, rooms, cost, refs, cancel deadline, linked trip/client, VIP/notes  
- Actions: Edit · Amend · Cancel · Open trip · Open client  

### 7.5 Statuses

| Status | Meaning |
|---|---|
| **Pending** | Not fully confirmed |
| **Confirmed** | Supplier-confirmed stay |
| **Cancelled** | Not travelling on this booking |
| **Checked out** | Stay finished |
| **Superseded** | Replaced by a newer amendment |

Also as needed: Enquiry, Hold, Amendment pending.

### 7.6 What Bookings is not

- Not day-by-day itinerary design (Trip Builder)  
- Not the guest Client App  
- Not a full finance ledger  
- Not an email-extract approval queue  

### 7.7 Build checklist (Bookings)

- [ ] List + search + status filters  
- [ ] Detail panel edit (dates, refs, cost, notes, VIP)  
- [ ] Link to trip + client  
- [ ] Create/update from Trip Builder booking path  
- [ ] Manual ops entry for offline confirms  
- [ ] Amend / cancel / supersede  
- [ ] Guest-safe projection of confirmed stays for Client App  

---

## 8. Client App (guest product) — connected to the above

**Purpose:** Guest website for chat-based planning/booking. Same trip truth as Studio. Never Studio chrome.

**One-line job**

> Guest chats to plan → living itinerary/rates on the right → (later) approve & pay → travel support in same chat.

### 8.1 Layout

| Left | Centre | Right |
|---|---|---|
| Trip list (+ New trip) | Chat | Itinerary · Rates |

### 8.2 Chat policies (architecture)

One chat runtime, two invisible modes:

| Mode | Does | Does not |
|---|---|---|
| **Curator (discover)** | KB + soft recommendations | Book / pay tools |
| **Assistant (execute)** | Inventory + Rate Layer + booking tools when intent is clear | Expose margin / Studio |

Guest never sees “switching bots.”

### 8.3 Safety

- Uses **published / advisor-approved** trip content only.  
- Sell prices only — never cost/margin.  
- Confirming a stay still respects advisor / system-verified rules in early phases.  
- No raw card storage; pay-at-hotel / tokenized provider before live book.

### 8.4 Build order relative to Studio

1. Studio Trip Builder + Rate Layer (manual) + Clients + Bookings solid  
2. Publish gate + `getTripForClient`  
3. Client login + trip workspace read of approved trips  
4. Curator chat  
5. Assistant + safe book (after payments design)

---

## 9. End-to-end story (no extract)

1. Admin invites Ada (Advisor) in **Team & Roles** → Ada **Studio Login**.  
2. Admin sets **Settings → Branding + Rate sources**.  
3. Ada opens **Clients** (or starts in Trip Builder) → Mehta VIP → **Start trip**.  
4. **Trip Builder** chat: Maldives dates, companions, itinerary days (KB-backed).  
5. **Rate Layer** via Rates & pricing: paste and/or search suppliers → select → set sell → **Lock**.  
6. **Proposal:** itinerary + rate PDFs → advisor skim → share.  
7. Guest **Client App Login** → sees same trip (sell only) → requests change in chat.  
8. Ada updates **same trip** → republish.  
9. Guest approves → team books → stay appears in **Bookings** (from Trip Builder / ops entry).  
10. Guest sees confirmation in Client App; ops keep refs/deadlines clean in Bookings.

---

## 10. Priority build order (founder cut)

| Priority | Module | Outcome |
|---|---|---|
| **P0** | Login (Studio) + RBAC basics | Team can enter with correct role |
| **P0** | Trip Builder | Compose trip + docs without mail |
| **P0** | Rate Layer V1 (manual + routing rules) | Paste → draft → approve → lock sell |
| **P1** | Clients | CRM + Start trip |
| **P1** | Bookings | Trusted stays from Trip Builder / manual ops |
| **P1** | Settings (Branding + Rate sources) | Company defaults |
| **P2** | Live Rate Layer adapters (Sabre / Hotelbeds) | Search suppliers real |
| **P2** | Client App login + read approved trips | Guest face |
| **P3** | Client Curator → Assistant + safe book | Full guest booking |

**Do not schedule:** email extract, batch extract, Inbox-led create, Queue-as-extract-gate — until founder explicitly reopens that track.

---

## 11. One-line remember

| Module | Remember |
|---|---|
| **Login** | Two doors · Google · invited team vs known guest |
| **RBAC** | Invite + role · permissions by role · guests never in Studio |
| **Settings** | Branding + rate-source company rules |
| **Trip Builder** | Chat builds the trip · Overview / Rates / Proposal |
| **Rate Layer** | Which price wins · manual today · live next · no prices in KB |
| **Clients** | People CRM · create with human confirm · Start trip |
| **Bookings** | Confirmed supplier truth · from Trip Builder / ops · not from extract |
| **Client App** | Same trip · sell only · Curator then Assistant |

> Extraction is off the critical path. Trip Builder creates; Rate Layer prices; Bookings holds confirmed inventory; Client App shows the safe view of the same trip.
