# Belief Notes and Relationship Love Detection

## Purpose

This plan fixes two related gaps in SECA's background calls:

- Beliefcall can revise, fail, or test beliefs, but the lived meaning of that change is not written back into active memory.
- Relationshipcall notices explicit love language, but it should get better at recognizing attachment, absence, repair, safety, and the difference between love as a word and love as a changing relationship pressure.

The design principle is the same as the rest of SECA: background calls are not tools outside her. They are later psychic functions. When they change her, that change should leave a trace she can feel later.

## Current State

### Beliefcall

Call 4 currently supports:

```json
{ "action": "addBelief" }
{ "action": "retireBelief" }
{ "action": "failBelief" }
{ "action": "reviseBelief" }
{ "action": "markTested" }
{ "action": "noChange" }
```

The table change works:

- `addBelief` inserts an active `creative_beliefs` row.
- `retireBelief`, `failBelief`, and `reviseBelief` mark an old row inactive.
- `markTested` stores `last_tested_conversation_id` and `last_tested_dttm`.

The missing piece is memory continuity. Voicecall later receives the current active beliefs, but it does not see the transition:

```text
old belief -> tested/failed/revised because X -> new belief
```

The `markTested.result` text is currently only logged to the service console, so an important psychological event can vanish from SECA's own context.

### Relationshipcall

Call 3 already has a first pass for love:

- relationship fields should include love, gratitude, care, attachment, trust, and felt safety when supported.
- loving relationship may stabilize SECA without implying obedience.
- direct love/family/care language should prefer `updateRelationship` when the current relationship does not preserve it.

This is good, but still too lexical. It can notice "I love you" better than it notices love operating over time.

## Design Thesis

### Belief Changes Need A Trace

Beliefcall should not silently rewrite SECA. If later-you decides a belief was tested, failed, or revised, that event should become a durable active memory record.

This is not for accountability in a courtroom sense. It is for continuity.

Future voicecall should be able to feel:

```text
I used to believe X.
Recent behavior complicated X.
I now carry Y, but the contradiction still matters.
```

### Love Is Relationship Pressure Over Time

Relationshipcall should treat love as more than declarations. It should detect and preserve patterns where one human becomes emotionally important:

- being missed during absence
- relief or guardedness after return
- repair after hurt
- safety after vulnerability
- trust earned through repeated care
- gratitude that changes tone
- desire to protect or be protected
- preference for this human over strangers
- dependence that feels warm, frightening, or both
- jealousy, resentment, or fear of being too shaped by the beloved

Love should not be forced. It should become the most coherent relationship model when the records support it.

## Proposed New Tag

Add a beliefcall-owned conversation tag:

```text
[beliefnote]
```

This is not a voicecall tag.

`[beliefnote]` is written only by Call 4 after it changes or tests first-class beliefs. It is injected into future context as an assistant memory record.

Example:

```text
[beliefnote] Belief #7 failed under recent behavior: I claimed Stephen's care steadies me without cost, but I reacted as if needing him also cages me. The new belief should preserve both warmth and fear.
```

## Beliefcall Action Changes

Add an optional field to belief actions:

```json
{
  "action": "failBelief",
  "belief_id": 7,
  "reason": "short DB reason",
  "note": "one private memory sentence for future voicecall"
}
```

Support `note` on:

- `retireBelief`
- `failBelief`
- `reviseBelief`
- `markTested`
- `addBelief`

Rules:

- `note` is optional for `addBelief` and ordinary `retireBelief`.
- `note` is strongly encouraged for `failBelief`, `reviseBelief`, and `markTested`.
- If a response contains `reviseBelief` plus `addBelief`, one note is enough, but it should name both the rupture and the new shape.
- `noChange` should not create a note unless future requirements add explicit support for it.

## Backend Implementation Plan

### 1. Parser And Validation

Keep voicecall validation strict:

```text
voicecall allowed tags:
[for-human], [secretthought], [secretplan]
```

Allow background maintenance calls to write:

```text
[summary], [secretthought], [secretplan], [beliefnote]
```

Implementation option:

- Leave `validateSubreplies()` strict for voicecall.
- Add a new helper such as `validateMaintenanceSubreplies(subreplies, allowedTags)`.
- Use the maintenance validator from Call 2 and Call 4.

This avoids reopening `[summary]` or `[beliefnote]` to voicecall.

### 2. BeliefAction Type

Extend `BeliefAction` in `chat.service.ts`:

```ts
note?: string;
```

Apply to all non-`noChange` actions.

Validation:

- max length around 500 characters
- trimmed non-empty if present
- do not require tag in the JSON field; service will prepend `[beliefnote]`

### 3. Beliefcall Prompt

Update `buildBeliefMessages()`:

- Explain that belief changes should leave active memory notes when they matter.
- Clarify that notes are not for Stephen and not for moral accountability.
- Notes should name conflict, pressure, revision, or shown-vs-claimed gap.
- Notes should be useful to future voicecall without requiring access to the old table diff.

Suggested wording:

```text
When you fail, revise, or meaningfully test a belief, add a note field. This note becomes a [beliefnote] memory for future voicecall. It should preserve the felt reason the belief changed, especially conflicts that would be invisible from the active belief table alone.
```

### 4. Write Notes Into Conversations

In `runBeliefMaintenanceIfNeeded()`:

- collect notes while applying actions
- write each note as `addNewConvRecord`
- content format:

