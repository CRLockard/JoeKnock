$issues = Get-Content .tmp_issues.json -Raw | ConvertFrom-Json

function Get-SectionText($body, $header, $nextHeaders) {
  $patternNext = ($nextHeaders | ForEach-Object {[regex]::Escape($_)}) -join '|'
  $pattern = "(?s)##\s+$([regex]::Escape($header))\s*(.*?)(?=##\s+(?:$patternNext)|\z)"
  $m = [regex]::Match($body, $pattern)
  if ($m.Success) { return $m.Groups[1].Value.Trim() }
  return ''
}

function Get-Bullets($text) {
  $normalized = ($text -replace "`r?`n", ' ').Trim()
  $bullets = @()

  $checkMatches = [regex]::Matches($normalized, '-\s*\[\s*\]\s*(.*?)(?=\s+-\s*\[\s*\]|\z)')
  if ($checkMatches.Count -gt 0) {
    foreach ($m in $checkMatches) {
      $item = $m.Groups[1].Value.Trim()
      if ($item) { $bullets += $item }
    }
    return $bullets
  }

  $lineMatches = [regex]::Matches($text, '(?m)^\s*[-*]\s+(.*)$')
  foreach ($m in $lineMatches) {
    $item = $m.Groups[1].Value.Trim()
    if ($item) { $bullets += $item }
  }

  if ($bullets.Count -eq 0 -and $normalized -match '\S') {
    $parts = $normalized -split '\s+-\s+'
    foreach ($part in $parts) {
      $item = ($part -replace '^[-*]\s*','').Trim()
      if ($item) { $bullets += $item }
    }
  }

  $expanded = @()
  foreach ($b in $bullets) {
    if ($b -match '\s+-\s+' -and $b -notmatch 'https?://') {
      $parts = $b -split '\s+-\s+'
      foreach ($p in $parts) {
        $item = ($p -replace '^[-*]\s*','').Trim()
        if ($item) { $expanded += $item }
      }
    } else {
      $expanded += $b
    }
  }

  $bullets = $expanded
  return $bullets
}

function Normalize-Title($rawTitle){
  return ($rawTitle -replace '—','-' -replace 'ΓÇö','-' -replace 'Î“Ã‡Ã¶','-').Trim()
}

