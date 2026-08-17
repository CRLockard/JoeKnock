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
  $isDeferred = ($labels -contains 'deferred') -or ($labels -contains 'post-mvp') -or ([string]$issueObj.body -match 'POST-MVP|Deferred')
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
  $includedOut = ($accBullets | ForEach-Object { "- $_" }) -join "`n"
  $techOut = ($noteBullets | ForEach-Object { "- $_" }) -join "`n"
  $tablesOut = if ($tableBullets.Count -gt 0) { ($tableBullets | ForEach-Object { "- $_" }) -join "`n" } else { '- None in current MVP schema.' }
  $apiOut = if ($endpointBullets.Count -gt 0) { ($endpointBullets | ForEach-Object { "- $_" }) -join "`n" } else { '- None for this story.' }
  $adrsOut = if ($adrBullets.Count -gt 0) { ($adrBullets | ForEach-Object { "- $_" }) -join "`n" } else { '- Refer to docs/Architecture_Decision_Record.md.' }
  $testRefsOut = ($testRefs | ForEach-Object { "- $_" }) -join "`n"

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

Deliver the approved user-story outcome for Issue #$num with endpoint, authorization, and data behavior aligned to the finalized MVP architecture.

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
- Relevant ADRs:
$adrsOut

# 6. Technical Design

## 6.1 Backend

- Implement/align route, validation, service, and repository behavior for in-scope endpoint(s).
- Enforce authorization and organization isolation for every resource lookup.
- Return standardized API error envelopes for validation/authz failures.

## 6.2 Frontend

- Implement story-specific workflow UI and API client wiring.
- Provide loading, success, and error feedback in the user flow.
- Preserve role-aware behavior for visible actions and responses.

## 6.3 Database

$tablesOut

# 7. API Contract

$apiOut

# 8. Data Flow

1. User executes the in-scope workflow action.
2. Frontend invokes the relevant API endpoint(s) where applicable.
3. Backend validates/authenticates/authorizes and applies organization scope.
4. Backend reads/writes approved tables and returns contract response.
5. Frontend renders resulting state and feedback.

# 9. Business Rules

$includedOut

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

- Validate happy path, validation failures, authz failures, and org isolation.

## Frontend Tests

- Validate workflow rendering, loading states, error states, and role-aware UI.

## End-to-End Tests

- Extend critical workflow coverage if this story changes end-to-end behavior.

# 13. Test Scenarios

## Scenario 1 - Happy Path

Given authorized context and valid input,
when the workflow is executed,
then behavior matches the acceptance criteria.

## Scenario 2 - Validation Failure

Given invalid input,
when request is submitted,
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
2. Implement backend behavior for scope endpoints.
3. Implement frontend workflow behavior and API client updates.
4. Add/extend tests mapped to acceptance criteria.
5. Validate against test matrix and source-of-truth docs.

# 15. Expected Files

## Expected Modified Files

- ddd/backend/src/*
- ddd/frontend/src/pages/*
- ddd/frontend/src/api/*
- ddd/backend/tests/integration/*
- ddd/frontend/src/tests/*

## Potential New Files

- ddd/backend/src/<domain>/*
- ddd/frontend/src/pages/<feature>*.jsx

# 16. Dependencies

## Required Previous Tickets

$depsText

## Required Architecture

- Source-of-truth behavior in docs/MASTER_PROJECT_SPEC.md and ADRs.

## Required API

- Endpoint(s) listed in Section 7.

## Required Database

- Tables/constraints listed in Section 6.3.

## Required Frontend

- Workflow behavior listed in Section 6.2.

# 17. Implementation Constraints

- Do not add unapproved schema/API/architecture changes.
- Do not trust client-supplied organization ownership fields.
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

- [ ] Authn/authz and org isolation enforced for affected behavior.

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

$issue = $issues | Where-Object { $_.number -eq 10 } | Select-Object -First 1
$out = Build-Ticket -issueObj $issue -fileStatus 'Planned' -deps @('#46 foundation scaffold and test harness.','#2 login and #4 current-user context for protected workflows.') -testRefs @('TEST-027 Create Team','TEST-029 Cross-Organization Team Membership','TEST-020 Manager Permissions','TEST-021 Administrator Permissions')
$out | Out-File .tmp_us010_preview.md -Encoding utf8
Write-Output 'preview written: .tmp_us010_preview.md'