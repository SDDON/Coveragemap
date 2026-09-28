# ========================================================
# CoverageMap Neo4j Smart Launcher (PowerShell Engine)
# ========================================================
param (
    [switch]$DryRun
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   CoverageMap Neo4j Database Launcher" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$rootDir = Split-Path -Parent $PSScriptRoot
$neo4jBin = $null
$neo4jHome = $null

# 1. Check .env in root or backend
$envPaths = @(
    (Join-Path $rootDir ".env"),
    (Join-Path $rootDir "backend\.env")
)

foreach ($envFile in $envPaths) {
    if (Test-Path $envFile) {
        $lines = Get-Content $envFile -Encoding UTF8 -ErrorAction SilentlyContinue
        foreach ($line in $lines) {
            if ($line -match '^\s*NEO4J_HOME\s*=\s*(.+)$') {
                $candidate = $matches[1].Trim().Trim('"').Trim("'")
                if ($candidate -and (Test-Path $candidate)) {
                    $neo4jHome = $candidate
                    break
                }
            }
        }
    }
    if ($neo4jHome) { break }
}

# 2. Check System Environment Variable
if (-not $neo4jHome -and $env:NEO4J_HOME -and (Test-Path $env:NEO4J_HOME)) {
    $neo4jHome = $env:NEO4J_HOME
}

# 3. Check System PATH
if (-not $neo4jHome) {
    $pathCmd = Get-Command neo4j.bat -ErrorAction SilentlyContinue
    if ($pathCmd) {
        $neo4jBin = $pathCmd.Source
    }
}

# 4. Search common installation drives (E:, C:, D:)
if (-not $neo4jHome -and -not $neo4jBin) {
    Write-Host "[INFO] 로컬 드라이브에서 Neo4j 자동 탐색 중..." -ForegroundColor Gray
    $searchDrives = @('E:\', 'C:\', 'D:\') | Where-Object { Test-Path $_ }
    
    foreach ($drive in $searchDrives) {
        # Check root level neo4j folders
        $found = Get-ChildItem -Path $drive -Filter "neo4j*" -Directory -ErrorAction SilentlyContinue |
                 Where-Object { (Test-Path (Join-Path $_.FullName "bin\neo4j.bat")) -or (Test-Path (Join-Path $_.FullName "neo4j.bat")) } |
                 Select-Object -First 1

        if ($found) {
            $neo4jHome = $found.FullName
            break
        }

        # Check Program Files
        $pf = Join-Path $drive "Program Files"
        if (Test-Path $pf) {
            $pfFound = Get-ChildItem -Path $pf -Filter "Neo4j*" -Directory -ErrorAction SilentlyContinue |
                       Where-Object { (Test-Path (Join-Path $_.FullName "bin\neo4j.bat")) -or (Test-Path (Join-Path $_.FullName "neo4j.bat")) } |
                       Select-Object -First 1
            if ($pfFound) {
                $neo4jHome = $pfFound.FullName
                break
            }
        }
    }
}

# Resolve neo4jBin from neo4jHome if found
if ($neo4jHome -and -not $neo4jBin) {
    $candidateBin = Join-Path $neo4jHome "bin\neo4j.bat"
    if (Test-Path $candidateBin) {
        $neo4jBin = $candidateBin
    } else {
        $candidateBin2 = Join-Path $neo4jHome "neo4j.bat"
        if (Test-Path $candidateBin2) {
            $neo4jBin = $candidateBin2
        }
    }
}

# 5. Fallback: Prompt user if still not found
if (-not $neo4jBin) {
    Write-Host ""
    Write-Host "[!] 로컬에서 Neo4j 설치 경로를 자동으로 찾지 못했습니다." -ForegroundColor Yellow
    Write-Host "    (Docker를 사용하시려면 `docker compose up -d neo4j`를 실행하세요)" -ForegroundColor DarkGray
    Write-Host ""
    $userInput = Read-Host "Neo4j가 설치된 폴더 경로를 입력해주세요 (예: D:\neo4j-community-5.26)"
    
    if ($userInput) {
        $cleanPath = $userInput.Trim().Trim('"').Trim("'")
        $testBin = Join-Path $cleanPath "bin\neo4j.bat"
        if (Test-Path $testBin) {
            $neo4jBin = $testBin
            $neo4jHome = $cleanPath
        } else {
            $testBin2 = Join-Path $cleanPath "neo4j.bat"
            if (Test-Path $testBin2) {
                $neo4jBin = $testBin2
                $neo4jHome = $cleanPath
            }
        }
    }
}

if (-not $neo4jBin) {
    Write-Host "[ERROR] 유효한 Neo4j 실행 파일(neo4j.bat)을 찾을 수 없습니다." -ForegroundColor Red
    pause
    exit 1
}

# Save discovered path to root .env if not already present
$rootEnv = Join-Path $rootDir ".env"
$envExists = Test-Path $rootEnv
$alreadySaved = $false
if ($envExists) {
    $existing = Get-Content $rootEnv -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if ($existing -match "NEO4J_HOME=") { $alreadySaved = $true }
}
if (-not $alreadySaved -and $neo4jHome) {
    Add-Content -Path $rootEnv -Value "`nNEO4J_HOME=$neo4jHome" -Encoding UTF8
    Write-Host "[INFO] 탐색된 경로를 .env에 저장했습니다: $neo4jHome" -ForegroundColor Green
}

Write-Host "[OK] Neo4j 실행 파일 발견: $neo4jBin" -ForegroundColor Green

if ($DryRun) {
    Write-Host "[DRY-RUN] Detection successful. Exiting without launching." -ForegroundColor Yellow
    exit 0
}

Write-Host "Starting Neo4j Database Console..." -ForegroundColor Cyan
Write-Host "---------------------------------------------------" -ForegroundColor Gray
& "$neo4jBin" console
