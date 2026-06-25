-- Same gap as messages.text before it got a CHECK: duels.task and
-- solutions.code had no length limit on the client or the database.
alter table public.duels
  add constraint duels_task_length check (char_length(task) <= 2000);

alter table public.solutions
  add constraint solutions_code_length check (char_length(code) <= 20000);
