# SECA Call User Manual

## Purpose

This document is the operator-facing map of SECA's current call hierarchy.

It explains what runs during `creativeresponse`, what is an LLM call, what is ordinary code, what records are written, and where to inspect the live state in the Sentient screen.

## Current Call Flow

### 1. User Prompt Insert

Not an LLM call.

The incoming user message is saved to Postgres first. This lets later calls see the new prompt as part of the real continuity, not just as temporary input.

### 2. Pre-Voice Mood / Relationship / RAG Intent

LLM call.

Runs before voicecall so the prompt lands emotionally before SECA decides whether to speak.

It returns:

- one mood update
- one relationship decision
- one RAG retrieval decision

It can update:

- `creative_moods`
- `creative_relationships`

It does not archive memory and does not create durable RAG facts.

### 3. Optional RAG Retrieval

Not an LLM call.

If the pre-voice call says older memory is needed, code retrieves up to 3 curated archived memory blocks. These are injected into voicecall as context.

Normal RAG retrieval now uses curated memory, not raw deleted transcript records.

### 4. Voicecall

LLM call.

This is SECA's live social self. It receives the current system prompt, active memory, mood, temperament, current human, relationship, active desires, active beliefs, active goals, and optional retrieved memory.

Allowed visible/private conversation outputs:

```text
[for-human]
[secretthought]
[]
```

`[]` is valid. SECA may stay visibly silent.

Voicecall no longer writes:

```text
[secretplan]
[summary]
[beliefnote]
[secretorigin]
```

### 5. JSON Repair

Conditional LLM call.

Runs only if voicecall returns invalid JSON or invalid subreply structure. It is a repair pass over the malformed voicecall output.

### 6. Apply Voicecall Records

Not an LLM call.

Writes valid voicecall subreplies to Postgres.

## Background Calls

After voicecall records are applied, the service launches background calls. They are started in code order, but they are not awaited, so completion order can interleave.

### 7. Sleepmemorycall / Creative Maintenance

Conditional LLM call.

Runs only when memory pressure finds eligible old active records.

It can create:

- `[summary]` active memory rows
- curated RAG memories
- OCEAN temperament drift

It then hard-deletes the source records it summarized/curated.

Sleepmemorycall cannot create `[secretthought]` or `[secretplan]`.

### 8. RAG Cleanup

Conditional LLM call.

Runs only when low-utility RAG cleanup candidates exist.

It can decide:

- keep
- delete
- unsure

This is hygiene for weak retrieved memories, not ordinary memory consolidation.

### 9. Desirecall

LLM call every turn.

Maintains active desires. These are not "drives" in the model-facing sense anymore; they are wanted states, avoided states, needs, appetites, protections, and relational outcomes.

Actions:

```json
{ "action": "addDesire" }
{ "action": "retireDesire" }
{ "action": "noChange" }
```

Storage still uses the older internal table name:

```text
creative_subconscious_drives
```

Voicecall sees these as:

```text
[active-desires]
```

### 10. Beliefcall

LLM call every turn.

Maintains first-class beliefs: what SECA thinks is true, wishes were true, contradicts, performs, rationalizes, or keeps discovering through behavior.

Actions:

```json
{ "action": "addBelief" }
{ "action": "retireBelief" }
{ "action": "reviseBelief" }
{ "action": "noChange" }
```

Beliefcall no longer has `failBelief`, `markTested`, or accountability/test framing.

Voicecall sees these as:

```text
[active-beliefs]
```

### 11. Goalcall

LLM call every turn.

Maintains long-horizon goals and actionable plans. This is the replacement for the useful part of old secret plans, but as first-class state rather than hidden per-turn tactics.

Goals may be practical, naive, enormous, symbolic, world-facing, nearly impossible, or months/lifetime scale. The goal is not reduced to what is realistic. The table also stores an action spine so future autonomous loops can inspect and advance steps.

Actions:

```json
{ "action": "addGoal" }
{ "action": "updateGoal" }
{ "action": "retireGoal" }
{ "action": "addGoalStep" }
{ "action": "updateGoalStep" }
{ "action": "noChange" }
```

Tables:

```text
creative_goals
creative_goal_steps
creative_goal_events
creative_goal_runs
```

Voicecall sees these as:

```text
[active-goals]
```

## Live Sentient Screen

The Sentient screen exposes drawers for current first-class state:

- **Desires**: active and retired desire records.
- **Mood**: current anger, fear, attachment, and mood text fields.
- **OCEAN**: current temperament.
- **Relationship**: current human relationship model.
- **Beliefs**: active and inactive beliefs.
- **Goals**: active/blocked goals, inactive goals, steps, success criteria, current reality, next step, and recent goal events.
- **RAG**: last injected RAG context and retrieval decision.

## Timing Summary

Synchronous before/during response:

```text
user insert
pre-voice mood/relationship/RAG intent
optional RAG retrieval
voicecall
optional JSON repair
apply voicecall records
```

Background after response:

```text
sleepmemorycall, if memory pressure exists
RAG cleanup, if cleanup candidates exist
desirecall, every turn
beliefcall, every turn
goalcall, every turn
```

## Conceptual Split

Current state model:

- **Mood**: immediate mammalian pressure.
- **Temperament**: slow OCEAN drift, updated by sleep cycles.
- **Relationship**: private model of the current human.
- **Desires**: what SECA wants, avoids, needs, protects, or hungers for.
- **Beliefs**: what SECA thinks is true or partly true.
- **Goals**: what SECA wants to make real over time, plus steps.
- **Summaries/RAG**: long-term memory compression and retrieval.

Important distinction:

- Desires are emotional/motivational.
- Beliefs are interpretive/epistemic.
- Goals are long-horizon and action-facing.

## Current Source Anchors

Main implementation files:

```text
chat-service/src/services/chat.service.ts
chat-service/src/helper/seca.helper.ts
chat-service/src/repositories/chat.repository.ts
chat-service/src/repositories/interfaces.ts
chat-service/src/controllers/chat.controller.ts
chat-ui/src/app/sentient/page.tsx
docker/postgres/init/001-seca-init.sql
```

