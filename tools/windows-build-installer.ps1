Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-RelayCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Command,

        [Parameter(Mandatory = $true)]
        [string[]] $Arguments
    )

    Write-Host "Running: $Command $($Arguments -join ' ')"
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $Command $($Arguments -join ' ')"
    }
}

function Assert-RelayCommandAvailable {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Command
    )

    $resolvedCommand = Get-Command $Command -ErrorAction SilentlyContinue
    if ($null -eq $resolvedCommand) {
        throw "Required command is not available on PATH: $Command"
    }
}

function Get-RelayInstallerArtifacts {
    param(
        [Parameter(Mandatory = $true)]
        [string] $BundleRoot
    )

    if (-not (Test-Path -Path $BundleRoot)) {
        throw "Tauri bundle output directory was not created: $BundleRoot"
    }

    $artifactPatterns = @("*.exe", "*.msi")
    $artifacts = @(Get-ChildItem -Path $BundleRoot -Recurse -File -Include $artifactPatterns)
    if ($artifacts.Count -eq 0) {
        throw "No Windows installer artifacts found under: $BundleRoot"
    }

    return $artifacts
}

$repoRoot = Resolve-Path -Path (Join-Path -Path $PSScriptRoot -ChildPath "..")
Set-Location -Path $repoRoot

Assert-RelayCommandAvailable -Command "node"
Assert-RelayCommandAvailable -Command "npm"
Assert-RelayCommandAvailable -Command "cargo"

Invoke-RelayCommand -Command "npm" -Arguments @("ci")
Invoke-RelayCommand -Command "npm" -Arguments @("run", "verify")
Invoke-RelayCommand -Command "cargo" -Arguments @("test", "--manifest-path", "src-tauri/Cargo.toml")
Invoke-RelayCommand -Command "npm" -Arguments @("run", "tauri", "build")

$bundleRoot = Join-Path -Path $repoRoot -ChildPath "src-tauri/target/release/bundle"
$artifacts = Get-RelayInstallerArtifacts -BundleRoot $bundleRoot

Write-Host ""
Write-Host "Relay Studio Windows installer artifacts:"
foreach ($artifact in $artifacts) {
    Write-Host "- $($artifact.FullName)"
}
