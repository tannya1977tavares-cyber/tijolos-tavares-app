const assert = require("assert");
require("../www/modelo-relatorio.js");
const RV = require("../www/relatorio.js");
const dados = { numero: 3, data: "2026-11-03", vendedor: "Bruno", ceramica: "Cerâmica Anapolina", rota: ["Brasília"], fiadas: 71, ocupacao: 0.98,
  itens: [{ medida: "11,5x19x29", mil: 4.6, preco: 2290, frete: 0, custo: 1750 }, { medida: "5x9x19 maciço", mil: 2, preco: 900, frete: 100, custo: 700 }],
  clientes: [{ nome: "Paulo Costa", tel: "", endereco: "SH Estrada do Sol", pagamento: "Pix 03/11", forma: "PIX", total: 10534 }, { nome: "José", total: 1900, pagamento: "A receber" }],
  ajudantes: [{ nome: "Zé", valor: 150 }, { nome: "Tião", valor: 150 }],
  gastos: [{ quando: new Date(2026, 10, 3, 6, 40).getTime(), categoria: "Combustível (diesel)", onde: "Posto Shell", valor: 820.5, banco: "Nubank", origem: "notificacao" },
           { quando: new Date(2026, 10, 3, 12, 10).getTime(), categoria: "Alimentação na viagem", onde: "Restaurante X", valor: 48, banco: "Nubank" },
           { quando: new Date(2026, 10, 3, 9, 0).getTime(), categoria: "Pedágio", onde: "Concebra", valor: 22.4, banco: "Nubank" },
           { quando: new Date(2026, 10, 3, 15, 0).getTime(), categoria: "Descarga", onde: "Chapa", valor: 120, banco: "Nubank" }], freteRetorno: 0 };
const b = RV.montar(dados);
assert.strictEqual(b[0], 0x50); assert.strictEqual(b[1], 0x4b);
const t = RV.calcular(dados);
assert.strictEqual(t.tijolo, 12334); assert.strictEqual(t.frete, 100); assert.strictEqual(t.ceramica, 9450);
assert.strictEqual(t.pagamentos, 420); assert.strictEqual(t.gastos, 890.9); assert.strictEqual(t.liquido, 1673.1);
require("fs").writeFileSync(process.argv[2] || "/tmp/rel.xlsx", b);
console.log("relatorio: tudo certo");
/* quantidade carregada: a cerâmica é paga só pelo que foi carregado; o tijolo de fora não entra */
const d2 = JSON.parse(JSON.stringify(dados)); d2.itens[0].compra = 3.6;
const t2 = RV.calcular(d2);
assert.strictEqual(t2.tijolo, 12334); assert.strictEqual(t2.ceramica, 7700); assert.strictEqual(t2.liquido, 3423.1);
assert.strictEqual(RV.montar(d2)[0], 0x50);
const dd = RV.dadosDe({ numero: 1, carga: { id: "x", data: "2026-11-03", vendedor: "Bruno", ceramica: "anapolina", entregas: [{ cliente: "A", cidade: "Goiânia", medida: "09x19x19", mil: 10, preco: 900, carregado: { mil: 8, fiadas: 95.24 } }, { cliente: "B", cidade: "Goiânia", medida: "09x19x19", mil: 2, preco: 900 }] }, custos: [600, 600] });
assert.strictEqual(dd.itens[0].compra, 8); assert.strictEqual(dd.itens[1].compra, 2); assert.strictEqual(RV.calcular(dd).ceramica, 6000);
console.log("quantidade carregada: tudo certo");
