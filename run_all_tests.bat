@echo off
setlocal EnableExtensions EnableDelayedExpansion
rem ===========================================================================
rem  Meraki Mobile - Master Test Runner  (run_all_tests.bat)
rem
rem  Usage:
rem    run_all_tests.bat                full pipeline: typecheck -> unit ->
rem                                     integration -> e2e (if possible)
rem    run_all_tests.bat --unit         Tier 1 only (utils + hooks/domain)
rem    run_all_tests.bat --integration  Tier 2 only (services, contexts,
rem                                     components, lib, security audit)
rem    run_all_tests.bat --e2e          Tier 3 Maestro flows only
rem    run_all_tests.bat --coverage     jest --coverage (HTML in coverage/)
rem
rem  Exit codes: 0 success, 1 failure. Fail-fast: later stages never run
rem  once an earlier stage fails, so CI gets a deterministic signal.
rem  Logs: .\test-results\*.log   (timestamps included per stage)
rem ===========================================================================

cd /d "%~dp0"

set "RESULTS=test-results"
if not exist "%RESULTS%" mkdir "%RESULTS%"
set "MASTER_LOG=%RESULTS%\run.log"
set "STAGE=0"

call :banner "Meraki Mobile Test Pipeline"
call :log "Run started %DATE% %TIME%"
call :log "Args: %*"

rem ---------------------------------------------------------------------------
rem 1. Pre-flight checks
rem ---------------------------------------------------------------------------
call :stage "PRE-FLIGHT: toolchain & dependencies" 1

where node >nul 2>nul
if errorlevel 1 (
    call :fail "node.exe not found on PATH. Install Node.js LTS."
)
node --version
call :log "node !ERRORLEVEL!-ok"

where npm >nul 2>nul
if errorlevel 1 (
    call :fail "npm not found on PATH."
)

if not exist "node_modules\jest\bin\jest.js" (
    call :log "node_modules missing or incomplete - running npm ci"
    call npm ci
    if errorlevel 1 (
        call :log "npm ci failed, falling back to npm install"
        call npm install
        if errorlevel 1 call :fail "Dependency installation failed."
    )
) else (
    call :log "node_modules present - skipping install"
)

rem Parse flags --------------------------------------------------------------
set "DO_ALL=1"
set "DO_UNIT=0"
set "DO_INTEGRATION=0"
set "DO_E2E=0"
set "DO_COVERAGE=0"

for %%A in (%*) do (
    if /i "%%~A"=="--unit"        set "DO_ALL=0" & set "DO_UNIT=1"
    if /i "%%~A"=="--integration" set "DO_ALL=0" & set "DO_INTEGRATION=1"
    if /i "%%~A"=="--e2e"         set "DO_ALL=0" & set "DO_E2E=1"
    if /i "%%~A"=="--coverage"    set "DO_ALL=0" & set "DO_COVERAGE=1"
)
if "%DO_ALL%"=="1" (
    set "DO_UNIT=1"
    set "DO_INTEGRATION=1"
    set "DO_E2E=1"
    set "DO_COVERAGE=0"
)

set "JEST=node node_modules\jest\bin\jest.js"

rem ---------------------------------------------------------------------------
rem 2. Static analysis (always runs - fail-fast gate)
rem ---------------------------------------------------------------------------
call :stage "STATIC ANALYSIS: tsc --noEmit" 2
node node_modules\typescript\bin\tsc --noEmit > "%RESULTS%\tsc.log" 2>&1
rem Baseline: 67 known pre-existing errors (nav overloads, VoucherSignup colors,
rem NotificationContext). Fail only if the count GROWS beyond baseline.
set "tsc_errors=0"
for /f %%N in ('findstr /C:"error TS" "%RESULTS%\tsc.log" ^| find /c /v ""') do set "tsc_errors=%%N"
call :log "tsc errors: !tsc_errors! (baseline 67)"
if !tsc_errors! GTR 67 (
    type "%RESULTS%\tsc.log"
    call :fail "tsc produced !tsc_errors! errors - above the 67 baseline."
)

