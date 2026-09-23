# Processos BPMN

Plataforma para modelar, documentar e acompanhar processos organizacionais em BPMN 2.0.

## Configuração

1. Crie um projeto no Supabase.
2. No SQL Editor, execute `supabase/migrations/001_init.sql`.
3. Copie `.env.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Não coloque a service role key em variável `NEXT_PUBLIC_` nem no frontend.

4. Em Authentication, crie um usuário.
5. Promova esse usuário a administrador:

```sql
update public.profiles
set role = 'administrador'
where email = 'voce@empresa.com';
```

Novos usuários entram como visualizadores. O administrador altera o perfil em Administração.

## Execução

```bash
npm run dev
```

Verificações:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Fase 1

Dashboard, autenticação com papéis, cadastro de processos, modelador bpmn-js, salvamento do XML com autosave, importação e exportação, e documentação dos elementos em tabela separada do XML.
