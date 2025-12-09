import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TinyOrder {
  id: number;
  numero: string;
  cliente: {
    nome: string;
  };
  valor: number;
  situacao: string;
  data_pedido: string;
}

interface TinyOrdersResponse {
  itens: TinyOrder[];
  pagina_atual: number;
  total_paginas: number;
  total_registros: number;
}

type OrderStatus = 'pendente' | 'processando' | 'concluido' | 'cancelado';

const mapTinyStatus = (situacao: string): OrderStatus => {
  const statusMap: Record<string, OrderStatus> = {
    'aberto': 'pendente',
    'aprovado': 'processando',
    'preparando_envio': 'processando',
    'faturado': 'concluido',
    'enviado': 'concluido',
    'entregue': 'concluido',
    'cancelado': 'cancelado',
  };
  return statusMap[situacao?.toLowerCase()] || 'pendente';
};

export const useTinyOrders = () => {
  const [orders, setOrders] = useState<TinyOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      setOrders(data.itens || []);
      return data as TinyOrdersResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar pedidos';
      setError(message);
      console.error('Error fetching orders:', message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const transformedOrders = orders.map((order) => ({
    id: `ORD-${order.id}`,
    cliente: order.cliente?.nome || 'Cliente não informado',
    valor: order.valor || 0,
    status: mapTinyStatus(order.situacao),
    data: order.data_pedido 
      ? new Date(order.data_pedido).toLocaleString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) 
      : '-',
  }));

  return {
    orders: transformedOrders,
    rawOrders: orders,
    isLoading,
    error,
    fetchOrders,
  };
};
