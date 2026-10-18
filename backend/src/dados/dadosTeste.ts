/**
 * Autor: [Felipe Oliveira Barbosa]
 *
 * Dados de teste em memória, compartilhados por toda a equipe.
 * Usa os mesmos usuários e projetos do js/dados.js do front-end, com e-mail
 * e senha para o login, e valores com acento, como pede o documento da Reunião 4.
 * Quando o banco de dados for integrado, só o acesso a esses dados muda.
 *
 * As datas são calculadas a partir de hoje, assim os prazos
 * (próximos, vencidos, distantes) continuam fazendo sentido em qualquer dia.
 */

import { Usuario, Projeto, Demanda, Comentario } from "../tipos";

// Devolve a data de hoje + N dias no formato AAAA-MM-DD (use número negativo para o passado)
function prazoEm(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return ano + "-" + mes + "-" + dia;
}

// Devolve data e hora de hoje + N dias em formato ISO
function dataHoraEm(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString();
}


export const usuarios: Usuario[] = [
  { id: 1, nome: "Nathan Kenzo Puzipe", email: "nathan@demandatrack.com", senha: "admin123", perfil: "Administrador", projetos: [] },
  { id: 2, nome: "Pedro Tiezo Sales Shimizu", email: "pedro@demandatrack.com", senha: "lider123", perfil: "Líder de Projeto", projetos: [1] },
  { id: 3, nome: "Henrique Aguiar de S. Pella", email: "henrique@demandatrack.com", senha: "lider456", perfil: "Líder de Projeto", projetos: [2, 3] },
  { id: 4, nome: "Felipe Oliveira Barbosa", email: "felipe.barbosa@demandatrack.com", senha: "membro123", perfil: "Membro da Equipe", projetos: [1] },
  { id: 5, nome: "Felipe Oliveira dos Santos", email: "felipe.santos@demandatrack.com", senha: "membro456", perfil: "Membro da Equipe", projetos: [1, 2] }
];

export const projetos: Projeto[] = [
  { id: 1, nome: "DemandaTrack", descricao: "Sistema de acompanhamento de demandas de desenvolvimento" },
  { id: 2, nome: "Portal Acadêmico", descricao: "Portal web para alunos e professores" },
  { id: 3, nome: "App de Biblioteca", descricao: "Aplicativo para empréstimo e devolução de livros" }
];

