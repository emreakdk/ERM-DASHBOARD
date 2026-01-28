param(
  [string]$MigrationsPath = "supabase/migrations"
)

$AppliedDir = Join-Path $MigrationsPath "_applied"

if (-not (Test-Path $AppliedDir)) {
  New-Item -ItemType Directory -Path $AppliedDir | Out-Null
}

Get-ChildItem $MigrationsPath -Filter '20250101_*' | Move-Item -Destination $AppliedDir

npx supabase db push

Move-Item (Join-Path $AppliedDir '*.sql') $MigrationsPath
