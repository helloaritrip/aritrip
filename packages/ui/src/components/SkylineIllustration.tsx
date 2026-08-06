/**
 * Silueta de colinas con monumentos — mismo estilo que la ilustración de
 * marca original de miodisea.com (2017): dos tonos de azul fijos
 * (--color-brand-blue-light / --color-brand-blue-deep), sin depender del
 * tema claro/oscuro. Puramente decorativa, sin interactividad — se puede
 * montar en Astro sin isla (cero JS).
 */
export function SkylineIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1600 300"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* colina lejana */}
      <path
        d="M0,140 L300,100 L600,130 L900,90 L1200,120 L1600,100 L1600,300 L0,300 Z"
        className="fill-brand-blue-light"
        opacity="0.55"
      />

      {/* colina cercana + monumentos, mismo color para que lean como una sola silueta */}
      <g className="fill-brand-blue-deep">
        <path d="M0,230 L200,190 L400,210 L600,175 L800,195 L1000,165 L1200,200 L1400,180 L1600,195 L1600,300 L0,300 Z" />

        {/* Torre Eiffel, cerca de x=600 */}
        <path d="M580,175 L592,140 L588,140 L598,110 L595,110 L600,80 L605,110 L602,110 L612,140 L608,140 L620,175 Z" />

        {/* Taj Mahal, cerca de x=1000 */}
        <rect x="960" y="140" width="80" height="25" />
        <path d="M970,140 Q1000,95 1030,140 Z" />
        <rect x="997" y="88" width="6" height="9" />
        <rect x="930" y="145" width="8" height="20" />
        <path d="M930,145 L934,130 L938,145 Z" />
        <rect x="1062" y="145" width="8" height="20" />
        <path d="M1062,145 L1066,130 L1070,145 Z" />

        {/* Estatua de la Libertad, cerca de x=1400 */}
        <path d="M1390,180 L1385,140 Q1400,130 1415,140 L1410,180 Z" />
        <circle cx="1400" cy="132" r="6" />
        <line x1="1408" y1="140" x2="1420" y2="110" stroke="currentColor" strokeWidth="4" />
        <path d="M1416,108 L1420,98 L1424,108 Z" />

        {/* árboles pequeños */}
        <path d="M260,210 L268,192 L276,210 Z M264,196 L268,184 L272,196 Z" />
        <path d="M1220,200 L1228,182 L1236,200 Z M1224,186 L1228,174 L1232,186 Z" />

        {/* siluetas de personas */}
        <circle cx="150" cy="184" r="3" />
        <line x1="150" y1="187" x2="150" y2="196" stroke="currentColor" strokeWidth="2" />
        <circle cx="1310" cy="174" r="3" />
        <line x1="1310" y1="177" x2="1310" y2="186" stroke="currentColor" strokeWidth="2" />
      </g>
    </svg>
  );
}
