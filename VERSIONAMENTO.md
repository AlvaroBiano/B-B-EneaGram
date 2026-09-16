# 📝 Sistema de Versionamento — Teste Eneagrama

Este projeto segue [Conventional Commits](https://www.conventionalcommits.org/) e [SemVer](https://semver.org/) para versionamento.

## 🏷️ Convenção de Tags SemVer

Formato: **`vMAJOR.MINOR.PATCH`**

| Tipo | Quando usar | Exemplo |
|---|---|---|
| **MAJOR** (v2.0.0) | Mudança incompatível com versão anterior | Reescrever arquitetura, mudar banco |
| **MINOR** (v1.1.0) | Nova feature compatível com versão anterior | Adicionar nova aba, novo campo |
| **PATCH** (v1.0.1) | Bugfix ou ajuste pequeno sem mudar feature | Correção de CSS, texto |

## 📐 Convenção de Commits

Formato: **`<tipo>(escopo): descrição`**

| Prefixo | Quando usar | Exemplo |
|---|---|---|
| `feat:` | Nova feature | `feat(admin): adicionar exportação de registros em CSV` |
| `fix:` | Correção de bug | `fix(login): corrigir endpoint relativo` |
| `style:` | Mudança visual/CSS sem mudar lógica | `style(gráfico): alinhar pelo topo` |
| `refactor:` | Mudança de código sem mudar comportamento | `refactor(server): extrair geração de PDF` |
| `perf:` | Performance | `perf(db): adicionar índice na coluna criado_em` |
| `docs:` | Documentação | `docs(readme): atualizar instruções de deploy` |
| `chore:` | Tarefas de manutenção | `chore(deps): atualizar @sparticuz/chromium` |
| `test:` | Testes | `test(admin): cobrir login` |

## 🔄 Workflow de Branches

- **`main`** — branch principal, sempre pronta pra deploy
- **`release`** — espelha a última versão estável taggeada (opcional)

## 🚀 Como Fazer Deploy de uma Nova Versão

### Workflow completo (do commit até a tag):

```bash
# 1. Fazer suas mudanças locais
# 2. Commit seguindo o padrão
git commit -am "feat(nova-coisa): descrição da feature"

# 3. Push pro GitHub
git push origin main

# 4. Decidir o tipo de versão baseado nas mudanças:
#    - Mudou contrato (API, schema)?  → MAJOR (v2.0.0)
#    - Adicionou feature compatível?    → MINOR (v1.1.0)
#    - Só corrigiu bug?                → PATCH (v1.0.1)

# 5. Criar a tag com a versão
git tag -a v1.1.0 -m "v1.1.0 — Descrição da versão"

# 6. Push da tag
git push origin v1.1.0

# 7. Render detecta e faz deploy automático
```

## ⏪ Como Voltar Pra Versão Anterior

### Cenário 1: Deploy imediato da versão anterior (rollback rápido)

```bash
# 1. Listar tags disponíveis
git tag -l

# 2. Resetar o main pra tag anterior
git reset --hard v1.0.0

# 3. Force push (CUIDADO: sobrescreve histórico)
git push --force origin main

# 4. Render redeploy com a versão antiga
```

### Cenário 2: Manter duas versões (recomendado)

```bash
# 1. Checkout da tag anterior numa branch nova
git checkout -b hotfix-rollback v1.0.0

# 2. Push da branch nova (Render pode deploy de qualquer branch)
git push origin hotfix-rollback

# 3. No painel do Render:
#    - Settings → Branch → seleciona "hotfix-rollback"
#    - Salva → Render faz redeploy automático da versão antiga
```

### Cenário 3: Patch rápido na versão anterior

```bash
# 1. Cria branch a partir da tag antiga
git checkout -b fix-1.0.x v1.0.0

# 2. Faz o fix
# ...edita arquivos...
git commit -am "fix(login): corrigir X"

# 3. Cria patch
git tag -a v1.0.1 -m "v1.0.1 — Hotfix"
git push origin fix-1.0.x v1.0.1

# 4. Render pode deploy dessa branch direto
```

## 🆘 Cenário de Emergência

Se Render tiver problema específico e você precisa da versão antiga AGORA:

1. Painel do Render → `Service` → `Events` → veja qual deploy falhou
2. `Settings` → `Branch` → troque pra `v1.0.0` (ou nome da tag/branch)
3. `Save` → `Manual Deploy`

## 📊 Histórico de Versões

Veja o arquivo `CHANGELOG.md` para o histórico completo.

## 🛠️ Comandos Úteis

```bash
# Ver todas as tags
git tag -l -n

# Ver o que mudou entre versões
git diff v1.0.0 v1.1.0

# Ver histórico com tags
git log --oneline --decorate

# Criar branch hotfix a partir de uma tag
git checkout -b hotfix-xyz v1.0.0
```
