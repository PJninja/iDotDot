@echo off
setlocal
title iDotDot - New Element
cd /d "%~dp0"

REM Args:
REM   %1 name      kebab-case element name (prompted if missing)
REM   %2 archetype falling | static | bare  (prompted if missing)
REM            falling: TS class only (gravity/slide tuning drives the shared GPU fall)
REM            static:  TS class only (the GPU leaves unhandled types in place)
REM            bare:    TS class + a WGSL behavior stub wired into the compute shader
REM   %3 friction  yes | no  (falling only; prompted if missing)
REM
REM Generates src/elements/<name>.ts (display + tuning metadata) for the
REM chosen archetype; per-tile behavior runs in the GPU compute shader, so a
REM bare element also gets a WGSL stub in src/engine/gpu/shaders.ts. Then wires then auto-wires settings.ts (type constant) and
REM src/elements/index.ts (import + register).
set "ELEMENT_NAME=%~1"
if not defined ELEMENT_NAME set /p "ELEMENT_NAME=Element name (kebab-case, e.g. water): "
set "ARCHETYPE=%~2"
set "FRICTION=%~3"

REM Hand off to the PowerShell section below (everything after the marker).
set "SELF=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $raw = [IO.File]::ReadAllText($env:SELF); $escaped = [regex]::Escape(':::' + 'PS1-START' + ':::'); $ps = ($raw -split $escaped, 2)[1]; Invoke-Expression $ps }"
set "RC=%errorlevel%"

echo.
pause
exit /b %RC%

:::PS1-START:::
$ErrorActionPreference = 'Stop'
$name = "$env:ELEMENT_NAME".Trim().ToLower()

$usage = 'Usage: new-element.bat <name> [falling|static|bare] [yes|no]'

if ([string]::IsNullOrWhiteSpace($name)) {
  Write-Host "[new-element] ERROR: no name given. $usage"
  exit 1
}
if ($name -notmatch '^[a-z][a-z0-9]*(-[a-z0-9]+)*$') {
  Write-Host "[new-element] ERROR: '$name' must be kebab-case (lowercase letters, digits, hyphens), e.g. water or my-element."
  exit 1
}

$file = "src\elements\$name.ts"
if (Test-Path $file) {
  Write-Host "[new-element] ERROR: $file already exists."
  exit 1
}

# Names: PascalCase class, spaced display name, settings constant.
$words = $name -split '-'
$pascal = ($words | ForEach-Object { $_.Substring(0,1).ToUpper() + $_.Substring(1) })
$className = $pascal -join ''
$displayName = $pascal -join ' '
$typeConst = ($name -replace '-', '_').ToUpper() + '_TYPE'
$nameConst = ($name -replace '-', '_').ToUpper()

# Archetype: falling (gravity + slide), static (fixed solid), bare (minimal).
$archetype = "$env:ARCHETYPE".Trim().ToLower()
while ($archetype -ne 'falling' -and $archetype -ne 'static' -and $archetype -ne 'bare') {
  Write-Host 'Archetype: falling (shared GPU gravity + slide), static (fixed solid), bare (custom WGSL behavior stub)'
  $archetype = (Read-Host 'Archetype [falling]').Trim().ToLower()
  if ([string]::IsNullOrWhiteSpace($archetype)) { $archetype = 'falling' }
}

# Friction (falling only): slope-aware, sticky piles (see Dirt).
$friction = $false
if ($archetype -eq 'falling') {
  $f = "$env:FRICTION".Trim().ToLower()
  if ($f -eq 'yes' -or $f -eq 'y' -or $f -eq 'true') { $friction = $true }
  elseif ($f -eq 'no' -or $f -eq 'n' -or $f -eq 'false') { $friction = $false }
  else {
    $ans = (Read-Host 'Slope-aware friction (sticky, clumpy piles)? [y/N]').Trim().ToLower()
    $friction = $ans -eq 'y' -or $ans -eq 'yes'
  }
}

# Next free type ID: scan settings.ts (X_TYPE: N) and every element file
# (readonly type = N) so previously scaffolded, not-yet-wired elements
# are counted too.
$ids = @()
[regex]::Matches([IO.File]::ReadAllText('src\settings.ts'), '_TYPE:\s*(\d+)') |
  ForEach-Object { $ids += [int]$_.Groups[1].Value }
Get-ChildItem 'src\elements\*.ts' | ForEach-Object {
  [regex]::Matches([IO.File]::ReadAllText($_.FullName), 'readonly type\s*=\s*(\d+)') |
    ForEach-Object { $ids += [int]$_.Groups[1].Value }
}
$typeId = 1
if ($ids.Count -gt 0) { $typeId = ($ids | Measure-Object -Maximum).Maximum + 1 }

