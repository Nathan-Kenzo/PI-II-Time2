-- Autor: Pedro Tiezo Sales Shimizu
--
-- Carga inicial do DemandaTrack: usuarios dos tres perfis, projetos, vinculos,
-- demandas, comentarios e historico. Rodar depois do schema.sql.
--
-- Sao os mesmos dados de teste da Reuniao 4 (backend/src/dados/dadosTeste.ts),
-- suficientes para demonstrar filtros, busca, ordenacao e o dashboard.
-- As datas sao calculadas a partir do dia em que o script roda (SYSDATE), para
-- existirem prazos proximos, vencidos e distantes. Para renovar as datas antes
-- de uma apresentacao, basta rodar schema.sql e seed.sql de novo.

SET DEFINE OFF

-- ---------- Usuarios ----------
-- Senhas de demonstracao (ver README), gravadas como hash scrypt no formato
-- sal:hash. O hash e conferido por backend/src/senha.ts.
INSERT INTO usuario (id, nome, email, senha, perfil) VALUES (1, 'Nathan Kenzo Puzipe', 'nathan@demandatrack.com', '1446f583b57a363784835908fa2aa084:8b54a02557f25c6a31d77824cfe0829c94d216ed5cacac4d7aac6382df1566bf', 'Administrador');
INSERT INTO usuario (id, nome, email, senha, perfil) VALUES (2, 'Pedro Tiezo Sales Shimizu', 'pedro@demandatrack.com', 'c87cc23b6d1b10483ab892be65cb3e35:763db872bfc96e8c3e80ad3d8f6f5e3cc21d9c5504748eb7a465f06d075421c2', 'Líder de Projeto');
INSERT INTO usuario (id, nome, email, senha, perfil) VALUES (3, 'Henrique Aguiar de S. Pella', 'henrique@demandatrack.com', 'b5889b1f33743e09f37bf1e0980fc826:e3c794a4c13597f919cb9cf4a99ef688e52ee08e75dfe214edf169372ed70c6c', 'Líder de Projeto');
INSERT INTO usuario (id, nome, email, senha, perfil) VALUES (4, 'Felipe Oliveira Barbosa', 'felipe.barbosa@demandatrack.com', '7b805ac7d9f48b03213965afa637289a:44c5ebf38da50aa00a7a336ac3c9c7f758b787f642d7bbd187b5e8d6285fde85', 'Membro da Equipe');
INSERT INTO usuario (id, nome, email, senha, perfil) VALUES (5, 'Felipe Oliveira dos Santos', 'felipe.santos@demandatrack.com', 'beec6612180704e13869330e8308d12d:c5ccea9bcb1b23de706e5fdd6d9f0702ab11156f58c04ae851b5cbe7786af729', 'Membro da Equipe');

-- ---------- Projetos ----------
INSERT INTO projeto (id, nome, descricao) VALUES (1, 'DemandaTrack', 'Sistema de acompanhamento de demandas de desenvolvimento');
INSERT INTO projeto (id, nome, descricao) VALUES (2, 'Portal Acadêmico', 'Portal web para alunos e professores');
INSERT INTO projeto (id, nome, descricao) VALUES (3, 'App de Biblioteca', 'Aplicativo para empréstimo e devolução de livros');

-- ---------- Vinculos usuario x projeto ----------
-- O Administrador (id 1) enxerga todos os projetos e nao precisa de vinculo.
INSERT INTO usuario_projeto (usuario_id, projeto_id) VALUES (2, 1);
INSERT INTO usuario_projeto (usuario_id, projeto_id) VALUES (3, 2);
INSERT INTO usuario_projeto (usuario_id, projeto_id) VALUES (3, 3);
INSERT INTO usuario_projeto (usuario_id, projeto_id) VALUES (4, 1);
INSERT INTO usuario_projeto (usuario_id, projeto_id) VALUES (5, 1);
INSERT INTO usuario_projeto (usuario_id, projeto_id) VALUES (5, 2);

-- ---------- Demandas ----------
-- SYSDATE - N = N dias atras; TRUNC(SYSDATE) + N = prazo daqui a N dias.

-- Projeto 1: DemandaTrack
INSERT INTO demanda (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo) VALUES (1, 'Corrigir erro no login', 'O formulário de login aceita a submissão com os campos em branco.', 'Defeito', 'Crítica', 'Aberta', 1, 4, SYSDATE - 3, SYSDATE - 3, TRUNC(SYSDATE) + 2);
INSERT INTO demanda (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo) VALUES (2, 'Criar tela de dashboard', 'Montar a tela inicial com os indicadores resumidos das demandas.', 'Tarefa', 'Alta', 'Em andamento', 1, 5, SYSDATE - 10, SYSDATE - 2, TRUNC(SYSDATE) + 5);
INSERT INTO demanda (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo) VALUES (3, 'Documentar rotas da API', 'Descrever no README todas as rotas REST previstas para as demandas.', 'Documentação', 'Média', 'Em revisão', 1, NULL, SYSDATE - 12, SYSDATE - 4, TRUNC(SYSDATE) + 10);
INSERT INTO demanda (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo) VALUES (4, 'Falha ao salvar demanda', 'O sistema não grava a demanda quando a descrição é muito longa.', 'Defeito', 'Crítica', 'Em andamento', 1, 4, SYSDATE - 6, SYSDATE - 1, TRUNC(SYSDATE) + 1);
INSERT INTO demanda (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo) VALUES (5, 'Ajustar espaçamento do menu', 'Menu lateral está com os itens muito colados.', 'Melhoria', 'Baixa', 'Concluída', 1, 5, SYSDATE - 25, SYSDATE - 12, TRUNC(SYSDATE) - 10);
INSERT INTO demanda (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo) VALUES (6, 'Cadastro duplicado de usuário', 'Permite cadastrar o mesmo e-mail duas vezes.', 'Defeito', 'Alta', 'Cancelada', 1, NULL, SYSDATE - 20, SYSDATE - 15, NULL);
INSERT INTO demanda (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo) VALUES (7, 'Configurar pipeline de testes', 'Rodar os testes automaticamente a cada push.', 'Tarefa', 'Alta', 'Concluída', 1, 2, SYSDATE - 40, SYSDATE - 22, TRUNC(SYSDATE) - 20);

