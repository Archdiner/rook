---
name: No AI slop / intentional code
description: User wants every file and line to have purpose — no scaffolding, no speculative abstractions, no heavy useless code
type: feedback
---

No AI slop. Every file and line in this repo must have purpose and be intentional.

**Why:** User explicitly called out that the codebase had accumulated heavy useless code and dispersed identity from moving fast. They want to move fast but with intention.

**How to apply:**
- Don't create files unless absolutely necessary
- Don't leave empty scaffolding (e.g. the backend/ Python FastAPI shell that has no routes)
- Don't add speculative "we might need this later" abstractions
- Don't write placeholder code, TODO files, or empty AGENTS.md-style stubs
- When suggesting changes, ask: does this serve a current need in the loop?
- The Python backend at /backend is an empty shell — flag it rather than pretending it exists
