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

try {
    # Browser traffic remains same-origin and reaches the backend through the
    # eight audited Vercel rewrites. This avoids cross-origin auth/CORS drift
    # while preventing stale Preview variables from sending traffic to Render.
    $env:VITE_BACKEND_URL = $previewFrontendOrigin
    $env:VITE_API_URL = $previewFrontendOrigin

    Push-Location $projectRoot
    try {
        & node "scripts\generateVercelPreviewConfig.mjs"
        if ($LASTEXITCODE -ne 0) {
            throw "Preview routing generation failed with exit code $LASTEXITCODE."
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
    foreach ($asset in Get-ChildItem -LiteralPath (Join-Path $projectRoot "dist\assets") -Filter "*.js") {
        if (Select-String -LiteralPath $asset.FullName -SimpleMatch $previewFrontendOrigin -Quiet) {
            $bundleContainsPreviewFrontend = $true
            break
        }
    }

    if (-not $bundleContainsPreviewFrontend) {
        throw "The same-origin Preview URL was not embedded in the frontend bundle."
    }

    [pscustomobject]@{
        contract = "chatboc.frontend.preview-build.v1"
        target = "preview"
        backend_origin = $previewBackendOrigin
        browser_origin = $previewFrontendOrigin
        compiled_preview_routes = $previewRouteCount
        compiled_render_routes = $renderRouteCount
        bundle_contains_same_origin = $bundleContainsPreviewFrontend
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
}
