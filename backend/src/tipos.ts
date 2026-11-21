/**
 * Autor: Felipe Oliveira Barbosa
 *
 * Valores aceitos de tipo, prioridade e status, iguais aos do banco (com acento).
 * Seguem o escopo do sistema (Documento de Visão).
 */

// Listas usadas nas validações (ex: TIPOS.includes(valor)) e no dashboard
export const TIPOS: string[] = ["Tarefa", "Defeito", "Melhoria", "Documentação"];
export const PRIORIDADES: string[] = ["Crítica", "Alta", "Média", "Baixa"];
export const STATUS: string[] = ["Aberta", "Em andamento", "Em revisão", "Concluída", "Cancelada"];
