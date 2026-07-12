-- Estas 4 policies tinham nome de restricao ("Users can view THEIR OWN lojas")
-- mas o corpo era USING (true) — nunca restringiram nada. E como policies se
-- somam (OR), elas anulavam as novas: qualquer cliente via as 212 lojas.
drop policy if exists "Users can view their own lojas"   on public.lojas;
drop policy if exists "Users can insert their own lojas" on public.lojas;
drop policy if exists "Users can update their own lojas" on public.lojas;
drop policy if exists "Users can delete their own lojas" on public.lojas;
