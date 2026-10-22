/**
 * Transfer Showdown - Zero-Dependency SVG Player Avatar Generator
 * Generates an ultra-crisp, stylized vector portrait for any player
 * whenever external CDN images are blocked, missing, or offline.
 */

export function getPlayerInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getPositionColorTheme(position: string): { bg1: string; bg2: string; stroke: string; badgeBg: string; text: string } {
  const p = (position || '').toUpperCase();
  if (p === 'GK') {
    return {
      bg1: '#064e3b',
      bg2: '#022c22',
      stroke: '#10b981',
      badgeBg: '#059669',
      text: '#6ee7b7'
    };
  }
  if (p === 'DEF' || p === 'CB' || p === 'LB' || p === 'RB' || p === 'LWB' || p === 'RWB') {
    return {
      bg1: '#1e3a8a',
      bg2: '#0f172a',
      stroke: '#38bdf8',
      badgeBg: '#2563eb',
      text: '#93c5fd'
    };
  }
  if (p === 'MID' || p === 'CM' || p === 'CAM' || p === 'CDM' || p === 'LM' || p === 'RM') {
    return {
      bg1: '#581c87',
      bg2: '#1e1b4b',
      stroke: '#c084fc',
      badgeBg: '#7c3aed',
      text: '#e9d5ff'
    };
  }
  // FWD, ST, CF, RW, LW
  return {
    bg1: '#7f1d1d',
    bg2: '#450a0a',
    stroke: '#f87171',
    badgeBg: '#dc2626',
    text: '#fca5a5'
  };
}

export function generatePlayerSvgUri(name: string, position: string, flag: string = ''): string {
  const initials = getPlayerInitials(name);
  const theme = getPositionColorTheme(position);
  const posClean = (position || 'PLY').slice(0, 3).toUpperCase();
  const safeName = (name || '').replace(/["'<>&]/g, '');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="${theme.bg1}"/>
      <stop offset="100%" stop-color="${theme.bg2}"/>
    </radialGradient>
    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.stroke}"/>
      <stop offset="100%" stop-color="${theme.badgeBg}"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Background Circle -->
  <circle cx="80" cy="80" r="76" fill="url(#bgGrad)" stroke="url(#ringGrad)" stroke-width="4" filter="url(#glow)"/>

  <!-- Athletic Player Silhouette Vector -->
  <g opacity="0.32" fill="#ffffff">
    <!-- Head -->
    <ellipse cx="80" cy="54" rx="20" ry="24"/>
    <!-- Neck -->
    <rect x="74" y="74" width="12" height="10" rx="3"/>
    <!-- Shoulders & Torso -->
    <path d="M42 125 C42 98, 62 82, 80 82 C98 82, 118 98, 118 125 Z"/>
    <!-- Jersey Collar Accent -->
    <path d="M72 82 L80 94 L88 82 Z" fill="${theme.stroke}" opacity="0.8"/>
  </g>

  <!-- Player Initials (Bold, Centered) -->
  <text x="80" y="76" 
        text-anchor="middle" 
        dominant-baseline="central" 
        fill="#ffffff" 
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" 
        font-size="34" 
        font-weight="900" 
        letter-spacing="1" 
        style="text-shadow: 0 2px 8px rgba(0,0,0,0.85);">
    ${initials}
  </text>

  <!-- Position & Flag Bottom Pill -->
  <g transform="translate(80, 126)">
    <rect x="-38" y="-12" width="76" height="24" rx="12" fill="${theme.badgeBg}" stroke="${theme.stroke}" stroke-width="1.5" filter="url(#glow)"/>
    <text x="0" y="3" 
          text-anchor="middle" 
          dominant-baseline="central" 
          fill="#ffffff" 
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" 
          font-size="12" 
          font-weight="800">
      ${posClean} ${flag}
    </text>
  </g>
</svg>`.trim();

  // Convert to base64 data URI
  const base64 = typeof Buffer !== 'undefined'
    ? Buffer.from(svg).toString('base64')
    : btoa(unescape(encodeURIComponent(svg)));
    
  return `data:image/svg+xml;base64,${base64}`;
}