function Build-Ticket($issueObj, $fileStatus, $deps, $testRefs){
  $num = $issueObj.number
  $title = Normalize-Title([string]$issueObj.title)
  $labels = @($issueObj.labels.name)
  $priority = if ($labels -contains 'priority:p0') {'P0'} elseif ($labels -contains 'priority:p1') {'P1'} elseif ($labels -contains 'priority:p2') {'P2'} else {'P1'}
  $isDeferred = ($labels -contains 'deferred') -or ($labels -contains 'post-mvp')
  $mvp = if ($isDeferred) {'No'} else {'Yes'}
  $status = $fileStatus

  $body = [string]$issueObj.body
  $userStory = Get-SectionText $body 'User Story' @('Acceptance Criteria','Technical Notes','Related database tables','Related API endpoints','Related ADRs','Definition of Done','Purpose','Status','Related Documentation','Suggested Epic/Category')
  $acceptance = Get-SectionText $body 'Acceptance Criteria' @('Technical Notes','Related database tables','Related API endpoints','Related ADRs','Definition of Done','Related Documentation','Suggested Epic/Category')
  $techNotes = Get-SectionText $body 'Technical Notes' @('Related database tables','Related API endpoints','Related ADRs','Definition of Done','Related Documentation','Suggested Epic/Category')
  $tablesText = Get-SectionText $body 'Related database tables' @('Related API endpoints','Related ADRs','Definition of Done','Related Documentation','Suggested Epic/Category')
  $endpointsText = Get-SectionText $body 'Related API endpoints' @('Related ADRs','Definition of Done','Related Documentation','Suggested Epic/Category')
  $adrsText = Get-SectionText $body 'Related ADRs' @('Definition of Done','Related Documentation','Suggested Epic/Category')

  $storyLines = @($userStory -split "`r?`n" | Where-Object { $_.Trim() -ne '' })
  $accBullets = Get-Bullets $acceptance
  $noteBullets = Get-Bullets $techNotes
  $tableBullets = Get-Bullets $tablesText
  $endpointBullets = Get-Bullets $endpointsText
  $adrBullets = Get-Bullets $adrsText

  $docsText = @(
    '- docs/MASTER_PROJECT_SPEC.md',
    '- docs/Architecture_Decision_Record.md',
    '- docs/api_endpoints.md',
    '- docs/table_Schema_decisions.md',
    '- docs/testing/testing-strategy.md',
    '- docs/testing/test-matrix.md',
    '- .github/copilot-instructions.md'
  ) -join "`n"

  $depsText = ($deps | ForEach-Object { "- $_" }) -join "`n"
  $storyOut = if ($storyLines.Count -gt 0) { $storyLines -join "`n" } else { 'Use the GitHub issue user story as the approved product intent.' }
  $includedOut = if ($accBullets.Count -gt 0) { ($accBullets | ForEach-Object { "- $_" }) -join "`n" } else { '- Implement approved behavior from the issue acceptance criteria.' }
  $techOut = if ($noteBullets.Count -gt 0) { ($noteBullets | ForEach-Object { "- $_" }) -join "`n" } else { '- No additional technical notes beyond acceptance criteria.' }
  $tablesOut = if ($tableBullets.Count -gt 0) { ($tableBullets | ForEach-Object { "- $_" }) -join "`n" } else { '- None in current MVP schema.' }
  $apiOut = if ($endpointBullets.Count -gt 0) { ($endpointBullets | ForEach-Object { "- $_" }) -join "`n" } else { '- None for this story.' }
  $adrsOut = if ($adrBullets.Count -gt 0) { ($adrBullets | ForEach-Object { "- $_" }) -join "`n" } else { '- Refer to docs/Architecture_Decision_Record.md.' }
  $testRefsOut = if ($testRefs.Count -gt 0) { ($testRefs | ForEach-Object { "- $_" }) -join "`n" } else { '- Use relevant suites from docs/testing/test-matrix.md for this workflow area.' }

  $expectedFiles = @(
    '- ddd/backend/src/<domain>/*',
    '- ddd/frontend/src/pages/<feature>*.jsx',
    '- ddd/frontend/src/api/*',
    '- ddd/backend/tests/integration/*',
    '- ddd/frontend/src/tests/*'
  ) -join "`n"

  @"
# 1. Ticket Information

GitHub Issue: #$num

Title: $title

Status: $status

Priority: $priority

MVP: $mvp

Dependencies:

$depsText

Related Documentation:

$docsText

# 2. User Story

$storyOut

# 3. Objective

Deliver the approved user-story outcome for Issue #$num with endpoint, authorization, and data behavior aligned to the finalized MVP architecture. The completed implementation should satisfy the acceptance criteria without expanding scope beyond this story.

# 4. Scope

## 4.1 Included

$includedOut

## 4.2 Explicitly Not Included

- Changes to unrelated endpoints, tables, or user workflows outside this story.
- Post-MVP functionality not explicitly included in this issue.
- Unapproved schema, API, or architecture redesign.

# 5. Existing Architecture

- Node.js + Express backend with middleware/service/repository layering.
- PostgreSQL schema and constraints defined in docs/table_Schema_decisions.md.
- JWT-derived organization context for protected-resource ownership.
- Source-of-truth role and visibility rules from docs/MASTER_PROJECT_SPEC.md and docs/api_endpoints.md.
- Relevant ADRs:
$adrsOut

# 6. Technical Design

## 6.1 Backend

- Implement or align route, validation, service, and repository behavior for the in-scope endpoint(s).
- Enforce authorization and organization isolation for every resource lookup.
- Apply request validation and return standardized API error envelopes.
- Preserve MVP no-delete and historical-integrity behavior where applicable.

## 6.2 Frontend

- Implement story-specific workflow UI and API client integration.
- Provide loading, success, and error feedback in the user flow.
- Preserve role-aware behavior for visible actions and responses.

## 6.3 Database

$tablesOut

- Use existing documented constraints and relationships; do not introduce unapproved schema changes.

# 7. API Contract

$apiOut

Authentication, authorization, request payload validation, and response/error behavior must match docs/api_endpoints.md for each listed endpoint.

# 8. Data Flow

1. User executes the in-scope workflow action.
2. Frontend invokes the relevant API endpoint(s) where applicable.
3. Backend validates/authenticates/authorizes and applies organization scope.
4. Backend reads/writes approved tables and returns contract response.
5. Frontend renders resulting state and user feedback.

# 9. Business Rules

$includedOut

- Organization isolation always applies.
- Role permissions and visibility behavior follow finalized MVP rules.

# 10. Security Requirements

- Enforce authentication and authorization according to endpoint contract.
- Enforce organization isolation using server-derived organization context.
- Do not expose sensitive/internal fields beyond approved response contract.
- Validate request input at backend boundary.

# 11. Error Handling

| Condition | Expected Behavior |
| --- | --- |
| Validation failure | 400 validation error envelope with actionable detail. |
| Missing/invalid auth | 401 unauthenticated error envelope for protected endpoints. |
| Unauthorized role | 403 forbidden error envelope. |
| Cross-organization access | Denied per contract (not-found/forbidden as documented). |
| Unexpected backend failure | 500 internal error envelope without sensitive leakage. |

# 12. Test Requirements

## Existing Tests

$testRefsOut

## Unit Tests

- Validate in-scope business-rule and permission branch behavior.

## Integration/API Tests

- Validate happy path, validation failures, authorization failures, and organization isolation.

## Frontend Tests

- Validate workflow rendering, loading states, error states, and role-aware UI behavior.

## End-to-End Tests

- Extend critical workflow coverage if this story changes end-to-end behavior.

# 13. Test Scenarios

## Scenario 1 - Happy Path

Given authorized context and valid input,
when the workflow is executed,
then behavior matches acceptance criteria.

## Scenario 2 - Validation Failure

Given invalid input,
when the request is submitted,
then validation fails safely with no invalid persistence.

## Scenario 3 - Unauthorized/Forbidden

Given missing auth or insufficient role,
when protected behavior is attempted,
then access is denied per contract.

## Scenario 4 - Organization Isolation

Given a cross-organization resource ID,
when access is attempted,
then cross-organization access is denied.

# 14. Implementation Sequence

1. Confirm endpoint, schema, and role requirements in source-of-truth docs.
2. Implement backend behavior for in-scope endpoint(s).
3. Implement frontend workflow behavior and API client updates.
4. Add/extend tests mapped to acceptance criteria.
5. Validate behavior against test-matrix and source-of-truth docs.

# 15. Expected Files

## Expected Modified Files

$expectedFiles

## Potential New Files

- ddd/backend/src/<domain>/<feature>.js
- ddd/frontend/src/pages/<feature>Page.jsx
- ddd/backend/tests/integration/<feature>.test.js
- ddd/frontend/src/tests/<feature>.test.jsx

# 16. Dependencies

## Required Previous Tickets

$depsText

## Required Architecture

- Source-of-truth behavior in docs/MASTER_PROJECT_SPEC.md and relevant ADRs.

## Required API

- Endpoint(s) listed in Section 7.

## Required Database

- Tables/constraints listed in Section 6.3.

## Required Frontend

- Workflow behavior listed in Section 6.2.

# 17. Implementation Constraints

- Do not add unapproved schema/API/architecture changes.
- Do not trust client-supplied organization ownership identifiers.
- Preserve MVP no-delete/historical-integrity rules where applicable.
- Keep scope limited to this issue's acceptance criteria.

# 18. Definition of Done

Functionality

- [ ] Acceptance criteria implemented and verified.
- [ ] Out-of-scope functionality not introduced.

Architecture

- [ ] Behavior matches docs/api_endpoints.md and docs/table_Schema_decisions.md.
- [ ] ADR constraints are respected.

Security

- [ ] Authentication, authorization, and organization isolation enforced for affected behavior.

Testing

- [ ] Relevant automated tests added/updated and passing.

Documentation

- [ ] GitHub issue and repository ticket remain aligned.

Review/Scope

- [ ] No unrelated files or features included.

# 19. Manual QA

- Execute authorized happy path end-to-end.
- Execute invalid-input flow and verify error messaging.
- Execute unauthorized role flow.
- Execute cross-organization access attempt.

# 20. Known Risks

Risk:

- Contract drift between implementation and documented endpoint behavior.

Impact:

- Security/behavior regressions and inconsistent UX.

Mitigation:

- Enforce endpoint contract checks and automated regression tests.

Risk:

- Scope creep into adjacent stories.

Impact:

- Delivery delays and increased defect surface.

Mitigation:

- Keep implementation and testing constrained to accepted story scope.

# 21. Open Questions / Blocking Decisions

- No blocking decisions identified from current source-of-truth docs.
- If contradictions arise during implementation, stop and escalate.

# 22. Copilot Implementation Notes

- Follow .github/copilot-instructions.md hierarchy.
- Keep scope strictly to this issue.
- Add tests with implementation; do not defer test coverage.

# 23. Completion Report Template

Implemented

- Summarize implemented behavior for this ticket.

Files Changed

- List modified files.

Tests Added/Updated

- List added/updated test coverage.

Tests Run

- List executed validation commands.

Result

- PASS / FAIL.

Manual QA Completed

- List executed manual QA checks and outcomes.

Documentation Updated

- Confirm issue body and repository ticket alignment.

Known Limitations

- List approved limitations remaining.

Remaining Issues

- List follow-up issues if any.
"@
}

