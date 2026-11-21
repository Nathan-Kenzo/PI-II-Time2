-- autor: tiezo shimizu
--
-- consultas pra conferir o banco do demandatrack, eh pra rodar no sql developer.
-- coloca o cursor em uma consulta e aperta ctrl+enter, dai o resultado sai em grade.
-- eh tudo select, nada aqui altera os dados.

-- 1) quantas linhas tem em cada tabela (a carga inicial eh 5, 3, 6, 16, 5, 16)
SELECT 'usuario' AS tabela, COUNT(*) AS linhas FROM usuario
UNION ALL SELECT 'projeto', COUNT(*) FROM projeto
UNION ALL SELECT 'usuario_projeto', COUNT(*) FROM usuario_projeto
UNION ALL SELECT 'demanda', COUNT(*) FROM demanda
UNION ALL SELECT 'comentario', COUNT(*) FROM comentario
UNION ALL SELECT 'historico', COUNT(*) FROM historico;

-- 2) demandas, da mais nova pra mais antiga, com projeto e responsavel.
--    depois de cadastrar pela tela, a demanda nova aparece na primeira linha.
SELECT d.id, d.titulo, d.tipo, d.prioridade, d.status,
       p.nome AS projeto, u.nome AS responsavel, d.prazo, d.data_criacao
  FROM demanda d
  JOIN projeto p ON p.id = d.projeto_id
  LEFT JOIN usuario u ON u.id = d.responsavel_id
 ORDER BY d.id DESC;

-- 3) historico de alteracoes: quem fez o que e quando
SELECT h.demanda_id, u.nome, h.descricao, h.data_hora
  FROM historico h
  JOIN usuario u ON u.id = h.usuario_id
 ORDER BY h.data_hora DESC;

-- 4) usuarios, perfis e projetos vinculados (a senha fica gravada como hash)
SELECT u.id, u.nome, u.email, u.perfil,
       LISTAGG(p.nome, ', ') WITHIN GROUP (ORDER BY p.id) AS projetos
  FROM usuario u
  LEFT JOIN usuario_projeto up ON up.usuario_id = u.id
  LEFT JOIN projeto p ON p.id = up.projeto_id
 GROUP BY u.id, u.nome, u.email, u.perfil
 ORDER BY u.id;

-- 5) indicadores do dashboard direto no banco: demandas por status
SELECT status, COUNT(*) AS quantidade FROM demanda GROUP BY status ORDER BY status;

-- 6) comentarios, do mais novo pro mais antigo, com quem escreveu.
--    depois de comentar pela tela, o comentario novo aparece na primeira linha.
SELECT c.demanda_id, u.nome, c.texto, c.data_hora
  FROM comentario c
  JOIN usuario u ON u.id = c.usuario_id
 ORDER BY c.data_hora DESC;
