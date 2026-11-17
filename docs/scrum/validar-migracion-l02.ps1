$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# One-shot fail-closed validation. It only targets the second isolated L02 database.
$dbName = 'taskview_l02_migration'
$dbContainerName = 'taskview-l02-migration-db-20261115'
$runnerName = 'taskview-l02-migration-runner-20261115'
$networkName = 'taskview-l02-migration-net-20261115'
$volumeName = 'taskview-l02-migration-pgdata-20261115'
$expectedImage = 'taskview-l01-api:authlog-20261114'

function Get-DockerObject([string]$name) {
    $json = docker inspect $name
    if ($LASTEXITCODE -ne 0) { throw "Cannot inspect expected L02 object: $name" }
    return ($json | ConvertFrom-Json)[0]
}

$network = (docker network inspect $networkName | ConvertFrom-Json)[0]
if ($LASTEXITCODE -ne 0 -or $network.Name -ne $networkName -or -not $network.Internal) {
    throw 'L02 network identity/internal guard failed'
}

$volume = (docker volume inspect $volumeName | ConvertFrom-Json)[0]
if ($LASTEXITCODE -ne 0 -or $volume.Name -ne $volumeName -or $volume.Labels.purpose -ne 'taskview-lista02-scrum-migration') {
    throw 'L02 volume identity guard failed'
}

$db = Get-DockerObject $dbContainerName
$dbNetworks = @($db.NetworkSettings.Networks.PSObject.Properties.Name)
$dbMounts = @($db.Mounts)
if ($db.Name -ne "/$dbContainerName" -or $db.Config.Image -notlike 'postgres:17*' -or
    $db.State.Status -ne 'running' -or $dbNetworks.Count -ne 1 -or $dbNetworks[0] -ne $networkName -or
    $dbMounts.Count -ne 1 -or $dbMounts[0].Name -ne $volumeName -or
    @($db.HostConfig.PortBindings.PSObject.Properties).Count -ne 0) {
    throw 'L02 database container, network, volume, or port guard failed'
}

$runner = Get-DockerObject $runnerName
$runnerNetworks = @($runner.NetworkSettings.Networks.PSObject.Properties.Name)
$runnerEnv = @{}
foreach ($item in $runner.Config.Env) {
    $pair = $item.Split('=', 2)
    $runnerEnv[$pair[0]] = $pair[1]
}
if ($runner.Name -ne "/$runnerName" -or $runner.Config.Image -ne $expectedImage -or
    $runner.State.Status -ne 'running' -or $runnerNetworks.Count -ne 1 -or $runnerNetworks[0] -ne $networkName -or
    @($runner.Mounts).Count -ne 0 -or @($runner.HostConfig.PortBindings.PSObject.Properties).Count -ne 0 -or
    $runnerEnv.DB_HOST -ne 'l02-migration-postgres' -or $runnerEnv.DB_PORT -ne '5432' -or
    $runnerEnv.DB_NAME -ne $dbName -or $runnerEnv.DB_USER -ne 'l02synthetic') {
    throw 'L02 migration runner target/isolation guard failed'
}

$before = docker exec $dbContainerName psql -X -v ON_ERROR_STOP=1 -U l02synthetic -d $dbName -Atc "SELECT current_database() || '|' || version || '|' || current_setting('server_version_num') FROM app.version WHERE id=1"
$beforeParts = $before -split '\|'
if ($LASTEXITCODE -ne 0 -or $beforeParts.Count -ne 3 -or $beforeParts[0] -ne $dbName -or
    $beforeParts[1] -ne '1.74.0' -or $beforeParts[2] -notmatch '^17[0-9]{4}$') {
    throw 'Expected exact synthetic database at baseline 1.74.0 on PostgreSQL 17; refusing migration'
}

docker exec $runnerName node /usr/src/app/taskview-db-migration.js
if ($LASTEXITCODE -ne 0) { throw 'TaskView migration runner returned a failure' }

$after = docker exec $dbContainerName psql -X -v ON_ERROR_STOP=1 -U l02synthetic -d $dbName -Atc "SELECT (SELECT version FROM app.version WHERE id=1) || '|' || (SELECT count(*) FROM about.versions WHERE version='1.75.0') || '|' || (SELECT count(*) FROM information_schema.tables WHERE table_schema='tasks' AND table_name='scrum_epics')"
if ($LASTEXITCODE -ne 0 -or $after -ne '1.75.0|1|1') {
    throw 'Post-migration version/ledger/table verification failed'
}

Write-Output 'PASS: guarded TaskView migration 1.75.0 on the isolated Lista 02 database.'
