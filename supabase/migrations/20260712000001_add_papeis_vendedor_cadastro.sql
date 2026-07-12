-- Libera os papeis internos 'vendedor' e 'cadastro'.
-- role e tipo_negocio sao redundantes no schema atual; ambos precisam aceitar os novos valores.
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role in ('admin','fornecedor','multimarca','franqueado','vendedor','cadastro'));

alter table public.users drop constraint if exists users_tipo_negocio_check;
alter table public.users add constraint users_tipo_negocio_check
  check (tipo_negocio in ('admin','fornecedor','multimarca','franqueado','vendedor','cadastro'));
