// Script Master - Executar Todos os Testes
// Execute: node scripts/testes/run-all-tests.js

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 ========================================');
console.log('🧪 SUITE DE TESTES COMPLETA');
console.log('🧪 Polo Wear Multimarcas - Supabase');
console.log('🧪 ========================================\n');

const tests = [
  {
    name: 'Admin',
    script: 'test-admin.js',
    description: 'Testes de funcionalidades administrativas'
  },
  {
    name: 'Fornecedor',
    script: 'test-fornecedor.js',
    description: 'Testes de funcionalidades do fornecedor'
  },
  {
    name: 'Cliente',
    script: 'test-cliente.js',
    description: 'Testes de funcionalidades do cliente'
  }
];

async function runTest(test) {
  return new Promise((resolvePromise, reject) => {
    console.log(`\n🚀 Executando: ${test.name}`);
    console.log(`📝 ${test.description}`);
    console.log('─'.repeat(50));

    const child = spawn('node', [resolve(__dirname, test.script)], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${test.name}: Todos os testes passaram!`);
        resolvePromise({ test: test.name, success: true });
      } else {
        console.log(`\n❌ ${test.name}: Alguns testes falharam`);
        resolvePromise({ test: test.name, success: false });
      }
    });

    child.on('error', (error) => {
      console.error(`\n❌ Erro ao executar ${test.name}:`, error);
      resolvePromise({ test: test.name, success: false });
    });
  });
}

// Executar todos os testes sequencialmente
const results = [];

for (const test of tests) {
  const result = await runTest(test);
  results.push(result);

  // Pequena pausa entre testes
  await new Promise(resolve => setTimeout(resolve, 2000));
}

// ============================================
// CONSOLIDAR RELATÓRIOS
// ============================================
console.log('\n');
console.log('🧪 ========================================');
console.log('🧪 CONSOLIDAÇÃO DE RESULTADOS');
console.log('🧪 ========================================\n');

const consolidado = {
  data_execucao: new Date().toISOString(),
  testes_executados: tests.length,
  resultados: []
};

for (const test of tests) {
  const relatorioPath = resolve(__dirname, `relatorio-${test.name.toLowerCase()}.json`);

  if (existsSync(relatorioPath)) {
    try {
      const relatorio = JSON.parse(readFileSync(relatorioPath, 'utf8'));

      consolidado.resultados.push({
        nivel: test.name,
        total: relatorio.resultados.total,
        passou: relatorio.resultados.passed,
        falhou: relatorio.resultados.failed,
        taxa_sucesso: ((relatorio.resultados.passed / relatorio.resultados.total) * 100).toFixed(2) + '%'
      });

      console.log(`📊 ${test.name}:`);
      console.log(`   Total: ${relatorio.resultados.total} testes`);
      console.log(`   ✅ Passaram: ${relatorio.resultados.passed}`);
      console.log(`   ❌ Falharam: ${relatorio.resultados.failed}`);
      console.log(`   📈 Taxa: ${((relatorio.resultados.passed / relatorio.resultados.total) * 100).toFixed(2)}%\n`);

    } catch (error) {
      console.error(`❌ Erro ao ler relatório ${test.name}:`, error.message);
    }
  }
}

// Calcular totais gerais
const totais = consolidado.resultados.reduce((acc, r) => ({
  total: acc.total + r.total,
  passou: acc.passou + r.passou,
  falhou: acc.falhou + r.falhou
}), { total: 0, passou: 0, falhou: 0 });

console.log('─'.repeat(50));
console.log('📈 TOTAIS GERAIS:');
console.log(`   Total de Testes: ${totais.total}`);
console.log(`   ✅ Passaram: ${totais.passou}`);
console.log(`   ❌ Falharam: ${totais.falhou}`);
console.log(`   📊 Taxa Geral: ${((totais.passou / totais.total) * 100).toFixed(2)}%`);
console.log('🧪 ========================================\n');

// Salvar consolidado
import { writeFileSync } from 'fs';
consolidado.totais = totais;
consolidado.taxa_sucesso_geral = ((totais.passou / totais.total) * 100).toFixed(2) + '%';

writeFileSync(
  resolve(__dirname, 'relatorio-consolidado.json'),
  JSON.stringify(consolidado, null, 2)
);

console.log('📄 Relatório consolidado salvo em: scripts/testes/relatorio-consolidado.json\n');

// Status final
const todosPassaram = results.every(r => r.success);

if (todosPassaram) {
  console.log('🎉 SUCESSO! Todos os testes passaram em todos os níveis!\n');
  process.exit(0);
} else {
  console.log('⚠️ ATENÇÃO! Alguns testes falharam. Verifique os relatórios.\n');
  process.exit(1);
}
