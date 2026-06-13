# ORB-248 — Orb Toolbar & Mode Architecture

**Status:** Design — not approved for build  
**Todo:** ORB-248  
**Related:** ORB-251 (voice interaction), ORB-235 (original overflow), ORB-238 (universal small-pane model)

---

## Problem

The Orb conversation toolbar hides commands behind a More menu even on desktop/iPad where horizontal space is available. This was a deliberate simplification (ORB-238) — one layout for all platforms — but the command surface is growing. Current commands plus planned additions bring the total to 10+ actions, and two of them (Voice interaction, Import) are not actions at all but mode shifts that transform the entire Orb pane.

---

## Three Modes of the Orb Pane

The Orb pane is not a single interface — it is three interfaces that share the same screen real estate.

### 1. Text Conversation (current default)

The user types, the Orb responds, transcript scrolls. This is the existing experience.

**Commands available:** /Cmds, Voice dictation, Previous, Next, Copy input, Export transcript, Clear, Send/Stop.

### 2. Voice Conversation (ORB-251)

The Orb becomes the face of a spoken conversation. The user speaks, the Orb listens and responds audibly. The transcript still scrolls beneath — the conversation is translated to text in real time so it remains searchable and exportable.

**What changes:** The Orb visual (breathing circle) becomes the primary UI element — larger, centered, with listening/speaking state indicators. The textarea shrinks or disappears. The toolbar simplifies to mode-relevant controls (mute, end conversation, maybe volume). Text-specific commands (Previous, Next, Copy input) are irrelevant.

**In two-pane layout:** The Orb pane transforms in place. The list pane stays visible — the user can glance at their tasks while talking. The Orb takes over its half of the split, not the full screen.

### 3. Import

The Orb pane becomes a drop target. The user drags or selects files (text, CSV, images of lists), and the Orb processes them into structured todos.

**What changes:** The textarea and transcript are replaced by a drop zone with file preview and processing status. The toolbar simplifies to import-relevant controls (cancel, process, clear files).

**In two-pane layout:** Same principle — the Orb pane transforms, the list pane stays visible so the user can see todos appearing as the import processes them.

---

## Command Tiers

Not all commands are equal. Frequency and context determine where they live.

### Tier 1 — Mode Switchers (stable shell, always visible)

These switch between the three Orb modes. They persist across all modes.

| Command | What it does |
|---|---|
| Text | Enter/return to text conversation (default) |
| Voice | Enter voice conversation mode (ORB-251) |
| Import | Enter import mode |
| Send/Stop | Submit current input or cancel in-flight request |

Send/Stop is not a mode switcher but it's always relevant and always anchored to the far right.

### Tier 2 — Frequent within mode (promote on desktop/iPad)

Commands used multiple times per session within text conversation mode. On desktop and iPad, these have room to be inline. On iPhone, they go behind More.

| Command | Mode | What it does |
|---|---|---|
| /Cmds | Text | Toggle slash command menu |
| Previous (↑) | Text | Recall last input |
| Next (↓) | Text | Forward in input history |
| Voice dictation | Text | Dictate instead of typing (distinct from Voice mode) |

### Tier 3 — Infrequent (always behind More)

End-of-conversation or rare actions. Fine behind a menu on every platform.

| Command | Mode | What it does |
|---|---|---|
| Copy input | Text | Copy current textarea content |
| Export transcript | Text | Copy full conversation to clipboard |
| Export .md | Text | Download conversation as markdown file |
| Clear | Text | Reset conversation |

---

## Platform Layouts

### Mac (desktop — keyboard + mouse, split pane)

The power user environment. The Orb pane is typically 40–60% of the viewport in two-pane layout, or 100% when the list is hidden. Horizontal space is generous.

**Text mode toolbar:**
```
[/Cmds] [Dictation] [↑ Prev] [↓ Next]  ···  [More ⋮]  [Send]
```