-- Projeto 2: Portal Academico
INSERT INTO demanda (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo) VALUES (8, 'Erro ao emitir histórico escolar', 'O PDF do histórico sai em branco para alunos do último semestre.', 'Defeito', 'Crítica', 'Em revisão', 2, 3, SYSDATE - 9, SYSDATE - 1, TRUNC(SYSDATE) - 2);
INSERT INTO demanda (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo) VALUES (9, 'Adicionar filtro por semestre', 'Permitir filtrar as disciplinas por semestre.', 'Melhoria', 'Média', 'Aberta', 2, NULL, SYSDATE - 5, SYSDATE - 5, TRUNC(SYSDATE) + 20);
INSERT INTO demanda (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo) VALUES (10, 'Atualizar manual do aluno', 'Incluir as telas novas no manual.', 'Documentação', 'Baixa', 'Aberta', 2, 5, SYSDATE - 7, SYSDATE - 7, NULL);
INSERT INTO demanda (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo) VALUES (11, 'Revisar mensagens de erro', 'Padronizar as mensagens de erro exibidas ao aluno.', 'Documentação', 'Baixa', 'Em revisão', 2, 5, SYSDATE - 8, SYSDATE - 2, TRUNC(SYSDATE) + 4);

-- Projeto 3: App de Biblioteca
INSERT INTO demanda (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo) VALUES (12, 'Implementar aviso de devolução', 'Avisar o leitor quando o prazo de devolução estiver perto.', 'Tarefa', 'Alta', 'Aberta', 3, 3, SYSDATE - 4, SYSDATE - 4, TRUNC(SYSDATE) + 7);
INSERT INTO demanda (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo) VALUES (13, 'App fecha ao ler código de barras', 'O aplicativo fecha sozinho ao abrir a câmera no Android.', 'Defeito', 'Crítica', 'Aberta', 3, 3, SYSDATE - 2, SYSDATE - 2, TRUNC(SYSDATE) + 3);
INSERT INTO demanda (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo) VALUES (14, 'Melhorar tempo de carregamento', 'A tela inicial demora mais de 5 segundos para abrir.', 'Melhoria', 'Média', 'Em andamento', 3, 3, SYSDATE - 15, SYSDATE - 3, TRUNC(SYSDATE) + 14);
INSERT INTO demanda (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo) VALUES (15, 'Criar tela de perfil do leitor', 'Tela para o leitor ver e editar seus dados.', 'Tarefa', 'Média', 'Concluída', 3, 3, SYSDATE - 30, SYSDATE - 8, TRUNC(SYSDATE) - 5);
INSERT INTO demanda (id, titulo, descricao, tipo, prioridade, status, projeto_id, responsavel_id, data_criacao, data_atualizacao, prazo) VALUES (16, 'Integrar login social', 'Entrar com conta de outro serviço.', 'Tarefa', 'Baixa', 'Cancelada', 3, 3, SYSDATE - 35, SYSDATE - 18, TRUNC(SYSDATE) + 30);

-- ---------- Comentarios ----------
INSERT INTO comentario (id, demanda_id, usuario_id, texto, data_hora) VALUES (1, 1, 2, 'Reproduzido no Chrome e no Firefox. Falta a validação no submit.', SYSDATE - 2);
INSERT INTO comentario (id, demanda_id, usuario_id, texto, data_hora) VALUES (2, 1, 4, 'Vou corrigir a validação no formulário ainda hoje.', SYSDATE - 1);
INSERT INTO comentario (id, demanda_id, usuario_id, texto, data_hora) VALUES (3, 2, 5, 'Falta ligar os indicadores aos dados reais.', SYSDATE - 1);
INSERT INTO comentario (id, demanda_id, usuario_id, texto, data_hora) VALUES (4, 8, 1, 'Prioridade máxima, o prazo já venceu.', SYSDATE - 1);
INSERT INTO comentario (id, demanda_id, usuario_id, texto, data_hora) VALUES (5, 13, 3, 'Acontece só em alguns modelos de celular.', SYSDATE - 1);

-- ---------- Historico ----------
-- Um registro de criacao por demanda, feito pelo lider do projeto
-- (Pedro no projeto 1, Henrique nos projetos 2 e 3).
INSERT INTO historico (demanda_id, usuario_id, descricao, data_hora)
SELECT id, CASE projeto_id WHEN 1 THEN 2 ELSE 3 END, 'criou a demanda.', data_criacao FROM demanda;

COMMIT;

-- Os ids acima foram informados a mao. Estes comandos fazem a numeracao
-- automatica continuar depois do maior id ja usado em cada tabela.
ALTER TABLE usuario    MODIFY id GENERATED BY DEFAULT ON NULL AS IDENTITY (START WITH LIMIT VALUE);
ALTER TABLE projeto    MODIFY id GENERATED BY DEFAULT ON NULL AS IDENTITY (START WITH LIMIT VALUE);
ALTER TABLE demanda    MODIFY id GENERATED BY DEFAULT ON NULL AS IDENTITY (START WITH LIMIT VALUE);
ALTER TABLE comentario MODIFY id GENERATED BY DEFAULT ON NULL AS IDENTITY (START WITH LIMIT VALUE);