# Fail fast on wiring conflicts before writing anything.
$settingsPath = 'src\settings.ts'
$settingsText = [IO.File]::ReadAllText($settingsPath)
if ($settingsText.Contains("${typeConst}:")) {
  Write-Host "[new-element] ERROR: ${typeConst} already exists in settings.ts."
  exit 1
}
$indexPath = 'src\elements\index.ts'
$indexText = [IO.File]::ReadAllText($indexPath)
if ($indexText.Contains("new ${className}()")) {
  Write-Host "[new-element] ERROR: ${className} is already registered in index.ts."
  exit 1
}

# --- Templates (placeholders: {{CLASS_NAME}}, {{DISPLAY_NAME}}, {{TYPE_CONST}},
# --- {{NAME_CONST}}, {{TYPE_ID}}, {{ELEMENT_NAME}}, plus falling-only
# --- {{FALL_DOC}}, {{SLIDE_STATIC}}) ---------------------------------
$tplFalling = @'
import { buildVariantColors } from '../engine/colors';
import { Element } from '../engine/element';
import { computeGravityQuantum } from '../engine/gravity';
import { SETTINGS } from '../settings';

/**
 * {{CLASS_NAME}} (type {{TYPE_ID}}) - TODO: describe this element's behavior.
 *
 * {{FALL_DOC}}
 * Behavior runs in the GPU compute shader (engine/gpu/shaders.ts); this
 * class carries the color and tuning.
 *
 * Gravity: effective fall rate = GRAVITY * {{CLASS_NAME}}.GRAVITY_SCALE +
 * {{CLASS_NAME}}.GRAVITY_OFFSET (tiles per step, clamped at 0). Fractional
 * rates are tracked per tile in the value byte as a fixed-point
 * accumulator (see engine/gravity.ts).
 *
 * Variants shift the base color by up to +-{{NAME_CONST}}_COLOR_VARIANCE
 * per channel; the shifted colors are precomputed at construction
 * (see engine/colors.ts).
 */
export class {{CLASS_NAME}} extends Element {
  readonly type = SETTINGS.{{TYPE_CONST}};
  readonly name = '{{ELEMENT_NAME}}';
  readonly displayName = '{{DISPLAY_NAME}}';
  readonly defaultColor: [number, number, number] = [255, 255, 255]; // TODO: pick a color

  /**
   * Gravity tuning, applied to the global GRAVITY base:
   * effective rate = GRAVITY * GRAVITY_SCALE + GRAVITY_OFFSET (tiles per
   * step). Scale > 1 = heavier (falls faster), < 1 = lighter; offset
   * shifts the rate directly. Negative effective rates clamp to 0.
   */
  static GRAVITY_SCALE = 1;
  static GRAVITY_OFFSET = 0;
{{SLIDE_STATIC}}
  static {{NAME_CONST}}_VARIANT_COUNT = 4;
  static {{NAME_CONST}}_COLOR_VARIANCE = 15;

  /** Effective gravity in fixed-point (1 cell/step = 256). */
  readonly gravityQuantum: number;
  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.gravityQuantum = computeGravityQuantum(
      SETTINGS.GRAVITY,
      {{CLASS_NAME}}.GRAVITY_SCALE,
      {{CLASS_NAME}}.GRAVITY_OFFSET,
    );
    this.variantColors = buildVariantColors(
      this.defaultColor,
      {{CLASS_NAME}}.{{NAME_CONST}}_VARIANT_COUNT,
      {{CLASS_NAME}}.{{NAME_CONST}}_COLOR_VARIANCE,
    );
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % {{CLASS_NAME}}.{{NAME_CONST}}_VARIANT_COUNT];
  }
}
'@

$tplStatic = @'
import { buildVariantColors } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * {{CLASS_NAME}} (type {{TYPE_ID}}) - TODO: describe this element's behavior.
 *
 * Static solid: unaffected by gravity, never moves. Blocks falling
 * elements, which only pass through air. The GPU shader leaves unhandled
 * types untouched, so no behavior code is needed.
 *
 * Variants shift the base color by up to +-{{NAME_CONST}}_COLOR_VARIANCE
 * per channel; the shifted colors are precomputed at construction
 * (see engine/colors.ts).
 */
export class {{CLASS_NAME}} extends Element {
  readonly type = SETTINGS.{{TYPE_CONST}};
  readonly name = '{{ELEMENT_NAME}}';
  readonly displayName = '{{DISPLAY_NAME}}';
  readonly defaultColor: [number, number, number] = [255, 255, 255]; // TODO: pick a color

