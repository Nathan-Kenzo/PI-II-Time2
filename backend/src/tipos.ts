/**
 * Autor: [Felipe Oliveira Barbosa]
 *
 * Tipos usados em todo o backend.
 * Os valores aceitos seguem o escopo do sistema (Documento de Visão).
 */

export type Tipo = "Tarefa" | "Defeito" | "Melhoria" | "Documentação";
export type Prioridade = "Crítica" | "Alta" | "Média" | "Baixa";
export type Status = "Aberta" | "Em andamento" | "Em revisão" | "Concluída" | "Cancelada";
export type Perfil = "Administrador" | "Líder de Projeto" | "Membro da Equipe";

// Listas com os mesmos valores, para usar nas validações (ex: TIPOS.includes(valor))
export const TIPOS: string[] = ["Tarefa", "Defeito", "Melhoria", "Documentação"];
export const PRIORIDADES: string[] = ["Crítica", "Alta", "Média", "Baixa"];
export const STATUS: string[] = ["Aberta", "Em andamento", "Em revisão", "Concluída", "Cancelada"];
export const PERFIS: string[] = ["Administrador", "Líder de Projeto", "Membro da Equipe"];

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  senha: string; // nunca devolver a senha nas respostas da API
  perfil: Perfil;
  projetos: number[]; // ids dos projetos vinculados (Administrador vê todos, por isso fica vazio)
}

export interface Projeto {
  id: number;
  nome: string;
  descricao: string;
}

export interface Demanda {
  id: number;
  titulo: string;
  descricao: string;
  tipo: Tipo;
  prioridade: Prioridade;
  status: Status;
  projetoId: number;
  responsavelId: number | null; // pode ficar em branco
  dataCriacao: string;          // data e hora (ISO)
  dataAtualizacao: string;      // data e hora (ISO)
  prazo: string | null;         // AAAA-MM-DD, opcional
}

export interface Comentario {
  id: number;
  demandaId: number;
  usuarioId: number;
  texto: string;
  data: string; // data e hora (ISO), definida pelo servidor
}