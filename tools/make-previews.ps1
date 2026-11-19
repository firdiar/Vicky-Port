# Generates the kit-sheet preview SVGs in assets/img/kits/.
# Run from the repo root:  powershell -NoProfile -File tools\make-previews.ps1
# The sheets are plain vector content (no gradients, no illustration) so they
# stay crisp, tiny and consistent with the Genesis "flat surface" rule.

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'assets\img\kits'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$kits = @(
  @{ id = 'genesis';    glyph = 'Ge'; name = 'Genesis';    version = 'V1'; handle = '@chef';        ink = '#6366F1'; colors = @('#6366F1', '#20970B', '#FAFAFA', '#0A0A0A'); tag = 'Editorial precision, indigo reserved for interaction.' },
  @{ id = 'aurora';     glyph = 'Au'; name = 'Aurora';     version = 'V2'; handle = '@mika';        ink = '#7C5CFC'; colors = @('#7C5CFC', '#EDEDF2', '#FFFFFF', '#16161D'); tag = 'Data-dense analytics with a cool violet accent.' },
  @{ id = 'graphite';   glyph = 'Gr'; name = 'Graphite';   version = 'V1'; handle = '@north-studio'; ink = '#141414'; colors = @('#141414', '#7A7A74', '#FCFCFA', '#DCDCD6'); tag = 'Monochrome print editorial for long-form reading.' },
  @{ id = 'terracotta'; glyph = 'Te'; name = 'Terracotta'; version = 'V1'; handle = '@sola';        ink = '#C2633F'; colors = @('#C2633F', '#E8D3C4', '#F6EFE7', '#2B1F17'); tag = 'Warm clay commerce surfaces, soft rounding.' },
  @{ id = 'mono-grid';  glyph = 'MG'; name = 'Mono Grid';  version = 'V3'; handle = '@gridhouse';   ink = '#FF4D14'; colors = @('#FF4D14', '#0D0D0D', '#F2F2F0', '#111111'); tag = 'Brutalist Swiss grid, one signal orange.' },
  @{ id = 'paper';      glyph = 'Pa'; name = 'Paper';      version = 'V1'; handle = '@fieldnotes';  ink = '#3E5C8A'; colors = @('#3E5C8A', '#E3DCCB', '#FBF8F1', '#1B1B18'); tag = 'Cream paper, serif body, one muted blue link.' },
  @{ id = 'terminal';   glyph = 'Tm'; name = 'Terminal';   version = 'V2'; handle = '@kbyte';       ink = '#3DDC84'; colors = @('#3DDC84', '#141A16', '#0C0F0D', '#E6EFE9'); tag = 'Dark-first console UI with phosphor green states.' },
  @{ id = 'sandstorm';  glyph = 'Sa'; name = 'Sandstorm';  version = 'V1'; handle = '@dune';        ink = '#B07B3C'; colors = @('#B07B3C', '#D9C4A6', '#F1E7D8', '#231C14'); tag = 'Desert neutrals for long booking flows.' },
  @{ id = 'bloom';      glyph = 'Bl'; name = 'Bloom';      version = 'V1'; handle = '@petal';       ink = '#8E86E8'; colors = @('#8E86E8', '#A8C3AE', '#FBF7F4', '#2A2735'); tag = 'Pastel wellness: 16px rounding and pill controls.' },
  @{ id = 'cobalt';     glyph = 'Co'; name = 'Cobalt';     version = 'V4'; handle = '@northwind';   ink = '#2563EB'; colors = @('#2563EB', '#E2E8F0', '#FFFFFF', '#0F172A'); tag = 'Enterprise clarity, dense forms, 44px targets.' },
  @{ id = 'mosslight';  glyph = 'Mo'; name = 'Mosslight';  version = 'V1'; handle = '@fern';        ink = '#5B7A4A'; colors = @('#5B7A4A', '#DCE7D3', '#E9EDE6', '#2C2B26'); tag = 'Garden-led palette, rejected on contrast.' },
  @{ id = 'signal';     glyph = 'Si'; name = 'Signal';     version = 'V1'; handle = '@relay';       ink = '#F59E0B'; colors = @('#F59E0B', '#EF4444', '#F8FAFC', '#334155'); tag = 'Severity-first alerting UI for operations teams.' }
)