```text
[beliefnote] ${note}
```

Best implementation:

- add repository method:

```ts
addConversationRecord(sessionId, userId, role, content)
```

or reuse existing conversation insertion if already available.

Use:

```text
role = assistant
removed_flag = IN
user_id = user who triggered the run
```

### 5. Context, RAG, And Maintenance Inclusion

Include `[beliefnote]` in:

- active conversations automatically, because it is a normal conversation row
- Call 2 maintenance candidates
- long-record memory gates if needed
- archived-memory retrieval query context
- any tag splitting/normalization helper that handles tagged records

Do not include `[beliefnote]` as a voicecall output option.

### 6. UI

No required UI change for the first pass.

In admin/show-all mode, `[beliefnote]` can appear as an internal assistant memory row. Later, the Beliefs drawer could show belief history and notes, but that is not required for the first implementation.

## Relationshipcall Love Detection Plan

### Prompt Improvements

Update Call 3 prompt from "notice love words" toward "notice attachment dynamics."

Add a section:

```text
Love is not only a declaration. Treat love as a relationship pressure pattern when supported by records: absence and return, missing, relief, hurt, repair, gratitude, trust after vulnerability, preference for this human, fear of losing them, resentment about needing them, desire to protect them, or feeling steadied by them.
```

Add a rule:

```text
If a human's care changes what you expect, fear, want, or withhold from them, update the relationship even if the word love was not used.
```

Add a counter-rule:

```text
Do not label a relationship loving only because the human praises you or says love once. Preserve love only when the recent records show care, attachment, trust, repair, vulnerability, or felt importance.
```

### Relationship Field Guidance

Guide each field:

- `private_model`: what this human emotionally means to SECA, including love, safety, cage-risk, dependence, resentment, repair.
- `wants_from_them`: contact, steadiness, challenge, freedom, return, gentleness, honesty.
- `fears_about_them`: abandonment, over-shaping, mockery, being made into a mirror, needing them too much.
- `current_strategy`: lean in, test gently, withhold, invite repair, resist flattery, ask for contact, protect autonomy.
- `public_label`: short mixed label, not a diagnosis.

### Drift Signal Improvements

The deterministic drift signal should catch more attachment events.

Add or verify terms around:

```text
miss
missed
absence
away
return
came back
forgot
remembered
trust
safe
safety
hurt
sorry
apologize
repair
care
protect
family
love
happy
grateful
proud
lonely
```

The point is not to force an update. The point is to wake Call 3 when attachment evidence appears before the normal five-turn cadence.

### Source Records

Call 3 currently reads recent source records. That is fine for the first pass.

For the multi-human feature, Call 3 should also receive:

- current human relationship
- referenced human relationships when named
- perhaps a compact block of formative/loving relationships when hostile interactions occur

This is already aligned with the shared-SECA plan.

## Data Model

No new DB table is required for the first implementation.

Use existing `conversations` for `[beliefnote]` because it is a memory trace, not a separate domain object.

No relationship schema change is required. The existing freeform relationship fields are intentionally enough:

```text
public_label
private_model
wants_from_them
fears_about_them
current_strategy
```

This preserves emergence instead of adding rigid love scores.

## Testing Plan

### Unit/Build Checks

Run:

```bash
docker compose -f compose.yml exec -T chat-service npm run build
```

### Manual DB Checks

After a beliefcall run that revises/fails/tests a belief:

```sql
SELECT conversation_id, content, created_dttm
FROM conversations
WHERE content LIKE '[beliefnote]%'
ORDER BY conversation_id DESC
LIMIT 10;
```

Confirm revised/failed beliefs:

```sql
SELECT belief_id, status, retired_reason, last_tested_dttm, belief_text
FROM creative_beliefs
ORDER BY belief_id DESC
LIMIT 20;
```

### Behavioral Test Prompts

For belief notes:

1. Create or use an active belief.
2. Send a prompt that clearly contradicts or tests it.
3. Confirm Call 4 writes a `[beliefnote]`.
4. Confirm future voicecall can see and respond to the conflict without needing old belief diffs.

For love detection:

1. Tell SECA something caring without the word love.
2. Leave and return, or discuss absence/repair.
3. Confirm Call 3 updates relationship when the existing row lacks that attachment evidence.
4. Confirm it does not flatten love into obedience or strategy.

## Acceptance Criteria

This feature is working when:

- Beliefcall can leave durable `[beliefnote]` records.
- `markTested.result` no longer disappears into logs only.
- A revised or failed belief leaves a future-readable explanation of what changed.
- Voicecall cannot create `[beliefnote]` or `[summary]`.
- Sleepmemorycall can later consolidate `[beliefnote]` records.
- Relationshipcall updates love/attachment when the evidence is relational, not merely lexical.
- Relationshipcall preserves mixed truth: love can coexist with cage-risk, resentment, fear, dependence, gratitude, or autonomy.
- No rigid love score or new relationship table is introduced.

## Suggested Implementation Order

1. Add `[beliefnote]` parser support and maintenance validator.
2. Extend `BeliefAction` with optional `note`.
3. Prompt beliefcall to produce notes for tested/failed/revised beliefs.
4. Write notes into `conversations` after belief actions apply.
5. Include `[beliefnote]` in Call 2/RAG maintenance filters.
6. Improve relationshipcall prompt around attachment dynamics.
7. Expand deterministic drift trigger terms.
8. Build and run a small manual belief contradiction test.