# ticket list to normalize
$targets = @(10,11,12,13,14,15,16,17,18,19,20,21,23,26,27,28,29,30,31,32,34,35,36,37,38,39,40,41,43,44,45,47,48)

# lightweight dependency and test mapping
$depsMap = @{
10=@('#46 foundation scaffold and test harness.','#2 login and #4 current-user context for protected workflows.');
11=@('#10 create team.','#46 foundation scaffold and test harness.');
12=@('#10 create team.','#11 view teams.','#6 create user.');
13=@('#10 create team.','#12 add user to team.','#6 create user.');
14=@('#46 foundation scaffold and test harness.','#2 login and #4 current-user context for protected workflows.');
15=@('#14 view statuses.','#46 foundation scaffold and test harness.');
16=@('#15 create status.','#14 view statuses.');
17=@('#15 create status.','#16 update status.');
18=@('#46 foundation scaffold and test harness.','#2 login and protected app shell readiness.');
19=@('#18 view map.','#46 foundation scaffold and test harness.');
20=@('#18 view map.','#19 view current location.');
21=@('#18 view map.','#34 representative visibility rules.');
23=@('#18 view map.','#45 protect geocoding service.');
26=@('#23 identify property from map location.','#45 protect geocoding service.');
27=@('#26 create property.','#21 view property markers.');
28=@('#27 view property.','#34 representative visibility.');
29=@('#23 identify property from map location.','#14 view statuses.');
30=@('#29 record new interaction.','#18 view map.');
31=@('#29 record new interaction.','#36 enforce role permissions.');
32=@('#31 update interaction.','#28 view property interactions (current state).');
34=@('#5 manage organization information/settings readiness.','#10-#13 teams foundation.');
35=@('#46 foundation scaffold and test harness.','#2 login and protected auth context.');
36=@('#35 enforce organization isolation.','#34 visibility constraints.');
37=@('#29 record new interaction.','#31 update interaction.','#34 visibility constraints.');
38=@('#37 view activity report.','#14-#17 statuses management.');
39=@('#37 view activity report.','#10-#13 team membership foundation.');
40=@('#18 view map.','#21 view property markers.');
41=@('#40 select property from map.','#29 record new interaction.');
43=@('#29 and #31 interaction flows.','#46 foundation scaffold and test harness.');
44=@('#30 save interaction draft.','#29 and #31 interaction flows.');
45=@('#23 identify property from map location.','#26 create property.');
47=@('#37 view activity report.','#29 and #31 interaction snapshot semantics.');
48=@('#29 record new interaction.','#31 update interaction.','#37 reporting semantics.');
}

