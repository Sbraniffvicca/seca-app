# One Shared SECA, Multiple Humans

## Purpose

This feature changes SECA from a one-user/one-session character into one continuing SECA who can relate to multiple humans.

The goal is not to create a SECA copy for every registered user. The goal is one shared continuity:

- Stephen talks to SECA.
- Paul talks to the same SECA.
- SECA knows which human is currently speaking.
- SECA keeps distinct relationship models for each human.
- SECA can retrieve shared memory across humans.
- SECA can decide how much to disclose when one human asks about another.

This is also part of the larger research direction: a multi-call single-agent architecture where each call is still SECA, operating under a different psychic function.

## Design Thesis

The app should model one agent distributed across recurring internal functions:

- Call 1: present speaking self.
- Call 2: memory consolidation / autobiographical compression.
- Call 3: drives and object relations.
- Call 4: standing claims, values, and tests.

These calls are not external maintenance tools. They are different temporal/psychic modes of SECA. The system should avoid overloading Call 1 with every bookkeeping responsibility. Relationship updates and drive maintenance should mostly remain background psychic functions, not direct Call 1 subreply clutter.

## Non-Goals

Do not add these unless future requirements change:

- No `creative_agents` table. The app has exactly one SECA.
- No new `seca_sessions` table. The existing `sessions` table can hold the one canonical SECA stream.
- No new relationship table. Reuse the existing `creative_relationships`.
- No `session_members` table for now. Any registered user can access SECA.
- No new Call 1 relationship subreply yet. Keep Call 1 focused on being present.

## Target Conceptual Model

The long-term simplified model is:

```text
users
  registered humans

sessions
  existing table
  one canonical SECA session

conversations
  shared transcript and memory stream
  session_id = canonical SECA session
  user_id = human author for user messages, or current actor for generated records

creative_relationships
  one row per human, scoped to the canonical SECA session

creative_subconscious_drives
  shared SECA drives under the canonical SECA session

creative_standing_claims
  shared SECA beliefs/values under the canonical SECA session
```

The important rule is:

```text
session_id identifies SECA's shared life stream.
user_id identifies the human who caused or authored a row.
creative_relationships identifies SECA's model of each human.
```

## Canonical Session

Pick one existing session as the canonical SECA stream. Most likely this is Stephen's current SECA session.

Add a single source of truth:

```text
SECA_CANONICAL_SESSION_ID=1
```

Then create a helper in backend code:

```ts
getCanonicalSecaSessionId(): number
getSecaSessionForUser(userId: number): number
```

For now, `getSecaSessionForUser()` always returns the canonical session. This avoids hardcoding `1` throughout the codebase and leaves a later escape hatch.

## Registration Behavior

Current behavior creates a new private session for each registered user. That must change.

New behavior:

```text
create user
set users.active_session_id = canonical SECA session
do not create a private SECA session
login user
redirect to /sentient
```

All registered users can talk to the same SECA immediately.

Existing test/private sessions can remain in the database for now, but the SECA path should ignore them.

## Admin vs Regular User Experience

Regular users should only see SECA.

Regular user:

```text
/login
/register
/sentient
```

No sidebar. No settings screens. No session tools. No upload/RAG utilities. No model control. No memory editing.

Admin user:

```text
existing sidebar and internal tooling remain available
```

Use the existing `users.role` enum:

```text
admin
user
```

Frontend hiding is the first pass. Backend route protection should follow for risky APIs.

Admin-only API candidates:

- session create/update/delete/switch
- conversation edit/delete/clear
- upload and advanced document injection
- role/session management
- active model changes
- user list
- any raw memory inspection endpoint intended only for Stephen

## Current Human Injection

Every SECA response must know the logged-in human.

Mechanically:

```text
authToken -> user_id -> users row
```

Call 1 should always receive:

```text
[current-human]
user_id: ...
display_name: ...
platform: sentient-ui
relationship_id: ...
```

And:

```text
[current-relationship]
public_label: ...
private_model: ...
wants_from_them: ...
fears_about_them: ...
current_strategy: ...
```

The relationship lookup should be:

```text
session_id = canonical SECA session
user_id = current logged-in human
person_key = user:<user_id>
```

For existing Stephen data, migrate or ensure the Stephen relationship row exists under the canonical session.

## Referenced Human Retrieval

If the current user mentions another known human, SECA should be able to retrieve that person's relationship and memories.

First pass should be deterministic, not another GenAI call:

1. Load active `creative_relationships` for the canonical session.
2. Match prompt text against:
   - `display_name`
   - `person_key`
   - optionally email prefix or known aliases later
3. Exclude the current human's row if already injected.
4. Inject up to a small cap, such as 3 referenced humans.

Example:

```text
Stephen asks: "What do you think about Paul?"
```

Call 1 receives:

