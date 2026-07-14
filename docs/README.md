# Documentação — G&M Bank

Documentação técnica e funcional no padrão de um artefato de portfólio / onboarding corporativo.

## Índice

1. [Arquitetura e tecnologias](01-arquitetura-e-tecnologias.md)  
2. [Banco de dados](02-banco-de-dados.md)  
3. [API e contrato](03-api-e-contrato.md)  
4. [Módulos e regras de negócio](04-modulos-e-regras.md)  
5. [Fluxos e diagramas](05-fluxos-e-diagramas.md)  
6. [Segurança](06-seguranca.md)  
7. [Guia local (setup)](07-guia-local.md)  

## Público-alvo

| Perfil | O que ler primeiro |
|--------|--------------------|
| Recrutador / gestor | README raiz + seções 1 e 4 |
| Desenvolvedor | 1 → 2 → 3 → 5 → 7 |
| Segurança / compliance | 6 + 2 (auditoria/extratos) |

## Convenções

- Rotas de negócio em **português** (`/clientes`, `/pix/enviar`, …).  
- Valores monetários no banco em **centavos** (`INTEGER`), na API em **reais** (`number`).  
- Autenticação: header `Authorization: Bearer <JWT>`.