Tier 1 mode switchers (Voice, Import) could live in the toolbar or in a mode selector above/below the Orb visual. Tier 2 commands are inline — there's room. Tier 3 stays behind More. Send/Stop is anchored far right.

**Voice mode:** The toolbar collapses to `[Text] [Mute] [End]` or similar. The Orb visual expands. The transcript area below stays but the input row transforms.

**Import mode:** The toolbar collapses to `[Text] [Cancel] [Process]`. The pane interior becomes the drop zone.

### iPad (tablet — touch, split pane in landscape)

Same two-pane layout as Mac. Touch targets are 44pt minimum. Horizontal space is tighter than Mac but still allows 4–5 inline buttons.

**Text mode toolbar:**
```
[/Cmds] [Dictation] [↑] [↓]  ···  [More ⋮]  [Send]
```

Same as Mac but labels may truncate to icons-only if space is tight. The More menu is the same grouped dropdown. Mode switchers in the same position as Mac.

**Voice mode / Import mode:** Same transformation as Mac — the Orb pane changes, the list pane stays.

### iPhone (mobile — touch, single pane)

The Orb pane is full-width. The list pane is a separate view reached by tapping the List toggle. Horizontal space is constrained — only 3–4 buttons fit inline.

**Text mode toolbar:**
```
[/Cmds] [Dictation] [More ⋮]  [Send]
```

Tier 2 navigation (Prev/Next) moves behind More on iPhone — not enough room. Mode switchers (Voice, Import) could be in More or in a top-level gesture/toggle.

**Voice mode:** Full-screen Orb visual with listening state. Minimal toolbar: `[Text] [Mute] [End]`. The transcript scrolls beneath the Orb.

**Import mode:** Full-screen drop zone / file picker. Minimal toolbar: `[Text] [Cancel] [Process]`.

---

## Open Design Questions

1. **Where do mode switchers live?** Options:
   - In the toolbar as buttons alongside commands (flat, discoverable, takes space)
   - As a segmented control above the toolbar (clear mode indication, uses vertical space)
   - As states of the Orb visual itself (tap the Orb to cycle modes — elegant but hidden)

2. **Voice dictation vs. Voice conversation:** These are different features. Dictation fills the textarea with spoken text (stays in text mode). Voice conversation is a full mode shift (ORB-251). They need distinct controls — a mic icon for dictation, a different affordance for voice mode. How to make this distinction clear?

3. **Mode transition animation:** The design brief says "elements arrive and depart, they don't appear and vanish." The mode switch should animate — the textarea could shrink as the Orb visual expands, the drop zone could fade in as the transcript fades out. What's the right duration and feel? The design brief says biological, not mechanical.

4. **Mode persistence:** When the user switches from Voice back to Text, does the conversation continue in the same transcript? (Probably yes — voice and text are both conversation, just different input methods.) When they switch from Import back to Text, is the import context cleared? (Probably yes — import is a discrete operation.)

5. **AppNav "More" button:** This is a separate concern from the Orb toolbar. The AppNav More opens a Commands modal containing Print, Export, Settings, What's New. These are app-level commands, not Orb commands. The current label "More" is confusing because the Orb toolbar also has a "More." Rename one? The AppNav version could be a gear icon or hamburger instead.

6. **Orb pane takeover in split view:** When Voice or Import mode activates in two-pane layout, the Orb pane transforms in place — the list pane remains visible and functional. This means mode-specific UI must fit within the Orb pane's current width, not assume full-screen. The drop zone and voice UI need to be designed for both 40% width (split) and 100% width (single pane).

---

## What This Plan Does NOT Cover

- Implementation details for ORB-251 (voice interaction) — that ticket owns the voice UX
- Import feature design — needs its own ticket and plan
- AppNav restructuring — separate concern, tracked in ORB-248 description but could be its own ticket
- Panel show/hide transitions (ORB-245) — related but independent
