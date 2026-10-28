# Família Salazar

PWA (React + TypeScript + Vite + Supabase) para despesas partilhadas, saldo, liquidações e lista de compras do António e da Ana.

- App: https://abjsalazar83.github.io/familia-salazar/
- Base de dados: correr `supabase/schema.sql` no SQL Editor do Supabase (idempotente).
- Desenvolvimento: `npm ci && npm run dev` · testes: `npm test` · build: `npm run build`.
- Publicação: cada push para `main` corre os testes, faz o build e publica no ramo `gh-pages` (GitHub Pages).

A chave Supabase no código é a chave publicável (pública). O acesso aos dados é protegido por RLS: cada pessoa só vê a sua família.
