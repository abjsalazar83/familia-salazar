export type ThemeId = 'auto' | 'light' | 'dark' | 'tokyo-night' | 'catppuccin' | 'gruvbox' | 'nord' | 'everforest' | 'kanagawa' | 'rose-pine' | 'matte-black' | 'catppuccin-latte';
export type Theme = { id: ThemeId; name: string; bg: string; acc: string };
// Cores de fundo/acento usadas no seletor e na barra do sistema. As restantes estão em style.css.
export const THEMES: Theme[] = [
  { id: 'auto', name: 'Automático (sistema)', bg: '#f2f2f7', acc: '#007aff' },
  { id: 'light', name: 'Claro', bg: '#f2f2f7', acc: '#007aff' },
  { id: 'dark', name: 'Escuro', bg: '#000000', acc: '#0a84ff' },
  { id: 'tokyo-night', name: 'Tokyo Night', bg: '#1a1b26', acc: '#7aa2f7' },
  { id: 'catppuccin', name: 'Catppuccin', bg: '#1e1e2e', acc: '#cba6f7' },
  { id: 'gruvbox', name: 'Gruvbox', bg: '#282828', acc: '#d79921' },
  { id: 'nord', name: 'Nord', bg: '#2e3440', acc: '#88c0d0' },
  { id: 'everforest', name: 'Everforest', bg: '#2d353b', acc: '#a7c080' },
  { id: 'kanagawa', name: 'Kanagawa', bg: '#1f1f28', acc: '#7e9cd8' },
  { id: 'rose-pine', name: 'Rosé Pine', bg: '#191724', acc: '#ebbcba' },
  { id: 'matte-black', name: 'Matte Black', bg: '#121212', acc: '#e68e0d' },
  { id: 'catppuccin-latte', name: 'Catppuccin Latte', bg: '#eff1f5', acc: '#8839ef' },
];
