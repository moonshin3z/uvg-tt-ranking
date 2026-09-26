/**
 * Los glifos blancos que van dentro de los cuadritos de color de una fila,
 * como los de Ajustes en iPhone, y los dibujos grandes de las pantallas
 * vacías. Copiados del prototipo de iOS.
 */

function Glifo({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const GLIFO = {
  alerta: (
    <Glifo>
      <path d="M12 5.5v8.5" strokeWidth="3" />
      <path d="M12 18.6h.01" strokeWidth="3.4" />
    </Glifo>
  ),
  trofeo: (
    <Glifo>
      <path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0z" fill="#fff" />
      <path d="M7.5 6.5H5a2.5 2.5 0 0 0 3 3.2M16.5 6.5H19a2.5 2.5 0 0 1-3 3.2" />
      <path d="M12 14.5v3.5M8.5 20h7" />
    </Glifo>
  ),
  mas: (
    <Glifo>
      <path d="M12 5.5v13M5.5 12h13" strokeWidth="2.6" />
    </Glifo>
  ),
  personas: (
    <Glifo>
      <circle cx="9" cy="8.5" r="3.2" fill="#fff" />
      <path d="M3.5 19c.8-3 2.9-4.6 5.5-4.6s4.7 1.6 5.5 4.6" fill="#fff" />
      <circle cx="16.5" cy="9" r="2.5" fill="#fff" stroke="none" />
      <path d="M16.2 14.3c2.2 0 3.8 1.4 4.4 4" />
    </Glifo>
  ),
  bajar: (
    <Glifo>
      <path d="M12 4.5v11M7.5 11l4.5 4.5 4.5-4.5M5.5 19.5h13" />
    </Glifo>
  ),
  llave: (
    <Glifo>
      <circle cx="8" cy="12" r="3.6" />
      <path d="M11.6 12H20M17 12v3M20 12v2.4" />
    </Glifo>
  ),
  lista: (
    <Glifo>
      <path d="M9 7h10M9 12h10M9 17h10" />
      <circle cx="5" cy="7" r=".9" fill="#fff" />
      <circle cx="5" cy="12" r=".9" fill="#fff" />
      <circle cx="5" cy="17" r=".9" fill="#fff" />
    </Glifo>
  ),
  calendario: (
    <Glifo>
      <rect x="4" y="5.5" width="16" height="14" rx="3" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </Glifo>
  ),
  paleta: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden>
      <circle cx="14.2" cy="9.3" r="6.3" />
      <path d="M9.3 14.7 5 19" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="19.4" cy="18.8" r="2.1" />
    </svg>
  ),
  marcador: (
    <Glifo>
      <rect x="3.5" y="6" width="17" height="12" rx="3" />
      <path d="M12 6v12M7.5 10.5v3M16.5 10.5v3" />
    </Glifo>
  ),
};

function Grande({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const DIBUJO = {
  trofeo: (
    <Grande>
      <path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 6.5H5a2.5 2.5 0 0 0 3 3.2M16.5 6.5H19a2.5 2.5 0 0 1-3 3.2M12 14.5v3.5M8.5 20h7" />
    </Grande>
  ),
  sinRed: (
    <Grande>
      <path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a4.8 4.8 0 0 1 6.4 0" />
      <circle cx="12" cy="19.3" r=".9" fill="currentColor" />
      <path d="M3.5 3.5l17 17" />
    </Grande>
  ),
  obra: (
    <Grande>
      <rect x="3.5" y="5" width="17" height="14" rx="3" />
      <path d="M3.5 9.5h17M8 14h5" />
    </Grande>
  ),
  pregunta: (
    <Grande>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.6" />
      <circle cx="12" cy="17" r=".9" fill="currentColor" />
    </Grande>
  ),
};