function Esc([string]$s) {
  $s.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;')
}

function Wrap([string]$text, [int]$max) {
  $lines = @()
  $line = ''
  foreach ($word in $text -split ' ') {
    if ($line.Length -eq 0) { $line = $word }
    elseif (($line.Length + 1 + $word.Length) -le $max) { $line = "$line $word" }
    else { $lines += $line; $line = $word }
  }
  if ($line.Length -gt 0) { $lines += $line }
  return $lines
}

$written = 0
foreach ($k in $kits) {
  $tagLines = Wrap $k.tag 44
  if ($tagLines.Count -gt 3) { $tagLines = $tagLines[0..2] }

  $tagSvg = ''
  for ($i = 0; $i -lt $tagLines.Count; $i++) {
    $y = 168 + ($i * 22)
    $tagSvg += "  <text x=`"380`" y=`"$y`" font-family=`"DM Sans, Segoe UI, sans-serif`" font-size=`"14`" fill=`"#6B6B6B`">$(Esc $tagLines[$i])</text>`n"
  }

  $swSvg = ''
  for ($i = 0; $i -lt 4; $i++) {
    $x = 380 + ($i * 68)
    $swSvg += "  <rect x=`"$x`" y=`"268`" width=`"56`" height=`"56`" rx=`"4`" fill=`"$($k.colors[$i])`" stroke=`"#E8E8EC`"/>`n"
  }

  $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400" role="img" aria-label="$(Esc $k.name) kit sheet">
  <rect width="800" height="400" fill="#FFFFFF"/>
  <g fill="#D8D8DE">
    <circle cx="380" cy="40" r="1.4"/><circle cx="402" cy="40" r="1.4"/><circle cx="424" cy="40" r="1.4"/><circle cx="446" cy="40" r="1.4"/><circle cx="468" cy="40" r="1.4"/><circle cx="490" cy="40" r="1.4"/><circle cx="512" cy="40" r="1.4"/><circle cx="534" cy="40" r="1.4"/><circle cx="556" cy="40" r="1.4"/><circle cx="578" cy="40" r="1.4"/><circle cx="600" cy="40" r="1.4"/><circle cx="622" cy="40" r="1.4"/><circle cx="644" cy="40" r="1.4"/><circle cx="666" cy="40" r="1.4"/><circle cx="688" cy="40" r="1.4"/><circle cx="710" cy="40" r="1.4"/><circle cx="732" cy="40" r="1.4"/><circle cx="754" cy="40" r="1.4"/><circle cx="776" cy="40" r="1.4"/>
  </g>
  <text x="40" y="46" font-family="JetBrains Mono, Consolas, monospace" font-size="11" letter-spacing="1.6" fill="#9C9C9C">KIT SHEET / $($k.version)</text>
  <text x="40" y="330" font-family="General Sans, Inter, Segoe UI, sans-serif" font-size="250" font-weight="700" letter-spacing="-12" fill="$(Esc $k.ink)">$(Esc $k.glyph)</text>
  <text x="380" y="118" font-family="General Sans, Inter, Segoe UI, sans-serif" font-size="36" font-weight="700" letter-spacing="-1.2" fill="#0A0A0A">$(Esc $k.name)</text>
  <text x="380" y="140" font-family="JetBrains Mono, Consolas, monospace" font-size="11" fill="#9C9C9C">$(Esc $k.handle)</text>
$tagSvg$swSvg  <line x1="380" y1="352" x2="760" y2="352" stroke="#E8E8EC"/>
  <text x="380" y="372" font-family="JetBrains Mono, Consolas, monospace" font-size="10" fill="#9C9C9C">PALETTE</text>
  <text x="760" y="372" text-anchor="end" font-family="JetBrains Mono, Consolas, monospace" font-size="10" fill="#9C9C9C">DESIGN.MD</text>
</svg>
"@

  $path = Join-Path $out ($k.id + '.svg')
  [System.IO.File]::WriteAllText($path, $svg, [System.Text.UTF8Encoding]::new($false))
  $written++
}

"Wrote $written kit previews to $out"