$testMap = @{
10=@('TEST-027 Create Team','TEST-029 Cross-Organization Team Membership','TEST-020 Manager Permissions','TEST-021 Administrator Permissions');
11=@('TEST-027 Create Team','TEST-028 Team Membership','TEST-016 Cross-Organization Team Access');
12=@('TEST-028 Team Membership','TEST-029 Cross-Organization Team Membership','TEST-016 Cross-Organization Team Access');
13=@('TEST-028 Team Membership','TEST-029 Cross-Organization Team Membership','TEST-016 Cross-Organization Team Access');
14=@('TEST-030 View Organization Statuses','TEST-033 Cross-Organization Status Isolation');
15=@('TEST-031 Create Status','TEST-033 Cross-Organization Status Isolation');
16=@('TEST-032 Update Status','TEST-033 Cross-Organization Status Isolation');
17=@('TEST-032 Update Status','TEST-033 Cross-Organization Status Isolation');
18=@('TEST-044 Map Loads');
19=@('TEST-045 Current Location');
20=@('TEST-045 Current Location','TEST-044 Map Loads');
21=@('TEST-047 Interaction Markers','TEST-048 Visibility Filtering');
23=@('TEST-034 Resolve Property','TEST-038 Invalid Coordinates','TEST-040 Geocoding Failure');
26=@('TEST-034 Resolve Property','TEST-035 Existing Property Reuse','TEST-036 New Property Creation','TEST-037 Property Organization Isolation');
27=@('TEST-041 View Property','TEST-042 Property Organization Isolation');
28=@('TEST-063 Current Snapshot Returned','TEST-064 Previous Snapshot Not Treated As Current','TEST-065 No Normal History Timeline');
29=@('TEST-049 First Interaction Creates Group','TEST-050 Interaction Group Identity','TEST-052 Different Representative','TEST-053 Duplicate Submission');
30=@('TEST-071 Draft Creation','TEST-072 Draft Restoration','TEST-073 Successful Save Clears Draft');
31=@('TEST-054 Create Revision','TEST-055 Previous Snapshot Preserved','TEST-056 Current Snapshot','TEST-057 Same Interaction Group','TEST-058 Revision Does Not Create New Knock');
32=@('TEST-063 Current Snapshot Returned','TEST-065 No Normal History Timeline','TEST-066 Representative Can Edit Own Interaction');
34=@('TEST-048 Visibility Filtering','TEST-020 Manager Permissions','TEST-021 Administrator Permissions');
35=@('TEST-013 Cross-Organization Property Access','TEST-014 Cross-Organization Interaction Access','TEST-015 Cross-Organization User Access','TEST-016 Cross-Organization Team Access','TEST-017 Cross-Organization Status Access','TEST-018 Resource ID Does Not Bypass Organization Scope');
36=@('TEST-019 Representative Permissions','TEST-020 Manager Permissions','TEST-021 Administrator Permissions','TEST-022 Unauthorized Role Access');
37=@('TEST-081 Activity Report','TEST-082 Date Range','TEST-085 Revision Does Not Double Count','TEST-086 Organization Reporting Isolation');
38=@('TEST-083 Status Grouping','TEST-085 Revision Does Not Double Count','TEST-086 Organization Reporting Isolation');
39=@('TEST-084 Representative Grouping','TEST-085 Revision Does Not Double Count','TEST-086 Organization Reporting Isolation');
40=@('TEST-046 Property Selection','TEST-044 Map Loads');
41=@('TEST-046 Property Selection','TEST-049 First Interaction Creates Group');
43=@('TEST-077 Required Field Validation','TEST-078 Invalid Resource ID','TEST-079 Invalid Status','TEST-080 Consistent Error Response');
44=@('TEST-074 Failed Interaction Submission','TEST-075 Retry Successful','TEST-076 Retry Does Not Duplicate Group');
45=@('TEST-039 Geocoding Provider Boundary','TEST-040 Geocoding Failure');
47=@('TEST-081 Activity Report','TEST-082 Date Range','TEST-086 Organization Reporting Isolation');
48=@('TEST-054 Create Revision','TEST-056 Current Snapshot','TEST-058 Revision Does Not Create New Knock','TEST-085 Revision Does Not Double Count');
}

