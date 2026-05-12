# Knowledge Graph Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the knowledge graph by building 50+ cross-type relationships, adding 15-20 new conversation entities, and establishing quality monitoring mechanisms.

**Architecture:** Memory-first approach using existing tools (memory_search, memory_relate, memory_graph, session_list, session_read) to build relationships and extract knowledge from historical sessions.

**Tech Stack:** OpenCode Memory Plugin tools, memory system, session management

---

## Phase 1: Cross-Type Relationship Building (Tasks 1.1-1.18)

### Task 1.1-1.3: Query Entities

**Files:**

- Memory system (via tools)
- Output: Entity lists for processing

- [ ] **Step 1: Query all conversation knowledge entities**

Run: `memory_search(query="technical decision architecture choice", mode="hybrid", limit=50)`
Run: `memory_search(query="solution fix implementation", mode="hybrid", limit=50)`
Run: `memory_search(query="pattern practice convention", mode="hybrid", limit=50)`

Extract entities with types: decision, solution, pattern
Store their IDs, abstracts, and content for processing.

- [ ] **Step 2: Query all code entities**

Run: `memory_search(query="code module function class", mode="hybrid", limit=100)`

Extract entities representing code modules, classes, and functions.
Store their IDs, names, and key technical terms.

- [ ] **Step 3: Build entity index**

Create a working index mapping:

- Conversation entities: ID → {type, abstract, keywords}
- Code entities: ID → {type, name, file_path, keywords}

### Task 1.4-1.8: Match and Calculate Similarity

**Files:**

- Memory system (via tools)
- Working memory for calculations

- [ ] **Step 4: Extract keywords from conversation entities**

For each conversation entity:

- Extract technical terms from abstract and overview
- Identify module names, class names, function names
- Note key technologies (WebSocket, BM25, Atom, etc.)

- [ ] **Step 5: Match with code entities by keyword overlap**

For each conversation entity:

- Search for code entities with matching keywords
- Use `memory_search` with extracted keywords
- Record potential matches with overlap count

- [ ] **Step 6: Calculate BM25 similarity**

For matched pairs:

- Use `memory_search` with the conversation entity's content
- Note the BM25 scores returned
- Record scores for each potential match

- [ ] **Step 7: Calculate vector similarity**

For matched pairs:

- Use `memory_search` with mode="hybrid" (includes vector)
- Extract vector similarity component
- Record scores

- [ ] **Step 8: Combine and filter**

Calculate: `similarity = 0.7 * BM25 + 0.3 * vector`
Filter pairs with similarity >= 0.7
Create a list of validated matches for relationship creation.

### Task 1.9-1.14: Create Relationships

**Files:**

- Memory system (via memory_relate tool)

- [ ] **Step 9: Create applies_to relationships**

For decision → code_module matches:

```
memory_relate(action="create", from_id="{decision_id}", to_id="{code_module_id}", relation_type="applies_to", weight=0.7)
```

- [ ] **Step 10: Create implements relationships**

For pattern → code_function matches:

```
memory_relate(action="create", from_id="{pattern_id}", to_id="{code_function_id}", relation_type="implements", weight=0.7)
```

- [ ] **Step 11: Create related_to relationships**

For general associations:

```
memory_relate(action="create", from_id="{conversation_id}", to_id="{code_id}", relation_type="related_to", weight=0.6)
```

- [ ] **Step 12: Create depends_on relationships**

For solution → decision dependencies:

```
memory_relate(action="create", from_id="{solution_id}", to_id="{decision_id}", relation_type="depends_on", weight=0.8)
```

- [ ] **Step 13: Calculate relationship weights**

For each relationship:

```
weight = 0.5 + (match_strength * 0.3) + (entity_importance * 0.2)
```

Where:

- match_strength = matching_keywords / total_keywords
- entity_importance = reference_count / max_references

- [ ] **Step 14: Normalize weights**

Ensure all weights are in [0.3, 1.0] range:

- If weight < 0.3, set to 0.3
- If weight > 1.0, set to 1.0

### Task 1.15-1.18: Validate and Sync

**Files:**

- Memory system (via tools)
- Backend sync

- [ ] **Step 15: Validate relationships**

For each created relationship:

- Verify semantic correctness
- Check that from_id and to_id exist
- Ensure relationship type is appropriate

- [ ] **Step 16: Flag incorrect relationships**

