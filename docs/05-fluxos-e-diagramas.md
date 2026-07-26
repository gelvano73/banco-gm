# 05 — Fluxos e diagramas

Diagramas de sequência e fluxo alinhados a um processo de negócio corporativo.

---

## 1. Login (cliente) e MFA

```mermaid
sequenceDiagram
  autonumber
  actor U as Cliente
  participant FE as Frontend
  participant API as API Express
  participant DB as SQLite

  U->>FE: Informe CPF/e-mail + senha
  FE->>API: POST /login
  API->>DB: Busca cliente + compara bcrypt
  alt MFA desativado
    API-->>FE: token JWT + perfil
    FE-->>U: Redireciona /app
  else MFA ativado
    API->>DB: Cria mfa_challenges
    API-->>FE: challengeId + código (modo estudo)
    U->>FE: Código 6 dígitos
    FE->>API: POST /api/auth/mfa/verify
    API->>DB: Valida desafio
    API-->>FE: token JWT
  end
```

---

## 2. Login admin

```mermaid
sequenceDiagram
  autonumber
  actor A as Admin
  participant FE as Frontend
  participant API as API
  participant DB as SQLite

  A->>FE: admin@gmbank.local + senha
  FE->>API: POST /login
  API->>DB: SELECT usuarios_admin
  API-->>FE: JWT role=admin
  FE->>API: GET /dashboard
  API-->>FE: KPIs agregados
```

---

## 3. Abertura de conta

```mermaid
sequenceDiagram
  autonumber
  actor U as Cliente
  participant API as API
  participant DB as SQLite

  U->>API: POST /contas { type }
  API->>DB: Checa UNIQUE client_id+type
  API->>DB: Próximo número em contas_sequencias
  API->>DB: INSERT contas saldo=0
  API-->>U: 201 account
```

---

## 4. PIX — envio ponta a ponta

```mermaid
sequenceDiagram
  autonumber
  actor Rem as Remetente
  participant API as API
  participant DB as SQLite

  Rem->>API: POST /pix/enviar
  API->>DB: Valida conta origem ativa + saldo
  API->>DB: Resolve chave em pix
  API->>DB: BEGIN TRANSACTION
  API->>DB: Debita origem / credita destino
  API->>DB: INSERT transferencias type=pix
  API->>DB: INSERT extratos out + in
  API->>DB: COMMIT
  API-->>Rem: 201 transaction + endToEndId
```

```mermaid
flowchart TD
  A[Recebe POST /pix/enviar] --> B{Conta origem ativa?}
  B -->|Não| X[400]
  B -->|Sim| C{Saldo suficiente?}
  C -->|Não| X
  C -->|Sim| D{Chave destino existe?}
  D -->|Não| X
  D -->|Sim| E{Destino ≠ origem?}
  E -->|Não| X
  E -->|Sim| F[Debita / Credita / Extrato]
  F --> G[201 OK]
```

---

## 5. Empréstimo — da simulação ao crédito

```mermaid
sequenceDiagram
  autonumber
  actor U as Cliente
  participant API as API
  participant DB as SQLite

  U->>API: POST /emprestimos/simulate
  API-->>U: parcela / juros / total
  U->>API: POST /emprestimo { accountId }
  API->>DB: INSERT emprestimos pending
  U->>API: POST /emprestimos/:id/approve
  API->>DB: BEGIN
  API->>DB: status=approved + credita principal
  API->>DB: Gera 24 parcelas Price
  API->>DB: extrato tipo emprestimo
  API->>DB: COMMIT
  API-->>U: loan approved
```

### Decomposição Price (parcela n)

```text
juros_n       = saldo_devedor × i
amortizacao_n = PMT − juros_n
saldo_n+1     = saldo_n − amortizacao_n
```

Persistido em `parcelas` para auditoria e cobrança futura.

---

## 6. Transferência unificada

```mermaid
flowchart LR
  REQ[POST /transferencia] --> T{type?}
  T -->|internal| I[Resolve conta G&M<br/>move saldo]
  T -->|ted| E[Debita origem<br/>registra favorecido externo]
  I --> A[auditoria + extratos]
  E --> A
```

---

## 7. Visão de navegação do frontend

```mermaid
flowchart TB
  HOME[/] --> LOGIN[/login]
  HOME --> REG[/register]
  LOGIN -->|client| APP[/app]
  LOGIN -->|admin| ADM[/admin]
  APP --> PIX[/pix]
  APP --> TED[/transferencias]
  APP --> CARD[/cartoes]
  APP --> LOAN[/emprestimos]
  APP --> INV[/investimentos]
  APP --> EXT[/extrato]
  APP --> SEC[/seguranca]
```

---

## 8. Pipeline de uma requisição autenticada

```mermaid
sequenceDiagram
  participant FE as Frontend
  participant MW as authMiddleware
  participant RT as Route
  participant SV as Service
  participant DB as DB

  FE->>MW: Bearer JWT
  MW->>MW: verify + role
  MW->>RT: req.clientId
  RT->>RT: Zod parse
  RT->>SV: chamada de domínio
  SV->>DB: SQL / transaction
  SV-->>RT: DTO público
  RT-->>FE: JSON
```

Esse pipeline é o mesmo padrão visto em APIs bancárias e fintechs: **autenticação → validação → domínio → persistência → resposta**.