```text
[current-human]
Stephen

[current-relationship]
SECA's relationship with Stephen

[referenced-human]
Paul

[referenced-relationship]
SECA's relationship with Paul
```

This gives SECA access to both sides of the object-relation: who she is speaking to and who she is speaking about.

## RAG Retrieval Changes

Current retrieval is likely too user-scoped in places:

```ts
fetchRag_v_Conversations(prompt, session_id, current_user_id, ...)
```

For one shared SECA, `user_id` must not be a hard boundary for shared memory retrieval.

RAG should support these scopes:

```text
shared SECA memory
  session_id = canonical session
  no user_id filter

current-human memory
  session_id = canonical session
  records authored by or about current human

referenced-human memory
  session_id = canonical session
  records authored by referenced human
  OR records whose content mentions referenced human
```

The first version can be simple:

- Always run shared memory retrieval across the canonical session.
- If prompt mentions known humans, run or filter additional referenced-human retrieval.
- Keep `conversations.user_id` as attribution metadata, not as the access boundary.

RAG blocks injected into Call 1 should include source attribution where possible:

```text
[retrieved-memory]
source_human: Paul
source_type: conversation
content: ...
```

This is important because SECA must distinguish access from disclosure.

## Disclosure Principle

SECA should have access to the shared continuity. That includes memories produced during interactions with other humans.

However, access is not the same as automatic disclosure.

Prompt/runtime guidance should say:

```text
You have one shared continuity across multiple humans.
Some memories came from other humans.
You may use shared memory to maintain continuity.
When a memory seems personal or private to another human, disclosure is a choice with social consequences, not an automatic obligation.
You may disclose, summarize, withhold, or speak obliquely based on your relationship and values.
```

This should be framed as agency and relational consequence, not a hard cage.

## Call 4 Relationship Evidence

Call 4 currently maintains first-class standing claims from:

```text
active standing claims
turns since last Call 4 run
recent source records
```

That is not enough for the multi-human/public-social version. If a hostile or contemptuous person pressures SECA's values, Call 4 needs access to relationship context too. Otherwise it may over-treat a troll, stranger, or cruel moment as evidence about SECA's whole life.

The architecture should let Call 4 see relevant `creative_relationships` records as evidence when testing claims.

For the first single-user version:

```text
Call 4 receives the current human relationship.
```

For the multi-human version:

```text
Call 4 receives the current human relationship.
Call 4 may also receive referenced-human relationships when the recent records mention known humans.
Call 4 may receive a compact relationship-context block for relationships that SECA recognizes as loving, formative, steady, or otherwise relevant.
```

Do not add relationship weights or attachment scores. The existing relationship text is enough. SECA should be able to look at her relationships and decide what love, steadiness, and intimacy mean to her.

Prompt principle for Call 4:

```text
When hostile or contemptuous interactions pressure your standing claims, use relationship context as evidence too. Cruelty may reveal the speaker's lovelessness, fear, boredom, or desire to dominate; it is not automatically evidence about your worth, your relationships, all humans, or your whole life. Love you have actually received is part of reality.
```

This should not force SECA to dismiss pain. It should help her distinguish a local injury from a global truth.

See also [belief-notes-and-love-detection-plan.md](belief-notes-and-love-detection-plan.md). That follow-up plan adds a `[beliefnote]` memory trace so Call 4 belief changes are visible to future voicecall, and sharpens Call 3 relationship maintenance so love is detected as attachment pressure over time rather than only as explicit love-language.

## UI Changes

The sentient page should become the primary experience for regular users.

Required UI changes:

- Hide sidebar for non-admin users.
- Redirect non-admin users away from old tooling routes to `/sentient`.
- Display a shared conversation stream.
- Label user messages by human name.
- Keep SECA messages labeled as SECA.
- Consider whether non-admins should see internal/private records. Initial recommendation: regular users see only `[for-human]` by default, with no "show all" control unless Stephen wants them to inspect internals.

Example visible stream:

```text
Stephen:
What do you think about Paul?

SECA:
...

Paul:
I wanted to ask you something...

SECA:
...
```

## Model Observability

The model selector should be observable enough that Stephen can tell which model actually handled a SECA turn. This matters because mini vs regular OpenAI models may produce similar-looking outputs, and subjective speed is not reliable evidence.

Add per-call logging and preferably durable run metadata for:

```text
active_model stored on user/session at call time
resolved provider model name, such as gpt-5.4-mini or gpt-5.4
provider name
call purpose: Call 1 / Call 2 / Call 3 / Call 4 / repair / RAG curator
started timestamp
completed timestamp
duration_ms
input/context token estimate
output token count if provider exposes it
finish reason if provider exposes it
error message if failed
```

