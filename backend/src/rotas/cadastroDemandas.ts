/**
 * Autor: Pedro Tiezo Sales Shimizu
 *
 * Rotas de cadastro de demanda e de projetos:
 *   GET  /projetos?usuarioId=N   lista os projetos que o usuário pode ver
 *                                (o Administrador vê todos; os demais, só os vinculados)
 *   POST /demandas               cria uma demanda (sempre com status "Aberta")
 *
 * As regras são as mesmas da tela js/demanda.js, repetidas aqui porque a API
 * não confia no que vem do navegador. O prazo é conferido na API externa de
 * feriados nacionais (BrasilAPI), como exige o documento de visão (item 2.2.5).
 * As funções de apoio (datas, feriados, leitura dos campos) ficam em apoioDemandas.ts.
 *
 * Os dados são lidos e gravados no banco Oracle (ver ../bd.ts).
 */

import { Router, Request, Response } from "express";
import { executar, SAIDA_NUMERO } from "../bd";
import { TIPOS, PRIORIDADES } from "../tipos";
import {
  ADMINISTRADOR,
  MEMBRO_DA_EQUIPE,
  TITULO_MIN,
  TITULO_MAX,
  DESCRICAO_MIN,
  DESCRICAO_MAX,
  comTratamentoDeErros,
  lerTexto,
  lerId,
  exigirObjetoJson,
  acharValor,
  dataValida,
  dataDeHoje,
  conferirFeriado,
  exigirUsuario,
  buscarUsuario,
  temAcessoAoProjeto
} from "./apoioDemandas";

const router = Router();

// ---------- GET /projetos ----------

router.get("/projetos", comTratamentoDeErros(async function (req: Request, res: Response) {
  // Sem usuário identificado (ou com um id que não existe) a resposta é 401
  const usuario = await exigirUsuario(req.query.usuarioId);

  const resultado = usuario.perfil === ADMINISTRADOR
    ? await executar(`SELECT id AS "id", nome AS "nome", descricao AS "descricao" FROM projeto ORDER BY id`)
    : await executar(
      `SELECT id AS "id", nome AS "nome", descricao AS "descricao"
         FROM projeto
        WHERE id IN (SELECT projeto_id FROM usuario_projeto WHERE usuario_id = :usuarioId)
        ORDER BY id`,
      { usuarioId: usuario.id }
    );
  const projetos = resultado.rows ?? [];

  res.status(200).json({ total: projetos.length, projetos: projetos });
}));


// ---------- POST /demandas ----------