  static {{NAME_CONST}}_VARIANT_COUNT = 4;
  static {{NAME_CONST}}_COLOR_VARIANCE = 15;

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(
      this.defaultColor,
      {{CLASS_NAME}}.{{NAME_CONST}}_VARIANT_COUNT,
      {{CLASS_NAME}}.{{NAME_CONST}}_COLOR_VARIANCE,
    );
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % {{CLASS_NAME}}.{{NAME_CONST}}_VARIANT_COUNT];
  }
}
'@

$tplBare = @'
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * {{CLASS_NAME}} (type {{TYPE_ID}}) - TODO: describe this element's behavior.
 * Per-tile behavior runs on the GPU: see update{{CLASS_NAME}} in
 * engine/gpu/shaders.ts (stub wired in by new-element.bat).
 */
export class {{CLASS_NAME}} extends Element {
  readonly type = SETTINGS.{{TYPE_CONST}};
  readonly name = '{{ELEMENT_NAME}}';
  readonly displayName = '{{DISPLAY_NAME}}';
  readonly defaultColor: [number, number, number] = [255, 255, 255]; // TODO: pick a color

  getColor(_value: number, _variant: number): [number, number, number] {
    return this.defaultColor;
  }
}
'@

# --- Pick the template and fill the falling-specific placeholders first
# --- (the shared replacements run afterwards).
switch ($archetype) {
  'falling' {
    $template = $tplFalling
    $eol = if ($template.Contains("`r`n")) { "`r`n" } else { "`n" }
    if ($friction) {
      $template = $template.Replace('{{FALL_DOC}}', 'Falls straight down through air (up to the accumulated fall budget); when blocked, a slope-aware friction-gated 1-cell diagonal slide (see SLIDE_CHANCE).')
      $template = $template.Replace('{{SLIDE_STATIC}}', "${eol}  /** Probability a tile on a slope rolls off; 1 = always slide (no friction). */${eol}  static SLIDE_CHANCE = 0.25;${eol}  readonly slideChance = {{CLASS_NAME}}.SLIDE_CHANCE;")
    } else {
      $template = $template.Replace('{{FALL_DOC}}', 'Falls straight down through air (up to the accumulated fall budget), else a 1-cell diagonal slide (random side first) to form classic piles.')
      $template = $template.Replace('{{SLIDE_STATIC}}', '')
    }
  }
  'static' { $template = $tplStatic }
  'bare'   { $template = $tplBare }
}

$template = $template.
  Replace('{{CLASS_NAME}}', $className).
  Replace('{{DISPLAY_NAME}}', $displayName).
  Replace('{{TYPE_CONST}}', $typeConst).
  Replace('{{NAME_CONST}}', $nameConst).
  Replace('{{TYPE_ID}}', [string]$typeId).
  Replace('{{ELEMENT_NAME}}', $name)
# Normalize to LF: the here-string inherits this .bat's line endings, but the
# repo's .ts files use LF.
$template = $template -replace "`r`n", "`n"

[IO.File]::WriteAllText((Join-Path $PWD $file), $template, (New-Object System.Text.UTF8Encoding($false)))

# --- bare: add a WGSL behavior stub to the compute shader (type constant,
# --- update function, dispatch case at the `new-element:` markers).
if ($archetype -eq 'bare') {
  $shaderPath = 'src\engine\gpu\shaders.ts'
  $shaderText = [IO.File]::ReadAllText((Join-Path $PWD $shaderPath))
  $markers = @('// new-element:types', '// new-element:behaviors', '    // new-element:cases')
  foreach ($m in $markers) {
    if (-not $shaderText.Contains($m)) {
      Write-Host "[new-element] ERROR: marker '$($m.Trim())' not found in $shaderPath; add the WGSL stub manually."
      exit 1
    }
  }
  $shaderEol = if ($shaderText.Contains("`r`n")) { "`r`n" } else { "`n" }
  $typeLine = 'const ' + $nameConst + ' : u32 = ${SETTINGS.' + $typeConst + '}u;'
  $fnBlock = @(
    "// TODO: $displayName behavior. Return stay(newValue), or moveTo(x, y, newValue)",
    "// for a destination won with claim(x, y) (see updateFall). Reads see the",
    "// pre-step state; use passable(x, y) to test a cell.",
    "fn update$className(x : i32, y : i32, value : u32) -> Move {",
    "  return stay(value);",
    "}",
    ""
  ) -join $shaderEol
  $caseBlock = (@(
    "    case ${nameConst}: {",
    "      result = update${className}(x, y, value);",
    "    }",
    ""
  ) -join $shaderEol)
  $shaderText = $shaderText.Replace('// new-element:types', $typeLine + $shaderEol + '// new-element:types')
  $shaderText = $shaderText.Replace('// new-element:behaviors', $fnBlock + $shaderEol + '// new-element:behaviors')
  $shaderText = $shaderText.Replace('    // new-element:cases', $caseBlock + '    // new-element:cases')
  [IO.File]::WriteAllText((Join-Path $PWD $shaderPath), $shaderText, (New-Object System.Text.UTF8Encoding($false)))
}