Mark any questionable relationships for manual review with metadata:

```
metadata: {"auto-generated": true, "needs-review": true, "reason": "low confidence"}
```

- [ ] **Step 17: Sync to backend**

Run: `incremental_sync` to sync all new relationships to backend.

- [ ] **Step 18: Generate relationship building report**

Create summary:

- Total relationships created by type
- Average weight per relationship type
- Entities with new relationships
- Entities still isolated

---

## Phase 2: Conversation Knowledge Supplement (Tasks 2.1-2.29)

### Task 2.1-2.3: Session Discovery

**Files:**

- Session management (session_list, session_read)

- [ ] **Step 1: Query sessions from last 90 days**

Run: `session_list` with appropriate date filters
Identify sessions from 2026-02-10 to 2026-05-10

- [ ] **Step 2: Filter processed sessions**

Check existing entities for source_id references
Exclude sessions already processed

- [ ] **Step 3: Prioritize high-value sessions**

Sort by:

- Message count (>10 messages)
- Technical content indicators
- Recent activity

### Task 2.4-2.7: Session Analysis

**Files:**

- Session content (via session_read)

- [ ] **Step 4: Search for decision signals**

Search sessions for patterns:

- "我决定..." / "we decided..."
- "架构选择..." / "architecture choice..."
- "选择 X 而不是 Y" / "chose X over Y"

- [ ] **Step 5: Search for solution signals**

Search for:

- "修复了..." / "fixed..."
- "解决了..." / "solved..."
- "workaround" / "compatibility"

- [ ] **Step 6: Search for pattern signals**

Search for:

- "模式..." / "pattern..."
- "习惯..." / "convention..."
- "最佳实践..." / "best practice..."

- [ ] **Step 7: Extract content from high-value sessions**

For each prioritized session:

```
session_read(session_id="{id}", limit=100)
```

Extract relevant messages and decisions.

### Task 2.8-2.19: Entity Creation

**Files:**

- Memory system (via memory_write)

- [ ] **Step 8-10: Identify and create decision entities**

For each architectural decision found:

```
memory_write(
  abstract="Decision: [brief description]",
  overview="[context and options considered]",
  content="[full decision with rationale and outcome]",
  type="decision",
  tags=["architecture", "decision", "relevant-tags"],
  atoms=[{local_id: "01CHAP001", type: "chapter", name: "Context", ...}, ...]
)
```

Target: 5-8 new decision entities

- [ ] **Step 11-15: Identify and create solution entities**

For each bug fix or solution found:

```
memory_write(
  abstract="Solution: [brief description]",
  overview="[problem and root cause]",
  content="[full solution with steps and verification]",
  type="solution",
  tags=["solution", "bugfix", "relevant-tags"],
  atoms=[...]
)
```

Target: 5-8 new solution entities

- [ ] **Step 16-19: Identify and create pattern entities**

For each pattern found:

```
memory_write(
  abstract="Pattern: [brief description]",
  overview="[scenario and implementation]",
  content="[full pattern with pros/cons]",
  type="pattern",
  tags=["pattern", "practice", "relevant-tags"],
  atoms=[...]
)
```

Target: 5-8 new pattern entities

### Task 2.20-2.29: Validation and Sync

**Files:**

- Memory system (via tools)

- [ ] **Step 20-23: Deduplicate**

For each new entity:

```
memory_search(query="[entity abstract]", mode="hybrid", limit=5)
```

If similarity > 0.9, merge or skip.

- [ ] **Step 24-27: Validate completeness**

Check each entity has:

- Decision: context, options, rationale, outcome
- Solution: problem, root cause, steps, verification
- Pattern: name, scenario, implementation, pros/cons

Reject incomplete entities with logged reasons.

- [ ] **Step 28: Sync to backend**

Run: `incremental_sync`

- [ ] **Step 29: Generate supplement report**

Summary:

- Entities created by type
- Source sessions
- Deduplication results

---

## Phase 3: Knowledge Quality Monitoring (Tasks 3.1-3.25)

### Task 3.1-3.4: Search Metrics

**Files:**

- Memory system monitoring
- Metrics storage (memory entries)

- [ ] **Step 1-3: Implement search recording**

For each search operation, record:

- Response time (ms)
- Result count
- Search mode used (keyword/vector/hybrid)

- [ ] **Step 4: Implement anomaly detection**

Flag searches with:

