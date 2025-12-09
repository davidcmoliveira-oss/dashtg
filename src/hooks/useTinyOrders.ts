import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TinyOrderV2 {
  pedido: {
    id: number;
    numero: number;
    numero_ecommerce?: string;
    data_pedido: string;
    data_prevista?: string;
    nome: string;
    valor: number;
    id_vendedor?: number;
    nome_vendedor?: string;
    situacao: string;
    codigo_rastreamento?: string;
  };
}

interface TinyOrdersResponseV2 {
  status: string;
  pagina: number;
  numero_paginas: number;
  pedidos: TinyOrderV2[];
}

type OrderStatus = 'pendente' | 'processando' | 'concluido' | 'cancelado';

const mapTinyStatus = (situacao: string): OrderStatus => {
  const statusMap: Record<string, OrderStatus> = {
    'aberto': 'pendente',
    'aprovado': 'processando',
    'preparando envio': 'processando',
    'faturado': 'concluido',
    'faturado (atendido parcialmente)': 'concluido',
    'enviado': 'concluido',
    'entregue': 'concluido',
    'atendido': 'concluido',
    'cancelado': 'cancelado',
    'em aberto': 'pendente',
    'não entregue': 'cancelado',
  };
  return statusMap[situacao?.toLowerCase()] || 'pendente';
};

export const useTinyOrders = () => {
  const [orders, setOrders] = useState<TinyOrderV2[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ pagina: 1, totalPaginas: 1 });

  const fetchOrders = useCallback(async (pagina = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('tiny-orders', {
        body: { action: 'list', pagina },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setOrders(data.pedidos || []);
      setPagination({
        pagina: data.pagina || 1,
        totalPaginas: data.numero_paginas || 1,
      });
      
      return data as TinyOrdersResponseV2;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar pedidos';
      setError(message);
      console.error('Error fetching orders:', message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const transformedOrders = orders.map((item) => ({
    id: `ORD-${item.pedido.id}`,
    cliente: item.pedido.nome || 'Cliente não informado',
    valor: item.pedido.valor || 0,
    status: mapTinyStatus(item.pedido.situacao),
    data: item.pedido.data_pedido || '-',
  }));

  return {
    orders: transformedOrders,
    rawOrders: orders,
    isLoading,
    error,
    pagination,
    fetchOrders,
  };
};
