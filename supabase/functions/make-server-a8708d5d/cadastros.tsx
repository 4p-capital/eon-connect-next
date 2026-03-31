import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

export const cadastrosRoutes = new Hono();

// ═══════════════════════════════════════════════════════════════════
// 📦 INSUMOS
// ═══════════════════════════════════════════════════════════════════

// GET /insumos - Listar insumos
cadastrosRoutes.get("/insumos", async (c) => {
  try {
    const insumos = await kv.getByPrefix('insumo_');
    const insumosArray = insumos
      .map(item => item.value)
      .filter((insumo: any) => !insumo.fornecedor_id) // Apenas insumos não vinculados a fornecedores
      .sort((a: any, b: any) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        return dateB.getTime() - dateA.getTime();
      });
    
    console.log(`📦 Listando ${insumosArray.length} insumos`);
    return c.json(insumosArray);
  } catch (error) {
    console.error('❌ Erro ao listar insumos:', error);
    return c.json({ error: 'Erro ao listar insumos' }, 500);
  }
});

// POST /insumos - Criar insumo
cadastrosRoutes.post("/insumos", async (c) => {
  try {
    const body = await c.req.json();
    const insumoId = `insumo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const insumo = {
      id: insumoId,
      nome: body.nome,
      medida: body.medida,
      quantidade: body.quantidade || 0,
      created_at: new Date().toISOString(),
    };
    
    await kv.set(insumoId, insumo);
    
    console.log(`✅ Insumo criado: ${insumo.nome}`);
    return c.json(insumo);
  } catch (error) {
    console.error('❌ Erro ao criar insumo:', error);
    return c.json({ error: 'Erro ao criar insumo' }, 500);
  }
});

// PUT /insumos/:id - Atualizar insumo
cadastrosRoutes.put("/insumos/:id", async (c) => {
  try {
    const insumoId = c.req.param('id');
    const body = await c.req.json();
    
    const insumoAtual = await kv.get(insumoId);
    if (!insumoAtual) {
      return c.json({ error: 'Insumo não encontrado' }, 404);
    }
    
    const insumoAtualizado = {
      ...insumoAtual,
      nome: body.nome ?? insumoAtual.nome,
      medida: body.medida ?? insumoAtual.medida,
      quantidade: body.quantidade ?? insumoAtual.quantidade,
      updated_at: new Date().toISOString(),
    };
    
    await kv.set(insumoId, insumoAtualizado);
    
    console.log(`✅ Insumo atualizado: ${insumoAtualizado.nome}`);
    return c.json(insumoAtualizado);
  } catch (error) {
    console.error('❌ Erro ao atualizar insumo:', error);
    return c.json({ error: 'Erro ao atualizar insumo' }, 500);
  }
});

// DELETE /insumos/:id - Excluir insumo
cadastrosRoutes.delete("/insumos/:id", async (c) => {
  try {
    const insumoId = c.req.param('id');
    
    await kv.del(insumoId);
    
    console.log(`🗑️ Insumo excluído: ${insumoId}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao excluir insumo:', error);
    return c.json({ error: 'Erro ao excluir insumo' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 🏢 FORNECEDORES
// ═══════════════════════════════════════════════════════════════════

// GET /fornecedores - Listar fornecedores
cadastrosRoutes.get("/fornecedores", async (c) => {
  try {
    const fornecedores = await kv.getByPrefix('fornecedor_');
    const fornecedoresArray = fornecedores
      .map(item => item.value)
      .sort((a: any, b: any) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        return dateB.getTime() - dateA.getTime();
      });
    
    console.log(`🏢 Listando ${fornecedoresArray.length} fornecedores`);
    return c.json(fornecedoresArray);
  } catch (error) {
    console.error('❌ Erro ao listar fornecedores:', error);
    return c.json({ error: 'Erro ao listar fornecedores' }, 500);
  }
});

// POST /fornecedores - Criar fornecedor
cadastrosRoutes.post("/fornecedores", async (c) => {
  try {
    const body = await c.req.json();
    const fornecedorId = `fornecedor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fornecedor = {
      id: fornecedorId,
      nome: body.nome,
      local: body.local,
      cnpj: body.cnpj,
      created_at: new Date().toISOString(),
    };
    
    await kv.set(fornecedorId, fornecedor);
    
    console.log(`✅ Fornecedor criado: ${fornecedor.nome}`);
    return c.json(fornecedor);
  } catch (error) {
    console.error('❌ Erro ao criar fornecedor:', error);
    return c.json({ error: 'Erro ao criar fornecedor' }, 500);
  }
});

// PUT /fornecedores/:id - Atualizar fornecedor
cadastrosRoutes.put("/fornecedores/:id", async (c) => {
  try {
    const fornecedorId = c.req.param('id');
    const body = await c.req.json();
    
    const fornecedorAtual = await kv.get(fornecedorId);
    if (!fornecedorAtual) {
      return c.json({ error: 'Fornecedor não encontrado' }, 404);
    }
    
    const fornecedorAtualizado = {
      ...fornecedorAtual,
      nome: body.nome ?? fornecedorAtual.nome,
      local: body.local ?? fornecedorAtual.local,
      cnpj: body.cnpj ?? fornecedorAtual.cnpj,
      updated_at: new Date().toISOString(),
    };
    
    await kv.set(fornecedorId, fornecedorAtualizado);
    
    console.log(`✅ Fornecedor atualizado: ${fornecedorAtualizado.nome}`);
    return c.json(fornecedorAtualizado);
  } catch (error) {
    console.error('❌ Erro ao atualizar fornecedor:', error);
    return c.json({ error: 'Erro ao atualizar fornecedor' }, 500);
  }
});

// DELETE /fornecedores/:id - Excluir fornecedor
cadastrosRoutes.delete("/fornecedores/:id", async (c) => {
  try {
    const fornecedorId = c.req.param('id');
    
    // Buscar e excluir todos os insumos vinculados
    const insumos = await kv.getByPrefix(`insumo_fornecedor_${fornecedorId}_`);
    const insumosIds = insumos.map((i: any) => i.value.id);
    
    if (insumosIds.length > 0) {
      await kv.mdel(insumosIds);
    }
    
    await kv.del(fornecedorId);
    
    console.log(`🗑️ Fornecedor excluído: ${fornecedorId} (${insumosIds.length} insumos vinculados)`);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao excluir fornecedor:', error);
    return c.json({ error: 'Erro ao excluir fornecedor' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// 🔗 VINCULAÇÃO FORNECEDOR-INSUMO
// ═══════════════════════════════════════════════════════════════════

// GET /fornecedores/:id/insumos - Listar insumos de um fornecedor
cadastrosRoutes.get("/fornecedores/:id/insumos", async (c) => {
  try {
    const fornecedorId = c.req.param('id');
    
    const insumos = await kv.getByPrefix(`insumo_fornecedor_${fornecedorId}_`);
    const insumosArray = insumos.map(item => item.value);
    
    // Buscar nome e medida de cada insumo
    for (const insumo of insumosArray) {
      const insumoBase = await kv.get(insumo.insumo_id);
      if (insumoBase) {
        insumo.insumo_nome = insumoBase.nome;
        insumo.insumo_medida = insumoBase.medida;
      }
    }
    
    console.log(`🔗 Listando ${insumosArray.length} insumos do fornecedor ${fornecedorId}`);
    return c.json(insumosArray);
  } catch (error) {
    console.error('❌ Erro ao listar insumos do fornecedor:', error);
    return c.json({ error: 'Erro ao listar insumos do fornecedor' }, 500);
  }
});

// POST /fornecedores/:id/insumos - Vincular insumo ao fornecedor
cadastrosRoutes.post("/fornecedores/:id/insumos", async (c) => {
  try {
    const fornecedorId = c.req.param('id');
    const body = await c.req.json();
    
    const vinculoId = `insumo_fornecedor_${fornecedorId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const vinculo = {
      id: vinculoId,
      fornecedor_id: fornecedorId,
      insumo_id: body.insumo_id,
      prazo_negociacao: body.prazo_negociacao,
      prazo_producao: body.prazo_producao,
      prazo_entrega: body.prazo_entrega,
      valor_unidade: body.valor_unidade,
      created_at: new Date().toISOString(),
    };
    
    await kv.set(vinculoId, vinculo);
    
    console.log(`✅ Insumo vinculado ao fornecedor: ${vinculoId}`);
    return c.json(vinculo);
  } catch (error) {
    console.error('❌ Erro ao vincular insumo:', error);
    return c.json({ error: 'Erro ao vincular insumo' }, 500);
  }
});

// PUT /fornecedores/:id/insumos/:insumoId - Atualizar vinculação
cadastrosRoutes.put("/fornecedores/:id/insumos/:insumoId", async (c) => {
  try {
    const vinculoId = c.req.param('insumoId');
    const body = await c.req.json();
    
    const vinculoAtual = await kv.get(vinculoId);
    if (!vinculoAtual) {
      return c.json({ error: 'Vínculo não encontrado' }, 404);
    }
    
    const vinculoAtualizado = {
      ...vinculoAtual,
      insumo_id: body.insumo_id ?? vinculoAtual.insumo_id,
      prazo_negociacao: body.prazo_negociacao ?? vinculoAtual.prazo_negociacao,
      prazo_producao: body.prazo_producao ?? vinculoAtual.prazo_producao,
      prazo_entrega: body.prazo_entrega ?? vinculoAtual.prazo_entrega,
      valor_unidade: body.valor_unidade ?? vinculoAtual.valor_unidade,
      updated_at: new Date().toISOString(),
    };
    
    await kv.set(vinculoId, vinculoAtualizado);
    
    console.log(`✅ Vínculo atualizado: ${vinculoId}`);
    return c.json(vinculoAtualizado);
  } catch (error) {
    console.error('❌ Erro ao atualizar vínculo:', error);
    return c.json({ error: 'Erro ao atualizar vínculo' }, 500);
  }
});

// DELETE /fornecedores/:id/insumos/:insumoId - Desvincular insumo
cadastrosRoutes.delete("/fornecedores/:id/insumos/:insumoId", async (c) => {
  try {
    const vinculoId = c.req.param('insumoId');
    
    await kv.del(vinculoId);
    
    console.log(`🗑️ Insumo desvinculado: ${vinculoId}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao desvincular insumo:', error);
    return c.json({ error: 'Erro ao desvincular insumo' }, 500);
  }
});