rem ---------------------------------------------------------------------------
rem 3. Tier 1 - Unit & domain logic
rem ---------------------------------------------------------------------------
if "%DO_UNIT%"=="1" (
    call :stage "TIER 1: unit & domain logic (utils + hooks)" 3
    %JEST% src/utils/__tests__ src/hooks/__tests__ --ci --silent > "%RESULTS%\tier1-unit.log" 2>&1
    if errorlevel 1 (
        type "%RESULTS%\tier1-unit.log"
        call :fail "Tier 1 unit tests failed. See test-results\tier1-unit.log"
    )
)

rem ---------------------------------------------------------------------------
rem 4. Tier 2 - Component, integration & Tier 4/5 (context, services, audit)
rem ---------------------------------------------------------------------------
if "%DO_INTEGRATION%"=="1" (
    call :stage "TIER 2/4/5: integration + chaos + security/a11y audit" 4
    %JEST% src/contexts/__tests__ src/services/__tests__ src/components src/screens src/lib/__tests__ src/navigation/__tests__ src/__tests__ --ci --silent > "%RESULTS%\tier2-integration.log" 2>&1
    if errorlevel 1 (
        type "%RESULTS%\tier2-integration.log"
        call :fail "Tier 2 integration tests failed. See test-results\tier2-integration.log"
    )
)

rem ---------------------------------------------------------------------------
rem 5. Tier 3 - E2E (Maestro). Skipped with a warning unless maestro AND a
rem    connected booted device/emulator are both available.
rem ---------------------------------------------------------------------------
if "%DO_E2E%"=="1" (
    call :stage "TIER 3: E2E (Maestro)" 5
    where maestro >nul 2>nul
    if errorlevel 1 (
        call :log "maestro CLI not installed - skipping E2E tier."
        call :log "Install: npm i -D maestro  (see maestro\README.md)"
    ) else (
        where adb >nul 2>nul
        if errorlevel 1 (
            call :log "adb not on PATH - no Android device/emulator - skipping E2E."
        ) else (
            adb devices | findstr /r /c:"device$" >nul
            if errorlevel 1 (
                call :log "No booted emulator/device detected - skipping E2E."
            ) else (
                maestro test maestro/ > "%RESULTS%\tier3-e2e.log" 2>&1
                if errorlevel 1 (
                    type "%RESULTS%\tier3-e2e.log"
                    call :fail "E2E flows failed. See test-results\tier3-e2e.log"
                )
            )
        )
    )
)

rem ---------------------------------------------------------------------------
rem 6. Coverage aggregation
rem ---------------------------------------------------------------------------
if "%DO_COVERAGE%"=="1" (
    call :stage "COVERAGE: jest --coverage (HTML in coverage\lcov-report)" 6
    %JEST% --coverage --ci --silent > "%RESULTS%\coverage.log" 2>&1
    if errorlevel 1 (
        type "%RESULTS%\coverage.log"
        call :fail "Coverage run failed. See test-results\coverage.log"
    )
    call :log "HTML report: coverage\lcov-report\index.html"
)

rem ---------------------------------------------------------------------------
rem Done
rem ---------------------------------------------------------------------------
if exist "%RESULTS%\security-report.json" (
    call :log "Security/a11y audit findings: %RESULTS%\security-report.json"
)
call :banner "ALL STAGES PASSED"
call :log "Run finished %DATE% %TIME%"
exit /b 0


rem ===========================================================================
rem Helpers
rem ===========================================================================
:banner
echo.
echo ===========================================================================
echo   %~1
echo ===========================================================================
>>"%MASTER_LOG%" echo [banner] %~1
exit /b 0

:stage
echo.
echo ---------------------------------------------------------------------------
echo   [STAGE %~2] "%~1" [%DATE% %TIME%]
echo ---------------------------------------------------------------------------
>>"%MASTER_LOG%" echo [stage %~2] "%~1" [%DATE% %TIME%]
exit /b 0

:log
echo   "%~1"
>>"%MASTER_LOG%" echo "%~1"
exit /b 0

:fail
echo.
echo ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
echo   FAILED: "%~1"
echo ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
>>"%MASTER_LOG%" echo [FAIL] "%~1" [%DATE% %TIME%]
endlocal
exit 1