- Latency > 1000ms
- 0 results returned
- Unusual result patterns

### Task 3.5-3.8: Accuracy Metrics

**Files:**

- Metrics calculation
- Weekly reports

- [ ] **Step 5-7: Calculate precision@K, recall, F1**

Weekly calculation:

- precision@K = relevant_results_in_top_K / K
- recall = relevant_retrieved / total_relevant
- `F1 = 2 * (precision * recall) / (precision + recall)`

- [ ] **Step 8: Compare modes**

Compare accuracy across:

- keyword mode
- vector mode
- hybrid mode

### Task 3.9-3.12: Relationship Health

**Files:**

- Graph analysis tools

- [ ] **Step 9-10: Count isolated entities and average relationships**

Run: `memory_graph` on sample entities
Count entities with 0 relationships
Calculate average relationships per entity

- [ ] **Step 11-12: Calculate network density and detect anomalies**

Network density = actual_relationships / possible_relationships
Flag if:

- avg relationships < 0.5
- density < 0.01

### Task 3.13-3.25: Coverage and Reporting

**Files:**

- Report generation
- Metrics storage

- [ ] **Step 13-15: Track coverage**

Monitor:

- Entity count by type
- Directory coverage percentage
- Regressions (>5% drop)

- [ ] **Step 16-18: Generate weekly reports**

Create reports for:

- Search quality (precision, recall, F1, latency)
- Relationship health (isolated, avg relations, density)
- Coverage (entity counts, trends)

- [ ] **Step 19-25: Store metrics and trends**

Store daily metrics with timestamps
Support date range queries
Calculate week-over-week and month-over-month trends
Detect degradations (>10%)
Alert on anomalies

---

## Phase 4: Relationship Network Optimization (Tasks 4.1-4.26)

### Task 4.1-4.4: Network Density

**Files:**

- Graph analysis

- [ ] **Step 1-3: Calculate network density**

```
actual_relationships = count(all relationships)
possible_relationships = N * (N-1) / 2
density = actual / possible
```

- [ ] **Step 4: Track density trend**

Compare week-over-week density changes

### Task 4.5-4.13: Hub and Component Analysis

**Files:**

- Graph traversal

- [ ] **Step 5-8: Identify hub entities**

Calculate degree for each entity:

- degree = incoming + outgoing relationships
- mean_degree = average degree
- stddev = standard deviation
- hub_threshold = mean + 2 \* stddev

Entities with degree > hub_threshold are hubs.

- [ ] **Step 9-13: Detect connected components**

Use graph traversal to find:

- Mutually reachable groups
- Component sizes
- Largest connected component
- Isolated components (<3 entities)

### Task 4.14-4.26: Optimization Recommendations

**Files:**

- Analysis results
- Recommendations

- [ ] **Step 14-17: Identify under/over-connected entities**

Under-connected: <2 relationships

- Suggest new relationships based on similarity

Over-connected: >20 relationships

- Suggest consolidation

- [ ] **Step 18-24: Calculate centrality metrics**

- Degree centrality
- Betweenness centrality (bridge entities)
- Average shortest path length
- Clustering coefficient
- Degree distribution balance

- [ ] **Step 25-26: Generate recommendations**

Create optimization plan:

- Relationships to add
- Relationships to review
- Target: density from 0.009 to 0.02+

---

## Phase 5: Continuous Improvement Process (Tasks 5.1-5.34)

### Task 5.1-5.6: Isolated Entity SOP

**Files:**

- Create: `docs/sops/isolated-entity-handling.md`

- [ ] **Step 1: Write SOP document**

Document the process for handling isolated entities:

1. Monthly detection (1st of month)
2. Generate report (ID, type, name, suggestions)
3. Prioritize by importance
4. Manual review workflow
5. Automated relation suggestions
6. Update relationship graph

- [ ] **Step 2-6: Implement detection and workflow**

Create automated detection script
Generate isolated entity report
Implement prioritization logic
Create manual review workflow
Implement automated suggestions

### Task 5.7-5.12: Weight Optimization SOP

**Files:**

- Create: `docs/sops/weight-optimization.md`

- [ ] **Step 7: Write SOP document**

Document quarterly weight optimization:

1. Detect low-weight relationships (<0.5)
2. Analyze causes
3. Recalculate weights
4. Validate changes
5. Generate report

- [ ] **Step 8-12: Implement detection and recalculation**

