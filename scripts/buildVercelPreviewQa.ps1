[CmdletBinding()]
param(
    [string]$Scope = "marcelos-projects-c26aa499"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$previewBackendOrigin = "https://api-preview.chatboc.ar"
$previewFrontendOrigin = "https://chatboc-r2-preview.vercel.app"
$projectRoot = Split-Path -Parent $PSScriptRoot
$previewConfig = Join-Path $projectRoot ".vercel\qa\vercel.preview.json"
$compiledConfig = Join-Path $projectRoot ".vercel\output\config.json"

$previousBackendUrl = $env:VITE_BACKEND_URL
$previousApiUrl = $env:VITE_API_URL
$previousSocketUrl = $env:VITE_SOCKET_URL
$previousAppVersion = $env:VITE_APP_VERSION
$previousEffectiveVercelConfig = $env:CHATBOC_VERCEL_EFFECTIVE_CONFIG
$previousPrebuiltLocalConfigBinding = $env:CHATBOC_VERCEL_PREBUILT_LOCAL_CONFIG_BOUND

try {
    # HTTP traffic remains same-origin and reaches the backend through the
    # eight audited Vercel rewrites. Socket.IO connects to the exact backend
    # Preview origin because a cross-project rewrite cannot forward the
    # WebSocket upgrade. The backend allows this one browser origin explicitly.
    $env:VITE_BACKEND_URL = $previewFrontendOrigin
    $env:VITE_API_URL = $previewFrontendOrigin
    $env:VITE_SOCKET_URL = $previewBackendOrigin

    $frontendRevision = (& git -C $projectRoot rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $frontendRevision -notmatch '^[0-9a-f]{40}$') {
        throw "Could not resolve an exact frontend Git revision."
    }

    # Playwright refreshes tracked evidence during verification. It is not
    # deployable source; retain it without blocking an exact-revision build.
    $sourceChanges = @(& git -C $projectRoot status --porcelain --untracked-files=normal -- . ':!test-results' ':!playwright-report')
    if ($LASTEXITCODE -ne 0) {
        throw "Could not verify the frontend worktree state."
    }
    if ($sourceChanges.Count -gt 0) {
        throw "The frontend worktree must be clean before creating an auditable Preview build."
    }

    $env:VITE_APP_VERSION = $frontendRevision
    $env:CHATBOC_VERCEL_EFFECTIVE_CONFIG = $previewConfig
    $env:CHATBOC_VERCEL_PREBUILT_LOCAL_CONFIG_BOUND = "1"

    Push-Location $projectRoot
    try {
        & node "scripts\generateVercelPreviewConfig.mjs"
        if ($LASTEXITCODE -ne 0) {
            throw "Preview routing generation failed with exit code $LASTEXITCODE."
        }

        $previousVercelEnvironment = $env:VERCEL_ENV
        $guardExitCode = 0
        try {
            $env:VERCEL_ENV = "preview"
            & node "scripts\guardVercelPreviewRewrites.mjs"
            $guardExitCode = $LASTEXITCODE
        }
        finally {
            if ($null -eq $previousVercelEnvironment) {
                Remove-Item Env:VERCEL_ENV -ErrorAction SilentlyContinue
            }
            else {
                $env:VERCEL_ENV = $previousVercelEnvironment
            }
        }
        if ($guardExitCode -ne 0) {
            throw "Preview routing guard failed with exit code $guardExitCode."
        }

        & vercel build --yes --scope $Scope --local-config $previewConfig
        if ($LASTEXITCODE -ne 0) {
            throw "Vercel Preview build failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }

    if (-not (Test-Path -LiteralPath $compiledConfig)) {
        throw "Vercel did not produce .vercel/output/config.json."
    }

    $compiledConfigRaw = Get-Content -Raw -LiteralPath $compiledConfig
    $previewRouteCount = ([regex]::Matches(
        $compiledConfigRaw,
        [regex]::Escape($previewBackendOrigin)
    )).Count
    $renderRouteCount = ([regex]::Matches(
        $compiledConfigRaw,
        [regex]::Escape("https://api.chatboc.ar")
    )).Count

    if ($previewRouteCount -ne 8 -or $renderRouteCount -ne 0) {
        throw "Compiled Preview routing is unsafe: preview=$previewRouteCount render=$renderRouteCount."
    }

    $bundleContainsPreviewFrontend = $false
    $bundleContainsPreviewSocketOrigin = $false
    foreach ($asset in Get-ChildItem -LiteralPath (Join-Path $projectRoot "dist\assets") -Filter "*.js") {
        if (Select-String -LiteralPath $asset.FullName -SimpleMatch $previewFrontendOrigin -Quiet) {
            $bundleContainsPreviewFrontend = $true
        }
        if (Select-String -LiteralPath $asset.FullName -SimpleMatch $previewBackendOrigin -Quiet) {
            $bundleContainsPreviewSocketOrigin = $true
        }
    }

    if (-not $bundleContainsPreviewFrontend) {
        throw "The same-origin Preview URL was not embedded in the frontend bundle."
    }
    if (-not $bundleContainsPreviewSocketOrigin) {
        throw "The direct Socket.IO Preview origin was not embedded in the frontend bundle."
    }

    $builtIndex = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "dist\index.html")
    if (-not $builtIndex.Contains($frontendRevision)) {
        throw "The exact frontend revision was not embedded in dist/index.html."
    }

    [pscustomobject]@{
        contract = "chatboc.frontend.preview-build.v1"
        target = "preview"
        backend_origin = $previewBackendOrigin
        browser_origin = $previewFrontendOrigin
        frontend_revision = $frontendRevision
        compiled_preview_routes = $previewRouteCount
        compiled_render_routes = $renderRouteCount
        bundle_contains_same_origin = $bundleContainsPreviewFrontend
        bundle_contains_direct_socket_origin = $bundleContainsPreviewSocketOrigin
        deploy_command = "vercel deploy --prebuilt --scope $Scope"
    } | ConvertTo-Json -Compress
}
finally {
    if ($null -eq $previousBackendUrl) {
        Remove-Item Env:VITE_BACKEND_URL -ErrorAction SilentlyContinue
    }
    else {
        $env:VITE_BACKEND_URL = $previousBackendUrl
    }

    if ($null -eq $previousApiUrl) {
        Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
    }
    else {
        $env:VITE_API_URL = $previousApiUrl
    }

    if ($null -eq $previousSocketUrl) {
        Remove-Item Env:VITE_SOCKET_URL -ErrorAction SilentlyContinue
    }
    else {
        $env:VITE_SOCKET_URL = $previousSocketUrl
    }

    if ($null -eq $previousAppVersion) {
        Remove-Item Env:VITE_APP_VERSION -ErrorAction SilentlyContinue
    }
    else {
        $env:VITE_APP_VERSION = $previousAppVersion
    }

    if ($null -eq $previousEffectiveVercelConfig) {
        Remove-Item Env:CHATBOC_VERCEL_EFFECTIVE_CONFIG -ErrorAction SilentlyContinue
    }
    else {
        $env:CHATBOC_VERCEL_EFFECTIVE_CONFIG = $previousEffectiveVercelConfig
    }

    if ($null -eq $previousPrebuiltLocalConfigBinding) {
        Remove-Item Env:CHATBOC_VERCEL_PREBUILT_LOCAL_CONFIG_BOUND -ErrorAction SilentlyContinue
    }
    else {
        $env:CHATBOC_VERCEL_PREBUILT_LOCAL_CONFIG_BOUND = $previousPrebuiltLocalConfigBinding
    }
}
