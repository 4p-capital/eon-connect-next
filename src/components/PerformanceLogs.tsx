"use client";

import { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Invocation {
  id: string;
  timestamp: string;
  status: number;
  method: string;
  path: string;
  execution_time_ms: number;
}

interface InvocationsData {
  total: number;
  ok: number;         // 2xx
  warnings: number;   // 4xx
  errors: number;     // 5xx
  invocations: Invocation[];
  timeline: Array<{
    timestamp: string;
    count: number;
  }>;
}

export function PerformanceLogs() {
  const [data, setData] = useState<InvocationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'1' | '24' | '168' | '720'>('24'); // horas
  const [dbStatus, setDbStatus] = useState<{ online: boolean; latency: number | null; lastCheck: Date } | null>(null);
  const [checkingDb, setCheckingDb] = useState(false);

  const checkDatabasePing = async () => {
    try {
      setCheckingDb(true);
      const startTime = Date.now();
      
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/monitoring/database-ping`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        }
      );
      
      const latency = Date.now() - startTime;
      
      if (res.ok) {
        const result = await res.json();
        setDbStatus({
          online: result.online,
          latency: latency,
          lastCheck: new Date(),
        });
      } else {
        setDbStatus({
          online: false,
          latency: null,
          lastCheck: new Date(),
        });
      }
    } catch (error) {
      console.error('❌ Erro ao verificar ping do banco:', error);
      setDbStatus({
        online: false,
        latency: null,
        lastCheck: new Date(),
      });
    } finally {
      setCheckingDb(false);
    }
  };

  const fetchInvocations = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a8708d5d/monitoring/invocations?hours=${period}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        }
      );

      if (res.ok) {
        const result = await res.json();
        console.log('📊 Dados recebidos:', result);
        setData(result);
      } else {
        console.error('❌ Erro ao buscar invocações:', await res.text());
      }
    } catch (error) {
      console.error('❌ Erro ao buscar invocações:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvocations();
    checkDatabasePing();
    
    // ⚡ OTIMIZAÇÃO: Intervalo aumentado para 60 segundos (antes 30s) + controle de visibilidade
    const interval = setInterval(() => {
      if (!document.hidden) { // Só buscar se aba estiver visível
        fetchInvocations();
        checkDatabasePing();
      } else {
        console.log('⏸️ Aba inativa - pulando atualização de performance logs');
      }
    }, 60000);
    
    // Pausar/retomar polling quando visibilidade da aba mudar
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('▶️ Aba ativa - atualizando performance logs');
        fetchInvocations();
        checkDatabasePing();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [period]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando invocações...</p>
        </div>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-gray-900 mb-2">Nenhuma Invocação Registrada</h3>
        <p className="text-gray-600 text-sm">
          Não há invocações registradas para o período selecionado.
        </p>
        <p className="text-gray-500 text-xs mt-2">
          Execute algumas operações no sistema para gerar dados de monitoramento.
        </p>
      </div>
    );
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 400 && status < 500) return 'text-yellow-600';
    if (status >= 500) return 'text-red-600';
    return 'text-gray-600';
  };

  const getStatusBg = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-green-100';
    if (status >= 400 && status < 500) return 'bg-yellow-100';
    if (status >= 500) return 'bg-red-100';
    return 'bg-gray-100';
  };

  // Função para arredondar timestamp para intervalos de 20 minutos
  const roundTo20Minutes = (date: Date): string => {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.floor(minutes / 20) * 20;
    const rounded = new Date(date);
    rounded.setMinutes(roundedMinutes, 0, 0);
    
    // Retornar em formato local (não UTC) para evitar problemas de timezone
    const year = rounded.getFullYear();
    const month = String(rounded.getMonth() + 1).padStart(2, '0');
    const day = String(rounded.getDate()).padStart(2, '0');
    const hour = String(rounded.getHours()).padStart(2, '0');
    const minute = String(rounded.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hour}:${minute}:00`;
  };

  // Gerar todos os intervalos de 20 minutos no período selecionado
  const generateTimeIntervals = (): string[] => {
    const intervals: string[] = [];
    const now = new Date();
    const hoursAgo = parseInt(period);
    const startTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    
    let current = new Date(startTime);
    current.setMinutes(Math.floor(current.getMinutes() / 20) * 20, 0, 0);
    
    while (current <= now) {
      intervals.push(current.toISOString());
      current = new Date(current.getTime() + 20 * 60 * 1000); // +20 minutos
    }
    
    return intervals;
  };

  // Gerar intervalos de 20 minutos apenas para as últimas 3 horas (para os gráficos)
  const generateLast3HoursIntervals = (): string[] => {
    const intervals: string[] = [];
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    
    let current = new Date(threeHoursAgo);
    current.setMinutes(Math.floor(current.getMinutes() / 20) * 20, 0, 0);
    
    while (current <= now) {
      // Usar formato local consistente
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const hour = String(current.getHours()).padStart(2, '0');
      const minute = String(current.getMinutes()).padStart(2, '0');
      
      intervals.push(`${year}-${month}-${day}T${hour}:${minute}:00`);
      current = new Date(current.getTime() + 20 * 60 * 1000); // +20 minutos
    }
    
    return intervals;
  };

  // Processar dados para timeline separada por status (a cada 20 minutos - últimas 3 horas)
  const processTimelineByStatus = () => {
    if (!data?.invocations) return [];

    const timeMap: { [key: string]: { timestamp: string; sucesso: number; avisos: number; erros: number } } = {};
    
    // Inicializar apenas as últimas 3 horas com intervalos de 20 minutos
    const intervals = generateLast3HoursIntervals();
    intervals.forEach(interval => {
      timeMap[interval] = { timestamp: interval, sucesso: 0, avisos: 0, erros: 0 };
    });

    // Filtrar apenas dados das últimas 3 horas
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    // Preencher com dados reais
    data.invocations
      .filter(inv => new Date(inv.timestamp) >= threeHoursAgo)
      .forEach(inv => {
        const roundedKey = roundTo20Minutes(new Date(inv.timestamp));
        
        if (timeMap[roundedKey]) {
          if (inv.status >= 200 && inv.status < 300) {
            timeMap[roundedKey].sucesso++;
          } else if (inv.status >= 400 && inv.status < 500) {
            timeMap[roundedKey].avisos++;
          } else if (inv.status >= 500) {
            timeMap[roundedKey].erros++;
          }
        }
      });

    return Object.values(timeMap).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  };

  // Processar timeline total (a cada 20 minutos - últimas 3 horas)
  const processTimelineTotal = () => {
    if (!data?.invocations) return [];

    const timeMap: { [key: string]: number } = {};
    
    // Inicializar apenas as últimas 3 horas com intervalos de 20 minutos
    const intervals = generateLast3HoursIntervals();
    intervals.forEach(interval => {
      timeMap[interval] = 0;
    });

    // Filtrar apenas dados das últimas 3 horas
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    // Preencher com dados reais
    data.invocations
      .filter(inv => new Date(inv.timestamp) >= threeHoursAgo)
      .forEach(inv => {
        const roundedKey = roundTo20Minutes(new Date(inv.timestamp));
        
        if (timeMap[roundedKey] !== undefined) {
          timeMap[roundedKey]++;
        }
      });
    
    return Object.entries(timeMap).map(([timestamp, count]) => ({
      timestamp,
      count
    })).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  };

  const timelineByStatus = processTimelineByStatus();
  const timelineTotal = processTimelineTotal();

  return (
    <div className="space-y-6">
      {/* Header com Período e Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Período:</span>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {[
              { value: '1', label: '1h' },
              { value: '24', label: '24h' },
              { value: '168', label: '7d' },
              { value: '720', label: '30d' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPeriod(value as any)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  period === value
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        
        <button
          onClick={fetchInvocations}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Database Status Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              dbStatus?.online ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <Activity className={`w-5 h-5 ${
                dbStatus?.online ? 'text-green-600' : 'text-red-600'
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${
                  dbStatus?.online ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`} />
                <span className={`text-sm ${
                  dbStatus?.online ? 'text-green-600' : 'text-red-600'
                }`}>
                  {dbStatus?.online ? 'Online' : 'Offline'}
                </span>
              </div>
              {dbStatus?.latency && (
                <div className="text-xs text-gray-500 mt-1">
                  Latência: {dbStatus.latency}ms
                </div>
              )}
            </div>
          </div>
          <button
            onClick={checkDatabasePing}
            disabled={checkingDb}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${checkingDb ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="text-sm text-gray-600">Status do Banco de Dados</div>
        {dbStatus?.lastCheck && (
          <div className="text-xs text-gray-400 mt-1">
            Última verificação: {dbStatus.lastCheck.toLocaleTimeString('pt-BR')}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-2xl text-gray-900">{data.total}</div>
          </div>
          <div className="text-sm text-gray-600">Total de Invocações</div>
        </div>

        {/* OK (2xx) */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-2xl text-gray-900">{data.ok}</div>
          </div>
          <div className="text-sm text-gray-600">Sucesso (2xx)</div>
          {data.total > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              {((data.ok / data.total) * 100).toFixed(1)}%
            </div>
          )}
        </div>

        {/* Warnings (4xx) */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 bg-yellow-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="text-2xl text-gray-900">{data.warnings}</div>
          </div>
          <div className="text-sm text-gray-600">Avisos (4xx)</div>
          {data.total > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              {((data.warnings / data.total) * 100).toFixed(1)}%
            </div>
          )}
        </div>

        {/* Errors (5xx) */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 bg-red-50 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="text-2xl text-gray-900">{data.errors}</div>
          </div>
          <div className="text-sm text-gray-600">Erros (5xx)</div>
          {data.total > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              {((data.errors / data.total) * 100).toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      {/* Gráficos de Linha - Lado a Lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Total de Invocações */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="mb-6">
            <h3 className="text-gray-900">Invocações</h3>
            <p className="text-sm text-gray-500">Total de requisições (últimas 3 horas)</p>
          </div>

          {timelineTotal.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timelineTotal}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(ts) => {
                    const date = new Date(ts);
                    if (period === '1') {
                      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    } else if (period === '24') {
                      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    } else {
                      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    }
                  }}
                  stroke="#9CA3AF"
                  style={{ fontSize: '12px' }}
                  tick={{ fill: '#6B7280' }}
                />
                <YAxis
                  stroke="#9CA3AF"
                  style={{ fontSize: '12px' }}
                  tick={{ fill: '#6B7280' }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  labelFormatter={(ts) => new Date(ts).toLocaleString('pt-BR')}
                  formatter={(value: any) => [value, 'Invocações']}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              Sem dados no período selecionado
            </div>
          )}
        </div>

        {/* Gráfico 2: Sucesso, Avisos e Erros */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="mb-6">
            <h3 className="text-gray-900">Status das Requisições</h3>
            <p className="text-sm text-gray-500">Sucesso, avisos e erros ao longo do tempo</p>
          </div>

          {timelineByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineByStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(ts) => {
                    const date = new Date(ts);
                    if (period === '1') {
                      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    } else if (period === '24') {
                      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    } else {
                      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    }
                  }}
                  stroke="#9CA3AF"
                  style={{ fontSize: '12px' }}
                  tick={{ fill: '#6B7280' }}
                />
                <YAxis
                  stroke="#9CA3AF"
                  style={{ fontSize: '12px' }}
                  tick={{ fill: '#6B7280' }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  labelFormatter={(ts) => new Date(ts).toLocaleString('pt-BR')}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="line"
                />
                <Line 
                  type="monotone" 
                  dataKey="sucesso" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={false}
                  name="Sucesso (2xx)"
                />
                <Line 
                  type="monotone" 
                  dataKey="avisos" 
                  stroke="#F59E0B" 
                  strokeWidth={2}
                  dot={false}
                  name="Avisos (4xx)"
                />
                <Line 
                  type="monotone" 
                  dataKey="erros" 
                  stroke="#EF4444" 
                  strokeWidth={2}
                  dot={false}
                  name="Erros (5xx)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              Sem dados no período selecionado
            </div>
          )}
        </div>
      </div>

      {/* Invocations Table - Estilo Supabase */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-gray-900">Últimas Invocações</h3>
          <p className="text-sm text-gray-500 mt-1">
            Mostrando {Math.min(data.invocations.length, 1000)} de {data.total} invocações
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                  Método
                </th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                  Path
                </th>
                <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                  Tempo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.invocations.slice(0, 1000).map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-sm text-gray-600 font-mono">
                    {new Date(inv.timestamp).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs ${getStatusBg(
                        inv.status
                      )} ${getStatusColor(inv.status)}`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-xs font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
                      {inv.method}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900 font-mono max-w-md truncate">
                    {inv.path}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {inv.execution_time_ms.toFixed(1)}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.invocations.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            Nenhuma invocação encontrada
          </div>
        )}
      </div>
    </div>
  );
}