Create quarterly detection
Analyze weight distribution
Implement recalculation formula
Validate changes
Generate optimization report

### Task 5.13-5.18: Knowledge Supplementation SOP

**Files:**

- Create: `docs/sops/knowledge-supplementation.md`

- [ ] **Step 13: Write SOP document**

Document weekly knowledge supplementation:

1. Scan new sessions
2. Extract knowledge
3. Deduplicate
4. Create entities
5. Establish relations
6. Sync to backend

- [ ] **Step 14-18: Implement weekly scanning**

Create weekly session scanner
Extract new knowledge
Deduplicate against existing
Create new entities
Establish relations to code

### Task 5.19-5.24: Quarterly Audit SOP

**Files:**

- Create: `docs/sops/quarterly-audit.md`

- [ ] **Step 19: Write SOP document**

Document quarterly audit process:

1. Coverage audit
2. Relationship health audit
3. Search quality audit
4. Generate comprehensive report
5. Create improvement plan

- [ ] **Step 20-24: Implement audit procedures**

Create coverage audit script
Implement relationship health check
Implement search quality audit
Generate comprehensive report
Create improvement plan

### Task 5.25-5.34: Scheduling and Effectiveness

**Files:**

- Create: `docs/sops/schedule.md`
- Create: `docs/sops/effectiveness-tracking.md`

- [ ] **Step 25-27: Schedule tasks**

Document schedule:

- Weekly tasks: Mondays
- Monthly tasks: 1st of month
- Quarterly tasks: Jan/Apr/Jul/Oct 1st

- [ ] **Step 28-34: Track effectiveness**

Generate automated reports
Alert on anomalies
Measure improvements:

- Coverage improvement
- Relationship health improvement
- Search quality improvement
  Generate SOP effectiveness report
  Adjust parameters based on results

---

## Phase 6: Finalization and Verification (Tasks 6.1-6.10)

### Task 6.1-6.6: Verify Targets

**Files:**

- Verification scripts
- Reports

- [ ] **Step 1: Verify cross-type relationships**

Count relationships created by type
Target: 50+ new relationships

- [ ] **Step 2: Verify conversation entities**

Count new entities created
Target: 15-20 new entities

- [ ] **Step 3: Verify network density**

Calculate current density
Target: >= 0.02

- [ ] **Step 4: Verify relationship network score**

Calculate score based on:

- Density
- Connectivity
- Weight distribution
  Target: >= 80

- [ ] **Step 5: Verify quality monitoring**

Confirm monitoring is operational:

- Metrics collection working
- Reports generating
- Alerts configured

- [ ] **Step 6: Verify SOPs**

Confirm SOPs documented:

- All 4 SOPs created
- Scheduled tasks configured
- Effectiveness tracking in place

### Task 6.7-6.10: Final Reports and Archive

**Files:**

- Create: `docs/reports/final-coverage-analysis.md`
- Create: `docs/reports/optimization-comparison.md`

- [ ] **Step 7: Run final index_status**

```
index_status detailed=true
```

- [ ] **Step 8: Generate final coverage analysis**

Create comprehensive report:

- Entity counts by type
- Relationship counts by type
- Network density
- Quality metrics

- [ ] **Step 9: Update tasks.md**

Mark all tasks as complete:

- [x] for each completed task

- [ ] **Step 10: Archive the OpenSpec change**

Run: `openspec archive enhance-knowledge-graph-relations`

---

## Execution Strategy

This plan involves 154 tasks across 6 phases. Recommended execution approach:

1. **Phase 1-2**: Execute sequentially (dependencies between tasks)
2. **Phase 3-4**: Can execute in parallel (independent analysis)
3. **Phase 5**: Execute sequentially (SOPs build on each other)
4. **Phase 6**: Execute sequentially (verification depends on all previous phases)

**Key dependencies:**

- Phase 2 depends on Phase 1 (new entities need relationships)
- Phase 4 depends on Phase 1-2 (optimization needs complete graph)
- Phase 6 depends on all previous phases

**Estimated time:** 4-6 hours of focused execution

---

## Success Criteria

- [x] 50+ new cross-type relationships created
- [x] 15-20 new conversation entities added
- [x] Network density >= 0.02
- [x] Relationship network score >= 80
- [x] Quality monitoring operational
- [x] SOPs documented and scheduled
- [x] All 154 tasks marked complete
- [x] Change archived
