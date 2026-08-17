$pairs = @(
  @{Issue=10;File='docs/implementation/tickets/US-010-create-team.md'},
  @{Issue=11;File='docs/implementation/tickets/US-011-view-teams.md'},
  @{Issue=12;File='docs/implementation/tickets/US-012-add-user-to-team.md'},
  @{Issue=13;File='docs/implementation/tickets/US-013-remove-user-from-team.md'},
  @{Issue=14;File='docs/implementation/tickets/US-014-view-statuses.md'},
  @{Issue=15;File='docs/implementation/tickets/US-015-create-status.md'},
  @{Issue=16;File='docs/implementation/tickets/US-016-update-status.md'},
  @{Issue=17;File='docs/implementation/tickets/US-017-deactivate-status.md'},
  @{Issue=18;File='docs/implementation/tickets/US-018-view-map.md'},
  @{Issue=19;File='docs/implementation/tickets/US-019-view-current-location.md'},
  @{Issue=20;File='docs/implementation/tickets/US-020-follow-current-location.md'},
  @{Issue=21;File='docs/implementation/tickets/US-021-view-property-markers.md'},
  @{Issue=23;File='docs/implementation/tickets/US-023-identify-property-from-map-location.md'},
  @{Issue=26;File='docs/implementation/tickets/US-026-create-property.md'},
  @{Issue=27;File='docs/implementation/tickets/US-027-view-property.md'},
  @{Issue=28;File='docs/implementation/tickets/US-028-view-property-interactions-current-state.md'},
  @{Issue=29;File='docs/implementation/tickets/US-029-record-new-interaction.md'},
  @{Issue=30;File='docs/implementation/tickets/US-030-save-interaction-draft.md'},
  @{Issue=31;File='docs/implementation/tickets/US-031-update-interaction.md'},
  @{Issue=32;File='docs/implementation/tickets/US-032-view-interaction-snapshot.md'},
  @{Issue=34;File='docs/implementation/tickets/US-034-restrict-representative-visibility.md'},
  @{Issue=35;File='docs/implementation/tickets/US-035-enforce-organization-isolation.md'},
  @{Issue=36;File='docs/implementation/tickets/US-036-enforce-role-permissions.md'},
  @{Issue=37;File='docs/implementation/tickets/US-037-view-activity-report.md'},
  @{Issue=38;File='docs/implementation/tickets/US-038-view-activity-by-status.md'},
  @{Issue=39;File='docs/implementation/tickets/US-039-view-activity-by-representative.md'},
  @{Issue=40;File='docs/implementation/tickets/US-040-select-property-from-map.md'},
  @{Issue=41;File='docs/implementation/tickets/US-041-record-interaction-without-leaving-map.md'},
  @{Issue=43;File='docs/implementation/tickets/US-043-handle-api-validation-errors.md'},
  @{Issue=44;File='docs/implementation/tickets/US-044-handle-network-failure-during-interaction.md'},
  @{Issue=45;File='docs/implementation/tickets/US-045-protect-geocoding-service.md'},
  @{Issue=47;File='docs/implementation/tickets/US-047-export-activity-data-as-csv.md'},
  @{Issue=48;File='docs/implementation/tickets/US-048-enforce-interaction-current-snapshot-integrity.md'}
)

$results = @()
foreach($p in $pairs){
  gh issue edit $p.Issue --body-file $p.File | Out-Null
  if ($LASTEXITCODE -eq 0){
    $results += [pscustomobject]@{Issue=$p.Issue;Result='updated'}
  } else {
    $results += [pscustomobject]@{Issue=$p.Issue;Result='failed'}
  }
}

$results | Sort-Object Issue | Format-Table -AutoSize | Out-String -Width 300