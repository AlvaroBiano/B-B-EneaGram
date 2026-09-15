# Teste Eneagrama

Aplicativo do Teste de Personalidade Eneagrama do Álvaro — HTML + SQLite + PDF.

## Stack

- **Frontend:** HTML standalone (em `public/index.html`)
- **Backend:** Node 20 com `node:sqlite` nativo
- **PDF:** Puppeteer + `@sparticuz/chromium` (compatível com Linux/Fly.io)
- **Banco:** SQLite em volume persistente do Fly.io (`/data/eneagrama.db`)

## Endpoints

- `GET /` — teste
- `POST /api/enviar` — salva resultado e devolve PDF
- `POST /api/admin/login` — login admin
- `POST /api/admin/atualizar` — editar login/senha
- `GET /api/admin/registros?page=N` — lista paginada
- `DELETE /api/admin/registros/:id` — exclui um registro
- `GET /healthz` — health check

## Credenciais admin iniciais

- Login: `alvarobiano`
- Senha: `AeSm1979@#`

(Trocar pela aba "Meu Perfil" no painel admin após primeiro acesso.)

## Como rodar local

```bash
npm install
node server.js
# abrir http://localhost:3911
```

## Como deployar no Fly.io

```bash
# 1. Login
fly auth login

# 2. Criar app (uma vez)
fly apps create teste-eneagrama-alvaro
fly volumes create eneagrama_data --size 1 --app teste-eneagrama-alvaro

# 3. Deploy
fly deploy

# 4. Verificar
fly status
fly logs
```

URL final será algo como `https://teste-eneagrama-alvaro.fly.dev`.
