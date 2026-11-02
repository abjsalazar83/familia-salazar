/** Ícones de linha (stroke 2, currentColor) — mesmo traço em todos os temas. */
export const S = ({ children, size = 20 }: { children: React.ReactNode; size?: number }) => (
  <svg className="icn" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">{children}</svg>
);
export const IcPlus = () => <S><path d="M12 5v14M5 12h14" /></S>;
export const IcCamera = () => <S><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l1.4-2h5.6l1.4 2h1.3A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.5" r="3.5" /></S>;
export const IcMic = () => <S><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></S>;
export const IcGear = () => <S size={22}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></S>;
export const IcX = () => <S size={18}><path d="M6 6l12 12M18 6L6 18" /></S>;
export const IcIn = () => <S size={18}><path d="M12 4v12M6.5 10.5L12 16l5.5-5.5M5 20h14" /></S>;
export const IcCheck = () => <S><path d="M5 12.5l4.5 4.5L19 7.5" /></S>;
export const IcSwap = () => <S><path d="M7 7h12M15 3l4 4-4 4M17 17H5M9 13l-4 4 4 4" /></S>;
export const IcList = () => <S><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></S>;
export const IcPen = () => <S><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></S>;
export const IcInbox = () => <S><path d="M4 13l2.5-8h11L20 13v6H4z" /><path d="M4 13h5l1 2h4l1-2h5" /></S>;
// v40: navegação, lojas, ações e categorias (mesmo traço; SVG em linha → só entra no build o que é usado).
export const IcCalendar = () => <S><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></S>;
export const IcCart = () => <S><circle cx="9" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /><path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h7.6a1.5 1.5 0 0 0 1.5-1.1L20 8H6.2" /></S>;
export const IcRepeat = () => <S><path d="M17 2l3 3-3 3" /><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3" /><path d="M20 13v2a4 4 0 0 1-4 4H4" /></S>;
export const IcChart = () => <S><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></S>;
export const IcStore = ({ size = 16 }: { size?: number }) => <S size={size}><path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6" /></S>;
export const IcTag = ({ size = 16 }: { size?: number }) => <S size={size}><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8" r="1.3" /></S>;
export const IcArchive = () => <S size={18}><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10h14V9M10 13h4" /></S>;
export const IcDots = () => <S><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></S>;
export const IcReceipt = () => <S><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3" /></S>;
export const IcGlobe = ({ size = 14 }: { size?: number }) => <S size={size}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></S>;
export const IcRefill = () => <S size={18}><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" /></S>;
export const IcChevron = ({ open = false }: { open?: boolean }) => <S size={16}><path d={open ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} /></S>;
export const IcBasket = ({ size = 16 }: { size?: number }) => <S size={size}><path d="M5 10h14l-1.5 9h-11zM9 10l3-6 3 6" /></S>;
const CATI: Record<string, React.ReactNode> = {
  Supermercado: <path d="M5 10h14l-1.5 9h-11zM9 10l3-6 3 6" />,
  Casa: <path d="M4 11l8-7 8 7v9H4zM10 20v-5h4v5" />,
  Lazer: <><circle cx="12" cy="12" r="9" /><path d="M9 10h.01M15 10h.01M8.5 14.5a4.5 4.5 0 0 0 7 0" /></>,
  Saúde: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  Escola: <path d="M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5" />,
  Transporte: <><path d="M5 16V9l2-4h10l2 4v7zM5 12h14" /><circle cx="8" cy="18" r="1.5" /><circle cx="16" cy="18" r="1.5" /></>,
  Subscrições: <><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M10 9l4 2-4 2z" /></>,
  Outros: <><circle cx="12" cy="12" r="9" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
};
/** Ícone da categoria (fallback: «Outros»). */
export const IcCat = ({ cat, size = 16 }: { cat: string; size?: number }) => <S size={size}>{CATI[cat] ?? CATI.Outros}</S>;
