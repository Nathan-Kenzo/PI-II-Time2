/**
 * Autor: Pedro Tiezo Sales Shimizu
 *
 * Hash de senha com scrypt, do módulo crypto do próprio Node (sem biblioteca).
 * O banco guarda "sal:hash" em hexadecimal, nunca a senha em texto puro.
 * O sal é um valor aleatório por usuário: duas senhas iguais geram hashes diferentes.
 *
 * Autoteste: npx tsx src/senha.ts
 */

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// Gera o texto "sal:hash" a ser gravado na coluna usuario.senha
export function gerarHash(senha: string): string {
  const sal = randomBytes(16).toString("hex");
  return sal + ":" + scryptSync(senha, sal, 32).toString("hex");
}

// Confere a senha digitada no login com o "sal:hash" guardado no banco
export function conferirSenha(senha: string, guardado: string): boolean {
  const [sal, hash] = guardado.split(":");
  if (!sal || !hash) {
    return false;
  }
  const calculado = scryptSync(senha, sal, 32);
  const esperado = Buffer.from(hash, "hex");
  // timingSafeEqual compara em tempo constante e exige tamanhos iguais
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

// Autoteste: só roda quando este arquivo é executado diretamente
if (require.main === module) {
  const assert = require("assert");
  const guardado = gerarHash("lider123");
  assert(conferirSenha("lider123", guardado));
  assert(!conferirSenha("outra", guardado));
  assert(!conferirSenha("lider123", "texto sem dois pontos"));
  // hash do usuário pedro@demandatrack.com no database/seed.sql
  assert(conferirSenha("lider123", "c87cc23b6d1b10483ab892be65cb3e35:763db872bfc96e8c3e80ad3d8f6f5e3cc21d9c5504748eb7a465f06d075421c2"));
  console.log("senha.ts: todas as verificações passaram.");
}
