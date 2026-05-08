# The Zero-Navigation Orb: Operations Analysis

To ensure the user almost never needs to leave the Ambient Dashboard, we must systematically map the standard lifecycle of backlog management to the conversational Orb paradigm. 

Based on industry standards for issue tracking (Agile, Kanban, GTD workflows) and modern tools (Linear, Jira, Asana), the lifecycle of a task generally falls into **Five Core Operations**.

Here is an analysis of those operations and how they can be fully integrated into the Orb concept.

---

## 1. Capture & Triage (The "Inbox" Phase)
*Typical operations: Quick capture, assigning priority, categorization, brain-dumping.*

**Current Orb Status: Excellent**
You can already type "Add a bug to TODOS, high priority." The AI parses intent, priority, and product perfectly.

**Missing Orb Features:**
- **Voice/Audio Capture:** If the Orb is a true ambient entity, speaking to it (e.g., via a mobile microphone button) would eliminate typing entirely.
- **Contextual Triage:** When you dump an idea, the Orb could reply: *"Added. Do you want to assign this to an existing group like 'Design'?"*

## 2. Query & Discovery (The "What's Next" Phase)
*Typical operations: Filtering by status, priority, due date, or text search.*

**Current Orb Status: Excellent (The Mini-List)**
The ability to ask "What's urgent?" and get a mini-list is a massive workflow accelerator. 

**Missing Orb Features:**
- **Quick-Filters in the Mini-List:** The mini-list could have horizontal scrolling chips at the top (e.g., "High Priority", "Recent") to manipulate the view without typing a new query.
- **"What did I do yesterday?"** A query that returns a mini-list of recently *closed* items to help with context recovery.

## 3. State & Lifecycle Management (The "Doing" Phase)
*Typical operations: Marking as done, moving to in-progress, blocking, deleting.*

**Current Orb Status: Good**
The mini-list allows closing items directly. The AI can also handle "Mark TODOS-24 as done" via the `update_todo` tool.

**Missing Orb Features:**
- **Inline Expansion in the Mini-List:** Currently, you can close an item. But what if you want to add a resolution note? Clicking an item in the mini-list could expand it *in place* like an accordion, revealing a quick text input for notes, without opening a new page.
- **Bulk Operations via AI:** The AI tool `update_todo` currently targets a single issue. A power-user feature would be allowing the AI to execute bulk commands: *"Archive all 'done' tasks in HELM."*

## 4. Enrichment & Breakdown (The "Refining" Phase)
*Typical operations: Adding URLs, writing long descriptions, breaking a large task into sub-tasks.*

**Current Orb Status: Basic**
The AI can add a description if asked, but enriching tasks usually requires full-page forms because of the sheer amount of text.

**Missing Orb Features:**
- **The "Focus Mode" Overlay:** If you ask the Orb to *"Break down TODOS-35"*, instead of navigating to the TodoView page, it could dim the background and bring up a floating, centralized modal specifically for editing that single task, keeping the ambient dashboard visible behind it.
- **Link Dropping:** You should be able to paste a URL directly into the Orb input, and it responds: *"I see a link. Should I attach this to an existing todo or create a new one?"*

## 5. Context Switching (The "Navigation" Phase)
*Typical operations: Moving between projects, opening settings, viewing help.*

**Current Orb Status: Very Good**
You have pills to click, and keyboard shortcuts (Left/Right arrows) to slide between projects.

**Missing Orb Features:**
- **Conversational Navigation:** You should be able to type *"Switch to Helm"* or *"Open Settings"* and the Orb executes a client-side routing action rather than making a DB query. 

---

## Conclusion & Next Steps

To make the Ambient Dashboard a true "Zero-Navigation" surface, the highest ROI features to build next would be:

1. **Inline Expansion in the Mini-list:** Let the user edit details, change priority, and add URLs directly inside the mini-list accordion without leaving the dashboard.
2. **Conversational Navigation:** Let the Orb control the UI state (switching projects, opening modals) via a new `client_action` tool.
3. **Bulk AI Operations:** Give the Orb the power to groom the backlog (archive, bulk-close) via natural language.
