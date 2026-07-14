# 07 — Guia local (setup)

## 1. Pré-requisitos

- Node.js **18+** (recomendado 20/22)  
- npm  
- Git (opcional)  
- Windows/macOS/Linux  

> No Windows, evite pasta com `&` no caminho (ex.: `banco g&w`). O projeto vive em `banco-gm`.

## 2. Subir a API

```bash
cd backend
npm install
npm run dev
```

Saída esperada:

```text
G&M Bank API rodando em http://localhost:3333
Admin: admin@gmbank.local / Admin@123
```

Teste rápido:

```bash
curl http://localhost:3333/health
```

## 3. Subir o frontend

```bash
cd frontend
npm install
npm run dev
```

Abra: http://localhost:5173

## 4. Variáveis de ambiente (opcional)

Crie `backend/.env`:

```env
PORT=3333
FRONTEND_URL=http://localhost:5173
JWT_SECRET=altere-este-segredo
```

## 5. Credenciais

| Papel | Usuário | Senha |
|-------|---------|-------|
| Admin | `admin@gmbank.local` | `Admin@123` |
| Cliente (exemplo) | criado via UI `/register` | — |

## 6. Roteiro de demonstração (5–8 min)

1. **Cadastro** de um cliente PF válido (≥18 anos, CPF ok).  
2. **Login** → dashboard com contas.  
3. Criar **conta corrente** (se ainda não houver) e fazer **depósito teste**.  
4. Criar **chave PIX** (e-mail) e enviar PIX para outro cliente (ou chave consultada).  
5. Fazer uma **TED** ou **transferência interna**.  
6. Solicitar e aprovar **empréstimo** — observar saldo e parcelas.  
7. Abrir **extrato** e exportar CSV.  
8. Ativar **MFA** e refazer login.  
9. Entrar como **admin** e mostrar `/dashboard`.

## 7. Troubleshooting

| Sintoma | Causa comum | Ação |
|---------|-------------|------|
| `Cannot POST /login` | API antiga sem contrato PT | Reiniciar `npm run dev` no backend |
| CORS error | porta/front diferente | Ajustar `FRONTEND_URL` |
| FK / migration error | DB inconsistente | Parar API, apagar `backend/data/gm-bank.db`, subir de novo |
| Admin 500 no login | log com FK inválida | Já corrigido (clientId null); atualize o código |
| Frontend 404 de rota API | cache / api.ts antigo | Confira `frontend/src/lib/api.ts` |

## 8. Onde estão os dados

```text
backend/data/gm-bank.db      → banco SQLite
backend/uploads/             → documentos enviados
```

## 9. Scripts úteis

```bash
# Backend
npm run dev      # watch + reload
npm start        # execução simples

# Frontend
npm run dev
npm run build    # build de produção
npm run preview
```

## 10. Leitura adicional

1. [Arquitetura](01-arquitetura-e-tecnologias.md)  
2. [Banco de dados](02-banco-de-dados.md)  
3. [API](03-api-e-contrato.md)  
4. [Fluxos](05-fluxos-e-diagramas.md)  