export const demandas: Demanda[] = [
  // ----- Projeto 1: DemandaTrack -----
  { id: 1, titulo: "Corrigir erro no login", descricao: "O formulário de login aceita a submissão com os campos em branco.", tipo: "Defeito", prioridade: "Crítica", status: "Aberta", projetoId: 1, responsavelId: 4, dataCriacao: dataHoraEm(-3), dataAtualizacao: dataHoraEm(-3), prazo: prazoEm(2) },
  { id: 2, titulo: "Criar tela de dashboard", descricao: "Montar a tela inicial com os indicadores resumidos das demandas.", tipo: "Tarefa", prioridade: "Alta", status: "Em andamento", projetoId: 1, responsavelId: 5, dataCriacao: dataHoraEm(-10), dataAtualizacao: dataHoraEm(-2), prazo: prazoEm(5) },
  { id: 3, titulo: "Documentar rotas da API", descricao: "Descrever no README todas as rotas REST previstas para as demandas.", tipo: "Documentação", prioridade: "Média", status: "Em revisão", projetoId: 1, responsavelId: null, dataCriacao: dataHoraEm(-12), dataAtualizacao: dataHoraEm(-4), prazo: prazoEm(10) },
  { id: 4, titulo: "Falha ao salvar demanda", descricao: "O sistema não grava a demanda quando a descrição é muito longa.", tipo: "Defeito", prioridade: "Crítica", status: "Em andamento", projetoId: 1, responsavelId: 4, dataCriacao: dataHoraEm(-6), dataAtualizacao: dataHoraEm(-1), prazo: prazoEm(1) },
  { id: 5, titulo: "Ajustar espaçamento do menu", descricao: "Menu lateral está com os itens muito colados.", tipo: "Melhoria", prioridade: "Baixa", status: "Concluída", projetoId: 1, responsavelId: 5, dataCriacao: dataHoraEm(-25), dataAtualizacao: dataHoraEm(-12), prazo: prazoEm(-10) },
  { id: 6, titulo: "Cadastro duplicado de usuário", descricao: "Permite cadastrar o mesmo e-mail duas vezes.", tipo: "Defeito", prioridade: "Alta", status: "Cancelada", projetoId: 1, responsavelId: null, dataCriacao: dataHoraEm(-20), dataAtualizacao: dataHoraEm(-15), prazo: null },
  { id: 7, titulo: "Configurar pipeline de testes", descricao: "Rodar os testes automaticamente a cada push.", tipo: "Tarefa", prioridade: "Alta", status: "Concluída", projetoId: 1, responsavelId: 2, dataCriacao: dataHoraEm(-40), dataAtualizacao: dataHoraEm(-22), prazo: prazoEm(-20) },

  // ----- Projeto 2: Portal Acadêmico -----
  { id: 8, titulo: "Erro ao emitir histórico escolar", descricao: "O PDF do histórico sai em branco para alunos do último semestre.", tipo: "Defeito", prioridade: "Crítica", status: "Em revisão", projetoId: 2, responsavelId: 3, dataCriacao: dataHoraEm(-9), dataAtualizacao: dataHoraEm(-1), prazo: prazoEm(-2) },
  { id: 9, titulo: "Adicionar filtro por semestre", descricao: "Permitir filtrar as disciplinas por semestre.", tipo: "Melhoria", prioridade: "Média", status: "Aberta", projetoId: 2, responsavelId: null, dataCriacao: dataHoraEm(-5), dataAtualizacao: dataHoraEm(-5), prazo: prazoEm(20) },
  { id: 10, titulo: "Atualizar manual do aluno", descricao: "Incluir as telas novas no manual.", tipo: "Documentação", prioridade: "Baixa", status: "Aberta", projetoId: 2, responsavelId: 5, dataCriacao: dataHoraEm(-7), dataAtualizacao: dataHoraEm(-7), prazo: null },
  { id: 11, titulo: "Revisar mensagens de erro", descricao: "Padronizar as mensagens de erro exibidas ao aluno.", tipo: "Documentação", prioridade: "Baixa", status: "Em revisão", projetoId: 2, responsavelId: 5, dataCriacao: dataHoraEm(-8), dataAtualizacao: dataHoraEm(-2), prazo: prazoEm(4) },

  // ----- Projeto 3: App de Biblioteca -----
  { id: 12, titulo: "Implementar aviso de devolução", descricao: "Avisar o leitor quando o prazo de devolução estiver perto.", tipo: "Tarefa", prioridade: "Alta", status: "Aberta", projetoId: 3, responsavelId: 3, dataCriacao: dataHoraEm(-4), dataAtualizacao: dataHoraEm(-4), prazo: prazoEm(7) },
  { id: 13, titulo: "App fecha ao ler código de barras", descricao: "O aplicativo fecha sozinho ao abrir a câmera no Android.", tipo: "Defeito", prioridade: "Crítica", status: "Aberta", projetoId: 3, responsavelId: 3, dataCriacao: dataHoraEm(-2), dataAtualizacao: dataHoraEm(-2), prazo: prazoEm(3) },
  { id: 14, titulo: "Melhorar tempo de carregamento", descricao: "A tela inicial demora mais de 5 segundos para abrir.", tipo: "Melhoria", prioridade: "Média", status: "Em andamento", projetoId: 3, responsavelId: 3, dataCriacao: dataHoraEm(-15), dataAtualizacao: dataHoraEm(-3), prazo: prazoEm(14) },
  { id: 15, titulo: "Criar tela de perfil do leitor", descricao: "Tela para o leitor ver e editar seus dados.", tipo: "Tarefa", prioridade: "Média", status: "Concluída", projetoId: 3, responsavelId: 3, dataCriacao: dataHoraEm(-30), dataAtualizacao: dataHoraEm(-8), prazo: prazoEm(-5) },
  { id: 16, titulo: "Integrar login social", descricao: "Entrar com conta de outro serviço.", tipo: "Tarefa", prioridade: "Baixa", status: "Cancelada", projetoId: 3, responsavelId: 3, dataCriacao: dataHoraEm(-35), dataAtualizacao: dataHoraEm(-18), prazo: prazoEm(30) }
];

export const comentarios: Comentario[] = [
  { id: 1, demandaId: 1, usuarioId: 2, texto: "Reproduzido no Chrome e no Firefox. Falta a validação no submit.", data: dataHoraEm(-2) },
  { id: 2, demandaId: 1, usuarioId: 4, texto: "Vou corrigir a validação no formulário ainda hoje.", data: dataHoraEm(-1) },
  { id: 3, demandaId: 2, usuarioId: 5, texto: "Falta ligar os indicadores aos dados reais.", data: dataHoraEm(-1) },
  { id: 4, demandaId: 8, usuarioId: 1, texto: "Prioridade máxima, o prazo já venceu.", data: dataHoraEm(-1) },
  { id: 5, demandaId: 13, usuarioId: 3, texto: "Acontece só em alguns modelos de celular.", data: dataHoraEm(-1) }
];