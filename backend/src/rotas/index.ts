/**
 * Autor: Felipe Oliveira Barbosa
 *
 * Junta as rotas de todos os integrantes. Cada um trabalha no seu arquivo,
 * assim evita conflito no Git.
 */

import { Router } from "express";
import login from "./login";
import dashboard from "./dashboard";
import listagemDemandas from "./listagemDemandas";
import cadastroDemandas from "./cadastroDemandas";
import detalhesDemandas from "./detalhesDemandas";
import edicaoDemandas from "./edicaoDemandas";
import cadastroUsuarios from "./cadastroUsuarios";

const router = Router();

router.use(login);
router.use(dashboard);
router.use(listagemDemandas);
router.use(cadastroDemandas);
router.use(detalhesDemandas);
router.use(edicaoDemandas);
router.use(cadastroUsuarios);

export default router;
