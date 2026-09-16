# 📋 CHANGELOG — Teste Eneagrama

Todas as mudanças notáveis deste projeto são documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/) e este projeto adere a [Semantic Versioning](https://semver.org/).

---

## [v1.0.0] — 2026-09-16 — 🎉 Versão inicial estável

### ✨ Features

- **Teste de Personalidade Eneagrama** com 9 grupos (A-I) × 5 afirmações cada (45 totais)
- **Escala Likert 0-5** com labels descritivos em cada valor:
  - 0: não me descreve
  - 1: quase não me descreve
  - 2: me descreve um pouco
  - 3: me descreve
  - 4: me descreve muito
  - 5: me descreve totalmente
- **Frontend HTML standalone** (CSS+JS inline) com formulário de nome + WhatsApp
- **Backend Node 22** com SQLite nativo (`node:sqlite`)
- **Geração de PDF elegante** via Puppeteer + `@sparticuz/chromium`
- **Área administrativa** com 2 abas:
  - 📋 **Registros**: lista paginada (10/página), exibindo tipo/nome/% empilhados e em amarelo
  - ⚙️ **Meu Perfil**: editar login e senha do superadmin
- **Login server-side**: credenciais na tabela `admin` (não em placeholder)
- **Modal de confirmação** antes de ver resultado: avisa que dados não podem ser revisados
- **Empatados** listados em sequência (Tipo 1 / Tipo 9), com percentuais próprios
- **PDF gerado automaticamente** ao clicar "Gerar PDF do resultado" (sem perguntas, só resultado)
- **Deploy gratuito** no Render.com (Free plan)

### 🐛 Bugfixes

- Endpoint `/api/*` com path relativo (não `localhost:3911`)
- Rating da escala alinhado pelo topo (não pelo centro)
- Gráfico: cada linha mostra só `Tipo X —` (sem nome da personalidade)
- Espaçamentos mobile corrigidos em breakpoints 768px e 420px
- Rating label sem `white-space: nowrap` em mobile
- Scale-legend com `flex-wrap` em mobile

### 📦 Stack Técnico

- Node.js 22 (slim image)
- @sparticuz/chromium ~121.0.0
- puppeteer-core ~22.0.0
- SQLite 3 (nativo via `node:sqlite`)
- Docker (Render-compatible)
- Chromium dependencies: fonts-liberation, libnss3, libatk, libxkbcommon, libgtk-3, etc.

### 🗄️ Schema SQLite

**Tabela `resultados`:**
- `id`, `nome`, `whatsapp`, `criado_em`
- `dominante`, `dominante_exibicao`, `percentual`, `empate`
- `respostas` (JSON por grupo), `totais` (JSON por grupo), `bars` (JSON array)

**Tabela `admin`:**
- `id=1`, `login`, `senha` (única linha — superadmin)

### 🚀 Deploy

- URL: `https://b-b-eneagram.onrender.com`
- Repositório: `github.com/AlvaroBiano/B-B-EneaGram`
- Region: Ohio (US East) — pode mudar pra gru se disponível
- Plano: Free ($0/mês, 0.1 CPU, 512 MB RAM)

---

## Próximas versões (planejadas)

- [ ] **v1.1.0** — Link único por cliente (`?ref=nome`), pré-preenchimento do nome
- [ ] **v1.2.0** — Envio automático de email com o PDF em anexo
- [ ] **v1.3.0** — Domínio customizado (`teste.alvarobiano.com.br`)
- [ ] **v2.0.0** — Migração pra Postgres multi-cliente (quando escalar além do Free)