# --- Auto-wire settings.ts: append the type constant to the first run of
# --- consecutive *_TYPE lines (keeps the ID block together; AIR_TYPE, which
# --- must stay 0, lives separately and is left alone).
$eol = if ($settingsText.Contains("`r`n")) { "`r`n" } else { "`n" }
$ms = [regex]::Matches($settingsText, '(?m)^\s*[A-Z0-9_]*_TYPE: \d+,\r?\n')
if ($ms.Count -eq 0) {
  Write-Host '[new-element] ERROR: no *_TYPE lines found in settings.ts; add the type constant manually.'
  exit 1
}
$runEnd = $ms[0].Index + $ms[0].Length
for ($i = 1; $i -lt $ms.Count; $i++) {
  if ($ms[$i].Index -eq $runEnd) { $runEnd = $ms[$i].Index + $ms[$i].Length } else { break }
}
$settingsText = $settingsText.Insert($runEnd, "  ${typeConst}: ${typeId},${eol}")
[IO.File]::WriteAllText((Join-Path $PWD $settingsPath), $settingsText, (New-Object System.Text.UTF8Encoding($false)))

# --- Auto-wire index.ts: insert the import and register line at their
# --- alphabetical positions among the existing element entries.
$eol = if ($indexText.Contains("`r`n")) { "`r`n" } else { "`n" }

$importMatches = [regex]::Matches($indexText, "(?m)^import \{ (\w+) \} from '\./(\w+)';\r?\n")
$importPos = $null
if ($importMatches.Count -gt 0) {
  $importPos = $importMatches[0].Index
  foreach ($m in $importMatches) {
    if ([string]::Compare($m.Groups[1].Value, $className, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
      $importPos = $m.Index + $m.Length
    }
  }
} else {
  $lastImport = $null
  foreach ($m in [regex]::Matches($indexText, '(?m)^import .*;\r?\n')) { $lastImport = $m }
  if ($lastImport -eq $null) {
    Write-Host '[new-element] ERROR: could not find an import line in index.ts; add the import manually.'
    exit 1
  }
  $importPos = $lastImport.Index + $lastImport.Length
}
$indexText = $indexText.Insert($importPos, "import { ${className} } from './${name}';${eol}")

$registerMatches = [regex]::Matches($indexText, '(?m)^  registry\.register\(new (\w+)\(\)\);\r?\n')
if ($registerMatches.Count -eq 0) {
  Write-Host '[new-element] ERROR: could not find a registry.register line in index.ts; add the registration manually.'
  exit 1
}
$registerPos = $registerMatches[0].Index
foreach ($m in $registerMatches) {
  if ([string]::Compare($m.Groups[1].Value, $className, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
    $registerPos = $m.Index + $m.Length
  }
}
$indexText = $indexText.Insert($registerPos, "  registry.register(new ${className}());${eol}")
[IO.File]::WriteAllText((Join-Path $PWD $indexPath), $indexText, (New-Object System.Text.UTF8Encoding($false)))

$frictionText = if ($archetype -eq 'falling' -and $friction) { ', friction' } else { '' }
Write-Host "[new-element] Created $file (${archetype}${frictionText}, type ${typeId})"
Write-Host '[new-element] Wired up:'
Write-Host "  - settings.ts: ${typeConst}: ${typeId}"
Write-Host "  - index.ts: import + registry.register(new ${className}())"
Write-Host '[new-element] Next steps:'
Write-Host '  1. Pick a defaultColor and tweak the statics in the new file.'
if ($archetype -eq 'bare') {
  Write-Host "  2. Implement update${className} in src/engine/gpu/shaders.ts (stub already wired in)."
} else {
  Write-Host '  2. No shader work needed: the GPU handles this archetype from the class tuning.'
}
Write-Host '  3. npx tsc --noEmit, then check the browser console for shader errors.'
exit 0
