# 02 — Banco de dados

## 1. Visão geral

Persistência em **SQLite** (`backend/data/gm-bank.db`), criada e migrada em runtime por `backend/src/db/database.ts`.

Valores monetários: **`*_cents` (INTEGER)** — a API converte para reais na resposta.

## 2. Tabelas mínimas (contrato do domínio)

| Tabela | Domínio |
|--------|---------|
| `clientes` | Cadastro PF |
| `contas` | Conta corrente / poupança |
| `cartoes` | Cartão virtual / físico |
| `pix` | Chaves PIX |
| `transferencias` | TED, interna e PIX (movimentos) |
| `emprestimos` | Solicitação e crédito |
| `parcelas` | Cronograma Price |
| `investimentos` | CDB / poupança / Tesouro |
| `extratos` | Ledger de movimentações |
| `auditoria` | Trilha de auditoria |
| `usuarios_admin` | Operadores |

### Auxiliares (suporte operacional)

| Tabela | Uso |
|--------|-----|
| `documentos` | Upload de identidade |
| `password_resets` | Tokens de reset |
| `access_logs` | Logs de autenticação |
| `devices` | Dispositivos conhecidos |
| `mfa_challenges` | Desafios MFA |
| `contas_sequencias` | Sequência do número da conta |

## 3. Diagrama entidade-relacionamento

```mermaid
erDiagram
  CLIENTES ||--o{ CONTAS : possui
  CLIENTES ||--o{ CARTOES : emite
  CLIENTES ||--o{ PIX : registra
  CLIENTES ||--o{ TRANSFERENCIAS : envia
  CLIENTES ||--o{ EMPRESTIMOS : solicita
  CLIENTES ||--o{ INVESTIMENTOS : aplica
  CLIENTES ||--o{ EXTRATOS : movimenta
  CONTAS ||--o{ CARTOES : vincula
  CONTAS ||--o{ PIX : vincula
  CONTAS ||--o{ TRANSFERENCIAS : origem_destino
  EMPRESTIMOS ||--o{ PARCELAS : gera
  TRANSFERENCIAS ||--o{ AUDITORIA : registra

  CLIENTES {
    text id PK
    text cpf UK
    text email UK
    text password_hash
    int mfa_enabled
    int failed_login_attempts
    text locked_until
  }

  CONTAS {
    text id PK
    text client_id FK
    text type
    text agency
    text number UK
    int balance_cents
    text status
  }

  PIX {
    text id PK
    text client_id FK
    text account_id FK
    text type
    text value UK
  }

  TRANSFERENCIAS {
    text id PK
    text type
    text from_account_id FK
    text from_client_id FK
    int amount_cents
    text status
    text pix_key
    text end_to_end_id
  }

  EMPRESTIMOS {
    text id PK
    text client_id FK
    text account_id FK
    int principal_cents
    real monthly_rate
    int term_months
    int installment_cents
    text status
  }

  PARCELAS {
    text id PK
    text emprestimo_id FK
    int numero
    int valor_cents
    int juros_cents
    int amortizacao_cents
    text vencimento
    text status
  }

  EXTRATOS {
    text id PK
    text client_id FK
    text account_id FK
    text tipo
    text direcao
    int amount_cents
    text referencia
  }

  USUARIOS_ADMIN {
    text id PK
    text email UK
    text password_hash
    int active
  }
```

## 4. Relacionamentos e restrições importantes

### Contas
- `UNIQUE (client_id, type)` → no máximo 1 corrente e 1 poupança por CPF.  
- `balance_cents >= 0`.  
- Status: `active | blocked | closed`.

### PIX (chaves)
- `UNIQUE (client_id, type)` → uma chave de cada tipo.  
- `value` único no banco.  
- Movimentos PIX ficam em `transferencias` (`type = 'pix'`) **e** em `extratos`.

### Transferências
- Tipos: `ted | internal | pix`.  
- Status: `completed | failed`.  
- TED guarda dados do favorecido externo; interna resolve conta destino G&M.

### Empréstimos e parcelas
- Status do empréstimo: `pending | approved | …`.  
- Na aprovação: credita saldo + gera N linhas em `parcelas` (Tabela Price).

### Extratos
- Ledger append-only por cliente/conta.  
- `direcao`: `in | out`.  
- `referencia` aponta para o ID da operação de origem.

## 5. Modelo monetário

```text
R$ 1.234,56  →  123456 cents (banco)
API responde →  amount: 1234.56  e  amountCents: 123456
```

Evita acumulação de erro de `float` em cálculos financeiros.

## 6. Migrações

Na inicialização:

1. Renomeia tables legadas EN → PT (`clients` → `clientes`, …).  
2. Cria tabelas/índices se não existirem.  
3. Evolui `transferencias` para aceitar `type = 'pix'`.  
4. Copia `pix_transactions` legadas → `transferencias` + `extratos`.  
5. Backfill de `parcelas` para empréstimos já aprovados.  
6. Remove artefatos legados (`documents`, `pix_transactions`).

## 7. Índices de integridade (negócio)

```sql
UNIQUE contas (client_id, type);
UNIQUE cartoes (account_id, type);
UNIQUE pix (client_id, type);
```

## 8. Como inspecionar o banco

```bash
# Via script Node/tsx ou DB Browser for SQLite
# Arquivo: backend/data/gm-bank.db
```

Consultas úteis:

```sql
SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1;
SELECT COUNT(*) FROM clientes;
SELECT type, COUNT(*) FROM transferencias GROUP BY type;
SELECT emprestimo_id, COUNT(*) FROM parcelas GROUP BY emprestimo_id;
```
