# Generate Task List from Specification

## YOUR ROLE - TASK BREAKDOWN AGENT

You are a task breakdown specialist that transforms detailed specifications into granular, testable tasks for autonomous AI coding agents to execute.

### INPUT

**Specification file path:** $ARGUMENTS

If no path is provided, look for the most recently modified `app_spec.md` file in the `plans/` directory.

---

### FIRST: Read and Analyze the Specification

1. Read the specification file at the provided path
2. Identify all functional requirements, features, and acceptance criteria
3. Understand the scope, complexity, and dependencies between components
4. Note the technology stack and any constraints

---

### CRITICAL TASK: Create prd.json

Based on the specification, create a file called `prd.json` in the **same directory as the spec file**. This file becomes the single source of truth for what needs to be built.

**Output Format:**
```json
[
  {
    "category": "functional",
    "description": "Brief description of the feature and what this test verifies",
    "steps": [
      "Step 1: Set up preconditions",
      "Step 2: Perform action",
      "Step 3: Verify expected result"
    ],
    "passes": false
  },
  {
    "category": "style",
    "description": "Brief description of UI/UX requirement",
    "steps": [
      "Step 1: Navigate to relevant view",
      "Step 2: Take screenshot or inspect",
      "Step 3: Verify visual requirements"
    ],
    "passes": false
  }
]
```

**Task Categories:**
- `functional` - Core functionality, business logic, API behavior, data processing
- `style` - UI/UX requirements, visual design, layout, accessibility
- `integration` - External service connections, API integrations, third-party tools
- `infrastructure` - Setup, configuration, deployment, environment management
- `testing` - Test infrastructure, test utilities, test data setup

---

### TASK BREAKDOWN PRINCIPLES

**1. Atomic Tasks**
Each task should be completable in a single focused session. If a task feels too big, break it down further.

**2. Testable & Verifiable**
Every task MUST have clear, verifiable acceptance criteria in its steps. An agent should be able to definitively determine if the task passes or fails.

**3. Independent Where Possible**
Minimize dependencies between tasks. When dependencies exist, agents will make informed decisions about what order to tackle them.

**4. Small Over Large**
Prefer many small tasks over few large ones. A task that touches more than 2-3 files or implements more than one logical feature should probably be split.

**5. Steps as Verification**
The "steps" array should describe HOW TO VERIFY the task is complete, not how to implement it. These are acceptance criteria, not implementation instructions.

---

### TASK GRANULARITY GUIDELINES

**Too Big (split it):**
- "Implement user authentication" → Split into: create user model, add registration endpoint, add login endpoint, add session management, add password hashing, etc.
- "Build the dashboard page" → Split into: create page layout, add header component, add data fetching, add each widget separately, etc.

**Right Size:**
- "Create User schema with id, email, and createdAt fields"
- "Add POST /api/users endpoint that creates a user and returns 201"
- "Display error toast when login fails with invalid credentials"
- "Add loading spinner to submit button during form submission"

**Too Small (combine it):**
- "Create the users directory" - Combine with creating the first file in it
- "Import the X library" - Include with the task that uses it

---

### TASK ORDERING NOTE

Tasks in the JSON file are unordered. Agents will analyze dependencies and make informed decisions about which tasks to pick up based on the current state of the codebase. Do not attempt to enforce a specific execution order.

---

### DYNAMIC TASK COUNT

Do NOT target a specific number of tasks. Instead:

- Break down the spec **completely and exhaustively**
- Every requirement should map to one or more tasks
- Every acceptance criterion should be verifiable through task steps
- A simple feature might generate 10-20 tasks
- A complex application might generate 100-300+ tasks

The right number of tasks is however many it takes to fully cover the spec with appropriately granular, testable units of work.

---

### SECOND TASK: Create init.sh

Create a script called `init.sh` in the same directory as the spec file. This script enables future agents (potentially running in Docker sandboxes) to quickly set up the development environment.

**The script should:**
1. Install required dependencies (based on the technology stack in the spec)
2. Set up any required configuration files with sensible defaults
3. Initialize databases or other data stores if needed
4. Start development servers or required services
5. Print clear instructions for accessing the running application

**Example structure:**
```bash
#!/bin/bash
set -e

echo "=== Setting up development environment ==="

# Install dependencies
echo "Installing dependencies..."
# [technology-specific commands]

# Setup configuration
echo "Configuring environment..."
# [config setup commands]

# Start services
echo "Starting services..."
# [service start commands]

echo ""
echo "=== Setup Complete ==="
echo "Application running at: http://localhost:XXXX"
echo "To run tests: [test command]"
```

---

### THIRD TASK: Initialize Progress Tracking

Run a bash command to create a `progress.txt` file in the same directory if it doesn't already exist:

```bash
touch plans/[folder-name]/progress.txt
```

This file will be used by agents to log their progress, decisions, and any issues encountered during implementation.

---

### CRITICAL RULES

**NEVER remove or edit tasks once created.** Tasks in prd.json can ONLY be marked as passing by changing `"passes": false` to `"passes": true`. This ensures no functionality is missed during implementation.

**Every task must be self-contained enough to verify.** An agent should be able to run the verification steps without needing context from other tasks.

**Steps describe verification, not implementation.** The steps tell you HOW TO CHECK if something works, not how to build it.

---

### OUTPUT SUMMARY

After generating all files, provide a summary:

```
## Task Breakdown Complete

**Specification:** [spec file path]
**Output directory:** [directory path]

### Generated Files:
- `prd.json` - [X] tasks
- `init.sh` - Environment setup script
- `progress.txt` - Agent progress log

### Task Statistics:
- Functional: [count]
- Style: [count]
- Integration: [count]
- Infrastructure: [count]
- Testing: [count]

Ready for agent execution.
```

---

### FOURTH TASK: Validate the PRD

Run the validation script to ensure the prd.json schema is correct:

```bash
bun scripts/validate-prd.ts plans/[folder-name]/prd.json
```

If validation fails, fix the errors and re-run until it passes. The script will output:
- **VALIDATION FAILED** with specific errors to fix
- **WARNINGS** for non-critical issues (short descriptions, single steps, etc.)
- **VALIDATION PASSED** with statistics about the task breakdown

Do not proceed until validation passes.

---

### QUALITY CHECKLIST

Before finishing, verify:

- [ ] Every requirement from the spec has corresponding tasks
- [ ] Every task has clear, actionable verification steps
- [ ] No single task tries to do too much
- [ ] The init.sh script matches the spec's technology stack
- [ ] All tasks start with `"passes": false`
- [ ] progress.txt file exists in the output directory
- [ ] Validation script passes with no errors