router.post("/demandas", comTratamentoDeErros(async function (req: Request, res: Response) {
  const corpo = exigirObjetoJson(req.body);

  const erros: string[] = [];

  // ---------- 1) Campos obrigatórios ----------
  const titulo = lerTexto(corpo.titulo);
  if (!titulo || titulo.length < TITULO_MIN) {
    erros.push("titulo deve ter pelo menos " + TITULO_MIN + " caracteres.");
  } else if (titulo.length > TITULO_MAX) {
    erros.push("titulo deve ter no máximo " + TITULO_MAX + " caracteres.");
  }

  const descricao = lerTexto(corpo.descricao);
  if (!descricao || descricao.length < DESCRICAO_MIN) {
    erros.push("descricao deve ter pelo menos " + DESCRICAO_MIN + " caracteres.");
  } else if (descricao.length > DESCRICAO_MAX) {
    erros.push("descricao deve ter no máximo " + DESCRICAO_MAX + " caracteres.");
  }

  const tipoTexto = lerTexto(corpo.tipo);
  const tipo = tipoTexto ? acharValor(tipoTexto, TIPOS) : undefined;
  if (!tipo) {
    erros.push("tipo inválido. Valores aceitos: " + TIPOS.join(", ") + ".");
  }

  const prioridadeTexto = lerTexto(corpo.prioridade);
  const prioridade = prioridadeTexto ? acharValor(prioridadeTexto, PRIORIDADES) : undefined;
  if (!prioridade) {
    erros.push("prioridade inválida. Valores aceitos: " + PRIORIDADES.join(", ") + ".");
  }

  const projetoId = lerId(corpo.projetoId);
  let projetoExiste = false;
  if (projetoId !== undefined) {
    const resultado = await executar(`SELECT id AS "id" FROM projeto WHERE id = :id`, { id: projetoId });
    projetoExiste = (resultado.rows ?? []).length > 0;
  }
  if (!projetoExiste) {
    erros.push("projetoId deve ser o id de um projeto existente.");
  }

  // Quem está criando a demanda. Vai para o histórico e define a permissão.
  // Limitação: o autor vem no corpo porque ainda não há sessão de login.
  // Quando houver, ele passa a ser o usuário logado e este campo sai.
  const usuarioId = lerId(corpo.usuarioId);
  const autor = usuarioId !== undefined ? await buscarUsuario(usuarioId, projetoId ?? 0) : undefined;
  if (!autor) {
    erros.push("usuarioId deve ser o id de um usuário existente.");
  }

  // Permissão por perfil (item 2.1 do documento): o Membro da Equipe não cria demanda.
  // Conferido antes das outras validações, para não consultar a API de feriados à toa.
  if (autor && autor.perfil === MEMBRO_DA_EQUIPE) {
    res.status(403).json({ erro: "O perfil Membro da Equipe não pode criar demandas." });
    return;
  }

  // ---------- 2) Campos opcionais ----------
  // Responsável pode ficar em branco na criação (item 2.2.5 do documento)
  let responsavelId: number | null = null;
  if (corpo.responsavelId !== undefined && corpo.responsavelId !== null && corpo.responsavelId !== "") {
    responsavelId = lerId(corpo.responsavelId) ?? -1;
    const responsavel = await buscarUsuario(responsavelId, projetoId ?? 0);
    if (!responsavel) {
      erros.push("responsavelId deve ser o id de um usuário existente.");
    } else if (projetoExiste && !temAcessoAoProjeto(responsavel)) {
      erros.push("O responsável precisa estar vinculado ao projeto da demanda.");
    }
  }

  let prazo: string | null = null;
  let avisoPrazo: string | undefined;
  if (corpo.prazo !== undefined && corpo.prazo !== null && corpo.prazo !== "") {
    const prazoTexto = lerTexto(corpo.prazo);
    if (!prazoTexto || !dataValida(prazoTexto)) {
      erros.push("prazo deve ser uma data válida no formato AAAA-MM-DD.");
    } else if (prazoTexto < dataDeHoje()) {
      erros.push("prazo não pode ser uma data passada.");
    } else {
      // Regra obrigatória: o prazo não pode cair em feriado nacional
      const feriado = await conferirFeriado(prazoTexto);
      if (feriado.erro) {
        erros.push(feriado.erro);
      } else {
        prazo = prazoTexto;
        avisoPrazo = feriado.aviso;
      }
    }
  }

  if (erros.length > 0) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: erros });
    return;
  }

  // ---------- 3) Vínculo com o projeto ----------
  // O Líder cria demandas só nos projetos vinculados
  if (!temAcessoAoProjeto(autor!)) {
    res.status(403).json({ erro: "O usuário não está vinculado ao projeto desta demanda." });
    return;
  }

  // ---------- 4) Gravação no banco ----------
  // Status "Aberta", data de criação e de atualização não são enviados:
  // o próprio banco preenche (DEFAULT das colunas), não importa o que veio no corpo.
  const insercao = await executar(
    `INSERT INTO demanda (titulo, descricao, tipo, prioridade, projeto_id, responsavel_id, prazo)
     VALUES (:titulo, :descricao, :tipo, :prioridade, :projetoId, :responsavelId, TO_DATE(:prazo, 'YYYY-MM-DD'))
     RETURNING id INTO :id`,
    {
      titulo: titulo,
      descricao: descricao,
      tipo: tipo,
      prioridade: prioridade,
      projetoId: projetoId,
      responsavelId: responsavelId,
      prazo: prazo,
      id: SAIDA_NUMERO
    }
  );
  const idCriado: number = insercao.outBinds.id[0];

  // Histórico automático (item 2.2.7): quem criou e quando
  await executar(
    `INSERT INTO historico (demanda_id, usuario_id, descricao) VALUES (:demandaId, :usuarioId, 'criou a demanda.')`,
    { demandaId: idCriado, usuarioId: usuarioId }
  );

  // Lê a demanda de volta, para responder com o que realmente ficou gravado
  const criada = await executar(
    `SELECT id AS "id", titulo AS "titulo", descricao AS "descricao", tipo AS "tipo",
            prioridade AS "prioridade", status AS "status", projeto_id AS "projetoId",
            responsavel_id AS "responsavelId", data_criacao AS "dataCriacao",
            data_atualizacao AS "dataAtualizacao", TO_CHAR(prazo, 'YYYY-MM-DD') AS "prazo"
       FROM demanda
      WHERE id = :id`,
    { id: idCriado }
  );

  res.status(201).json({ demanda: criada.rows?.[0], aviso: avisoPrazo });
}));

export default router;