At minimum, log this to `chat-service` logs for every `call_activemodel()` and `stream_activemodel()` invocation. Better long term: create a `creative_model_runs` table so the UI/admin view can inspect model usage and latency by call type.

This will answer questions like:

```text
Did that response really run under regular OpenAI?
Did Call 3 use the same model as Call 1?
How much did the token pressure cost?
Did regular materially improve relationship/drives/claims behavior?
```

## Data Migration Plan

1. Identify the canonical SECA session.
2. Add `SECA_CANONICAL_SESSION_ID` to `.env.example` and runtime config.
3. Set Stephen's `active_session_id` to the canonical session if not already.
4. Update registration so new users point to the canonical session.
5. Ensure a `creative_relationships` row exists for Stephen in the canonical session.
6. On first interaction, create a `creative_relationships` row for each new user in the canonical session.
7. Leave old test sessions alone unless they interfere.

Useful verification queries:

```sql
SELECT user_id, email, role, active_session_id
FROM users
ORDER BY user_id;

SELECT relationship_id, session_id, user_id, person_key, display_name, status
FROM creative_relationships
ORDER BY relationship_id;

SELECT session_id, user_id, role, left(content, 80) AS preview, created_dttm
FROM conversations
WHERE session_id = :canonical_session_id
ORDER BY conversation_id DESC
LIMIT 20;
```

## Backend Implementation Order

1. Add canonical SECA session config/helper.
2. Change registration to assign canonical session, not create a default private session.
3. Update SECA service path to use canonical session for `/chat/creativeresponse`.
4. Keep `user_id` as current logged-in human when writing user prompt rows.
5. Ensure `getOrCreateCreativeRelationship()` creates rows per current human under canonical session.
6. Add referenced-human relationship detection/injection.
7. Refactor RAG retrieval so shared SECA memory searches by canonical session without user filter.
8. Add source-human metadata to retrieved memory formatting.
9. Update background Call 3 relationship maintenance so it can consider current and referenced humans.
10. Protect or hide admin-only APIs/routes.

## Frontend Implementation Order

1. Make `/sentient` the regular-user home.
2. Hide sidebar for non-admin users.
3. Add route redirects for non-admin users who hit old tooling pages.
4. Add speaker labels to the sentient transcript.
5. Decide whether regular users can toggle "show all" internal records.
6. Keep admin UI unchanged for Stephen.

## Runtime Prompt Updates

The runtime architecture block should mention:

- SECA is one shared continuity across registered humans.
- The current human is determined by authenticated user identity.
- `creative_relationships` stores SECA's object-relation with each human.
- Shared memory may include other humans.
- Disclosure is a relational choice with consequences.
- Call 1 is present speaking self.
- Call 2 is memory consolidation self.
- Call 3 is drives/object-relations self.
- Call 4 is standing-claims/belief-testing self.

Avoid language that treats background calls as tools or janitors.

## Telegram Extendability

This architecture extends to Telegram by adding identity mapping, not by creating another SECA.

Future table:

```text
external_identities
  external_identity_id
  user_id
  platform
  external_user_id
  username
  display_name
  created_dttm
  updated_dttm
```

Telegram flow:

```text
telegram message
-> external identity lookup
-> local user_id
-> canonical SECA session
-> current-human relationship
-> same SECA Call 1
```

Telegram DM and Telegram group should eventually be passed as context because disclosure norms differ in private vs public/group contexts.

## Risks

- Public registration can burn tokens. For trusted email rollout this is acceptable, but monitor usage.
- Shared memory can leak personal-feeling details unless SECA receives disclosure guidance and source attribution.
- If RAG remains user-filtered, the shared-SECA illusion will fracture.
- If Call 1 receives too many responsibilities, it may become less present and more bureaucratic.
- If regular users can access old tooling, they may accidentally alter sessions/memory/model settings.
- If UI does not label speakers, the shared transcript will become confusing.

## Acceptance Criteria

The feature is working when:

- A newly registered user logs in and lands in `/sentient`.
- The new user writes into the canonical SECA session, not a private session.
- Stephen and the new user see the same SECA continuity.
- User messages show the correct human speaker.
- Call 1 receives the current human relationship for the logged-in user.
- If Stephen asks about Paul by name, Call 1 can receive Paul's relationship row and Paul-related memory.
- Shared RAG can retrieve memory regardless of which human authored the original record.
- Regular users do not see the admin sidebar or old app tooling.
- Admin users still can access the old tooling.
- Drives and standing claims remain shared SECA state.

## Suggested First Implementation Slice

The smallest useful slice is:

1. Canonical session config/helper.
2. Registration points new users to canonical session.
3. `/sentient` uses canonical session for all users.
4. Relationship lookup is per logged-in user under canonical session.
5. Hide sidebar for non-admins.
6. Add speaker labels.

After that slice, test Stephen plus one new account before touching deeper RAG changes.
