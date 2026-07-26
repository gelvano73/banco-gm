# 03 — API e contrato

Base URL local: `http://localhost:3333`

Autenticação (rotas protegidas):

```http
Authorization: Bearer <token_jwt>
```

O JWT carrega `sub` (id), `email` e `role` (`client` | `admin`).

---

## 1. Contrato principal (português)

Estas são as rotas de referência do portfólio:

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/clientes` | Não | Cadastro PF |
| `POST` | `/login` | Não | Login cliente ou admin |
| `POST` | `/contas` | Sim | Criar conta |
| `GET` | `/contas` | Sim | Listar contas |
| `POST` | `/pix/enviar` | Sim | Enviar PIX |
| `POST` | `/transferencia` | Sim | TED ou interna |
| `POST` | `/emprestimo` | Sim | Solicitar empréstimo |
| `GET` | `/extrato` | Sim | Extrato unificado |
| `GET` | `/dashboard` | Admin | KPIs operacionais |

Health check: `GET /health` → `{ status, bank, endpoints, modules }`.

---

## 2. Payloads de exemplo

### `POST /clientes`

```json
{
  "cpf": "52998224725",
  "fullName": "Maria Silva",
  "birthDate": "1995-04-12",
  "email": "maria@example.com",
  "phone": "11999990000",
  "password": "Senha123",
  "street": "Rua A",
  "number": "100",
  "complement": null,
  "neighborhood": "Centro",
  "city": "São Paulo",
  "state": "SP",
  "zipCode": "01001000"
}
```

Resposta `201`: `{ message, client, token }`.

### `POST /login`

```json
{
  "cpfOrEmail": "maria@example.com",
  "password": "Senha123"
}
```

Resposta típica: `{ message, client, token, requiresMfa }`.  
Se MFA ativo: `{ requiresMfa: true, challengeId, mfaCode }` (código exposto em modo estudo).

### `POST /contas`

```json
{ "type": "checking" }
```

Tipos: `checking` | `savings`.

### `POST /pix/enviar`

```json
{
  "fromAccountId": "uuid-conta-origem",
  "pixKey": "maria@example.com",
  "amount": 25.5,
  "description": "Almoço"
}
```

### `POST /transferencia`

**Interna**

```json
{
  "type": "internal",
  "fromAccountId": "uuid",
  "toAgency": "0001",
  "toAccountNumber": "10000003-7",
  "amount": 50,
  "description": "Repasse"
}
```

**TED**

```json
{
  "type": "ted",
  "fromAccountId": "uuid",
  "bankCode": "341",
  "agency": "1234",
  "accountNumber": "56789-0",
  "recipientName": "José Externo",
  "recipientDocument": "12345678901",
  "amount": 100
}
```

### `POST /emprestimo`

```json
{ "accountId": "uuid-conta-credito" }
```

Produto padrão: R$ 10.000 · 2% a.m. · 24x (Tabela Price).

### `GET /extrato?from=2026-01-01&to=2026-12-31`

```json
{
  "from": "2026-01-01",
  "to": "2026-12-31",
  "count": 12,
  "items": [
    {
      "id": "…",
      "date": "…",
      "type": "pix",
      "typeLabel": "PIX",
      "direction": "out",
      "amount": 25.5,
      "amountCents": 2550,
      "description": "…",
      "reference": "…"
    }
  ]
}
```

Exportações: `GET /extrato/csv` · `GET /extrato/pdf`.

### `GET /dashboard` (admin)

```json
{
  "dashboard": {
    "totalClients": 4,
    "totalAccounts": 5,
    "pixVolume": 25.5,
    "tedVolume": 0,
    "activeLoans": 2,
    "estimatedRevenue": 5378.08
  }
}
```

---

## 3. Recursos adicionais (mesma API)

| Prefixo | Recurso |
|---------|---------|
| `/pix/keys` | CRUD de chaves |
| `/pix/lookup/:value` | Consulta chave |
| `/transferencias` | Histórico + auditoria |
| `/emprestimos` | Simular, listar, aprovar |
| `/cartoes` | Emitir, bloquear, PIN |
| `/investimentos` | Produtos, simular, aplicar |
| `/clientes/me` | Perfil e documentos |
| `/api/auth/...` | MFA, reset de senha, dispositivos |

Rotas legadas `/api/accounts`, `/api/loans`, etc. permanecem por compatibilidade.

---

## 4. Modelo de erros

```json
{ "error": "Mensagem amigável." }
```

Validação Zod:

```json
{
  "error": "Dados inválidos.",
  "details": { "amount": ["Valor deve ser maior que zero."] }
}
```

| Status | Significado típico |
|--------|--------------------|
| 400 | Validação / regra de negócio |
| 401 | Credenciais / token ausente |
| 403 | Sem papel admin |
| 404 | Recurso inexistente |
| 500 | Erro inesperado |

---

## 5. Convenções de design da API

1. **Verbos HTTP claros** — criar com `POST`, ler com `GET`, ações de domínio às vezes em `POST /recurso/:id/approve`.  
2. **Idioma do domínio** — nomes alinhados ao BR (`emprestimo`, `extrato`).  
3. **Respostas envelopadas** — `{ account }`, `{ loans }`, `{ dashboard }` facilitam evolução sem breaking change.  
4. **Idempotência parcial** — chaves PIX únicas e limites 1:1 evitam duplicidade estrutural.  
5. **Borda tipada** — Zod na entrada; TypeScript no código.

---

## 6. Mapa front → API

| Tela | Chamadas principais |
|------|---------------------|
| Cadastro | `POST /clientes` |
| Login | `POST /login` |
| App / Dashboard cliente | `GET /contas` |
| PIX | `POST /pix/enviar`, `GET /pix/keys` |
| Transferências | `POST /transferencia` |
| Empréstimos | `POST /emprestimo`, `POST /emprestimos/:id/approve` |
| Extrato | `GET /extrato` |
| Admin | `GET /dashboard` |
