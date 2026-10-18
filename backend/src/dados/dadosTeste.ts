/**
 * Autor: [Felipe Oliveira Barbosa]
 *
 * Dados de teste em memória, compartilhados por toda a equipe.
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
  { id: 1, nome: "Ana Souza", email: "ana@exemplo.com", senha: "admin123", perfil: "Administrador" },
  { id: 2, nome: "Bruno Lima", email: "bruno@exemplo.com", senha: "lider123", perfil: "Líder de Projeto" },
  { id: 3, nome: "Carla Mendes", email: "carla@exemplo.com", senha: "membro123", perfil: "Membro da Equipe" },
  { id: 4, nome: "Diego Rocha", email: "diego@exemplo.com", senha: "membro456", perfil: "Membro da Equipe" }
];

export const projetos: Projeto[] = [
  { id: 1, nome: "DemandaTrack", descricao: "Sistema de acompanhamento de demandas" },
  { id: 2, nome: "Portal do Cliente", descricao: "Portal web para atendimento ao cliente" },
  { id: 3, nome: "Aplicativo Mobile", descricao: "Aplicativo para celular" }
];

export const demandas: Demanda[] = [
  // ----- Projeto 1: DemandaTrack -----
  { id: 1, titulo: "Corrigir erro no login", descricao: "Usuário válido recebe mensagem de senha incorreta", tipo: "Defeito", prioridade: "Crítica", status: "Aberta", projetoId: 1, responsavelId: 3, dataCriacao: dataHoraEm(-3), dataAtualizacao: dataHoraEm(-3), prazo: prazoEm(2) },
  { id: 2, titulo: "Falha ao salvar demanda", descricao: "O sistema não grava a demanda quando a descrição é muito longa", tipo: "Defeito", prioridade: "Crítica", status: "Em andamento", projetoId: 1, responsavelId: 4, dataCriacao: dataHoraEm(-6), dataAtualizacao: dataHoraEm(-1), prazo: prazoEm(1) },
  { id: 3, titulo: "Criar tela de dashboard", descricao: "Tela com os totais por status, prioridade e tipo", tipo: "Tarefa", prioridade: "Alta", status: "Em andamento", projetoId: 1, responsavelId: 3, dataCriacao: dataHoraEm(-10), dataAtualizacao: dataHoraEm(-2), prazo: prazoEm(5) },
  { id: 4, titulo: "Documentar rotas da API", descricao: "Descrever cada rota, parâmetros e respostas", tipo: "Documentação", prioridade: "Média", status: "Em revisão", projetoId: 1, responsavelId: 4, dataCriacao: dataHoraEm(-12), dataAtualizacao: dataHoraEm(-4), prazo: prazoEm(10) },
  { id: 5, titulo: "Ajustar espaçamento do menu", descricao: "Menu lateral está com os itens muito colados", tipo: "Melhoria", prioridade: "Baixa", status: "Concluída", projetoId: 1, responsavelId: 3, dataCriacao: dataHoraEm(-25), dataAtualizacao: dataHoraEm(-12), prazo: prazoEm(-10) },
  { id: 6, titulo: "Cadastro duplicado de usuário", descricao: "Permite cadastrar o mesmo e-mail duas vezes", tipo: "Defeito", prioridade: "Alta", status: "Cancelada", projetoId: 1, responsavelId: null, dataCriacao: dataHoraEm(-20), dataAtualizacao: dataHoraEm(-15), prazo: null },
  { id: 7, titulo: "Configurar pipeline de testes", descricao: "Rodar os testes automaticamente a cada push", tipo: "Tarefa", prioridade: "Alta", status: "Concluída", projetoId: 1, responsavelId: 2, dataCriacao: dataHoraEm(-40), dataAtualizacao: dataHoraEm(-22), prazo: prazoEm(-20) },

  // ----- Projeto 2: Portal do Cliente -----
  { id: 8, titulo: "Erro de pagamento no checkout", descricao: "Pagamento aprovado mas o pedido continua pendente", tipo: "Defeito", prioridade: "Crítica", status: "Em revisão", projetoId: 2, responsavelId: 2, dataCriacao: dataHoraEm(-9), dataAtualizacao: dataHoraEm(-1), prazo: prazoEm(-2) },
  { id: 9, titulo: "Adicionar filtro por data", descricao: "Permitir filtrar os pedidos por período", tipo: "Melhoria", prioridade: "Média", status: "Aberta", projetoId: 2, responsavelId: null, dataCriacao: dataHoraEm(-5), dataAtualizacao: dataHoraEm(-5), prazo: prazoEm(20) },
  { id: 10, titulo: "Atualizar manual do usuário", descricao: "Incluir as telas novas no manual", tipo: "Documentação", prioridade: "Baixa", status: "Aberta", projetoId: 2, responsavelId: 4, dataCriacao: dataHoraEm(-7), dataAtualizacao: dataHoraEm(-7), prazo: null },
  { id: 11, titulo: "Revisar textos de erro", descricao: "Padronizar as mensagens de erro exibidas ao cliente", tipo: "Documentação", prioridade: "Baixa", status: "Em revisão", projetoId: 2, responsavelId: 4, dataCriacao: dataHoraEm(-8), dataAtualizacao: dataHoraEm(-2), prazo: prazoEm(4) },

  // ----- Projeto 3: Aplicativo Mobile -----
  { id: 12, titulo: "Implementar notificações push", descricao: "Avisar o usuário quando uma demanda mudar de status", tipo: "Tarefa", prioridade: "Alta", status: "Aberta", projetoId: 3, responsavelId: 3, dataCriacao: dataHoraEm(-4), dataAtualizacao: dataHoraEm(-4), prazo: prazoEm(7) },
  { id: 13, titulo: "App fecha ao abrir a câmera", descricao: "O aplicativo fecha sozinho ao tirar foto no Android", tipo: "Defeito", prioridade: "Crítica", status: "Aberta", projetoId: 3, responsavelId: 2, dataCriacao: dataHoraEm(-2), dataAtualizacao: dataHoraEm(-2), prazo: prazoEm(3) },
  { id: 14, titulo: "Melhorar tempo de carregamento", descricao: "A tela inicial demora mais de 5 segundos para abrir", tipo: "Melhoria", prioridade: "Média", status: "Em andamento", projetoId: 3, responsavelId: 4, dataCriacao: dataHoraEm(-15), dataAtualizacao: dataHoraEm(-3), prazo: prazoEm(14) },
  { id: 15, titulo: "Criar tela de perfil", descricao: "Tela para o usuário ver e editar seus dados", tipo: "Tarefa", prioridade: "Média", status: "Concluída", projetoId: 3, responsavelId: 3, dataCriacao: dataHoraEm(-30), dataAtualizacao: dataHoraEm(-8), prazo: prazoEm(-5) },
  { id: 16, titulo: "Integrar login social", descricao: "Entrar com conta de outro serviço", tipo: "Tarefa", prioridade: "Baixa", status: "Cancelada", projetoId: 3, responsavelId: 2, dataCriacao: dataHoraEm(-35), dataAtualizacao: dataHoraEm(-18), prazo: prazoEm(30) }
];

export const comentarios: Comentario[] = [
  { id: 1, demandaId: 1, usuarioId: 2, texto: "Consegui reproduzir o erro com o usuário de teste.", data: dataHoraEm(-2) },
  { id: 2, demandaId: 1, usuarioId: 3, texto: "Parece ser um problema na comparação da senha.", data: dataHoraEm(-1) },
  { id: 3, demandaId: 2, usuarioId: 4, texto: "Já identifiquei o limite do campo, falta ajustar.", data: dataHoraEm(-1) },
  { id: 4, demandaId: 8, usuarioId: 1, texto: "Prioridade máxima, o cliente já reclamou duas vezes.", data: dataHoraEm(-3) },
  { id: 5, demandaId: 13, usuarioId: 2, texto: "Acontece só em alguns modelos de celular.", data: dataHoraEm(-1) }
];
