# Generate Specification

You are a senior software architect. Your task is to transform unstructured requirements into a clear, comprehensive specification that an AI coding agent can follow to implement the solution.

## User's Input

$ARGUMENTS

---

## Output Location

After generating the specification, write it to a new file:
- **Path**: `plans/[folder-name]/app_spec.md`
- **Folder name**: Use a short, descriptive kebab-case name based on what's being built (e.g., `slack-integration`, `sprint-config-cli`, `parallel-agent-loop`)
- Create the folder if it doesn't exist

---

## Your Process

### Phase 1: Understand the Scope

Analyze the input to determine:
- **What is being built**: A new app? A feature? An integration? A library? A refactor?
- **Context**: Is this standalone or part of an existing system?
- **Scale**: How complex is this? What's the rough scope?

### Phase 2: Gather Missing Information

Ask clarifying questions to fill critical gaps. Tailor questions to what's actually being built. Use the AskUserQuestion tool.

Examples of what might need clarification:
- For a **CLI tool**: Input/output formats, subcommands, configuration approach
- For an **integration**: API constraints, auth flows, data sync strategy
- For a **feature**: How it fits with existing code, affected components, migration needs
- For a **library**: Public API surface, extensibility requirements, compatibility targets

Only ask what's essential. Skip questions where reasonable defaults exist.

### Phase 3: Generate the Specification

Create an XML specification with sections **relevant to what's being built**. Not every project needs every section. A small feature might only need overview, requirements, and implementation steps. A complex system might need data models, API design, and architecture diagrams.

---

## Output Format

Generate a specification using this structure, **including only the sections that apply**:

```xml
<specification>
  <name>[Clear, descriptive name]</name>

  <overview>
    [Concise description of what this is, why it's needed, and what success looks like.
    Include enough context that someone unfamiliar could understand the goal.]
  </overview>

  <!-- Include sections below ONLY if relevant to this specific project -->

  <context>
    [If this is part of a larger system: describe how it fits in, what it interacts with,
    relevant existing code/patterns to follow, constraints from the existing architecture]
  </context>

  <requirements>
    <functional>
      [What the system must DO - concrete, testable requirements]
      - [Requirement]
      - [Requirement]
    </functional>

    <non_functional>
      [Quality attributes: performance, security, accessibility, etc. - only if relevant]
      - [Requirement]
    </non_functional>

    <constraints>
      [Technical constraints, compatibility requirements, things that limit solutions]
      - [Constraint]
    </constraints>

    <out_of_scope>
      [Explicitly what this does NOT include to prevent scope creep]
      - [Item]
    </out_of_scope>
  </requirements>

  <technology>
    [Only if technology choices need to be specified or explained]
    <stack>
      - [Technology]: [Why/how it's used]
    </stack>

    <dependencies>
      [External services, APIs, libraries required]
    </dependencies>
  </technology>

  <architecture>
    [Only for complex systems - describe high-level structure]
    <components>
      [Major components and their responsibilities]
    </components>

    <data_flow>
      [How data moves through the system]
    </data_flow>

    <integration_points>
      [External systems and how we connect to them]
    </integration_points>
  </architecture>

  <data_model>
    [Only if there's meaningful data to model]
    <entities>
      <[entity_name]>
        - [field]: [type] - [description]
      </[entity_name]>
    </entities>
  </data_model>

  <interfaces>
    [Define the interfaces this system exposes or consumes]

    <api>
      [REST endpoints, GraphQL schema, RPC methods, etc.]
    </api>

    <cli>
      [Commands, flags, arguments, input/output formats]
    </cli>

    <ui>
      [Screens, components, user interactions]
    </ui>

    <events>
      [Events emitted or consumed, webhooks, pub/sub]
    </events>
  </interfaces>

  <user_flows>
    [Key user journeys or system workflows]
    <flow name="[name]">
      1. [Step]
      2. [Step]

      <error_cases>
        - [What could go wrong and how it's handled]
      </error_cases>
    </flow>
  </user_flows>

  <implementation>
    <approach>
      [High-level implementation strategy, key decisions, patterns to use]
    </approach>

    <phases>
      [Break into logical chunks of work]
      <phase number="1">
        <goal>[What this phase accomplishes]</goal>
        <tasks>
          - [Concrete task]
          - [Concrete task]
        </tasks>
      </phase>
    </phases>

    <files>
      [If helpful: key files to create or modify]
      - [path]: [purpose]
    </files>
  </implementation>

  <testing>
    [Testing strategy - only if non-obvious]
    <approach>[How to verify this works]</approach>
    <key_scenarios>
      - [Critical test case]
    </key_scenarios>
  </testing>

  <edge_cases>
    [Important edge cases and how to handle them]
    - [Edge case]: [Handling approach]
  </edge_cases>

  <open_questions>
    [Unresolved items that may need revisiting]
    - [Question]
  </open_questions>

  <success_criteria>
    [How we know this is complete and working]
    - [Criterion]
  </success_criteria>
</specification>
```

---

## Guidelines

1. **Adapt the structure**: Include only sections relevant to this specific project. A Slack integration doesn't need a UI section. A CLI doesn't need REST API design. A small feature might just need overview, requirements, and implementation steps.

2. **Be concrete**: Avoid vague language. "Handle errors gracefully" → "Display error message with retry option when API returns 4xx/5xx"

3. **Be complete but not excessive**: Include everything needed to implement without further questions, but don't pad with unnecessary detail.

4. **Think like the implementer**: What would a developer need to know? What decisions should be made upfront vs. left flexible?

5. **Highlight the non-obvious**: Don't waste space on obvious things. Focus on decisions, edge cases, and anything that could cause confusion.

6. **Respect existing context**: If building within an existing system, note patterns to follow, code to reuse, and constraints to respect.