$ticketFiles = Get-ChildItem docs/implementation/tickets -File
$updated = @()
foreach ($num in $targets) {
  $file = $ticketFiles | Where-Object { (Get-Content $_.FullName -Raw) -match "GitHub Issue:\s*#$num" } | Select-Object -First 1
  if (-not $file) { continue }
  $existing = Get-Content $file.FullName -Raw
  $statusLine = ($existing -split "`r?`n" | Where-Object { $_ -match '^Status:' } | Select-Object -First 1)
  $status = ($statusLine -replace 'Status:\s*','').Trim()
  $issue = $issues | Where-Object { $_.number -eq $num } | Select-Object -First 1
  if (-not $issue) { continue }
  $deps = if ($depsMap.ContainsKey($num)) { $depsMap[$num] } else { @('#46 foundation scaffold and test harness.') }
  $tests = if ($testMap.ContainsKey($num)) { $testMap[$num] } else { @('Use relevant suites from docs/testing/test-matrix.md for this workflow area.') }
  $newContent = Build-Ticket -issueObj $issue -fileStatus $status -deps $deps -testRefs $tests
  Set-Content -Path $file.FullName -Value $newContent -Encoding utf8
  $updated += [pscustomobject]@{Issue=$num;File=$file.FullName}
}

$updated | Sort-Object Issue | Format-Table -AutoSize | Out-String -Width 400